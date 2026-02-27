import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Map(),
  };
}

function mockArrayResponse(data: any[]) {
  return mockJsonResponse(data);
}

beforeEach(async () => {
  mockFetch.mockReset();
  vi.resetModules();
  const mod = await import('../client/src/lib/enquiries-service');
  mod.clearEnquiryCache();
});

describe('Enquiry Cache & Deduplication', () => {
  it('clearEnquiryCache with no argument clears all entries', async () => {
    const { clearEnquiryCache, getBasicAccountDetails } = await import('../client/src/lib/enquiries-service');
    mockFetch.mockResolvedValue(mockJsonResponse({ accountId: 1 }));
    await getBasicAccountDetails(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    await getBasicAccountDetails(1);
    expect(mockFetch).toHaveBeenCalledTimes(0);

    clearEnquiryCache();
    mockFetch.mockResolvedValue(mockJsonResponse({ accountId: 1 }));
    await getBasicAccountDetails(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('clearEnquiryCache with accountId only clears that account', async () => {
    const { clearEnquiryCache, getBasicAccountDetails } = await import('../client/src/lib/enquiries-service');
    mockFetch.mockResolvedValue(mockJsonResponse({ accountId: 100 }));
    await getBasicAccountDetails(100);
    mockFetch.mockResolvedValue(mockJsonResponse({ accountId: 200 }));
    await getBasicAccountDetails(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    clearEnquiryCache(100);
    mockFetch.mockClear();

    mockFetch.mockResolvedValue(mockJsonResponse({ accountId: 100 }));
    await getBasicAccountDetails(100);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    await getBasicAccountDetails(200);
    expect(mockFetch).toHaveBeenCalledTimes(0);
  });

  it('deduplicatedFetch deduplicates concurrent identical requests', async () => {
    const { clearEnquiryCache, getBasicAccountDetails } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();
    let resolvePromise: Function;
    mockFetch.mockImplementation(() => new Promise(resolve => {
      resolvePromise = () => resolve(mockJsonResponse({ accountId: 5 }));
    }));

    const p1 = getBasicAccountDetails(5);
    const p2 = getBasicAccountDetails(5);
    resolvePromise!();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });
});

describe('Account Search — searchAccounts', () => {
  it('sends POST to /api/platinum/billing-enquiry/enquiry-results with accountID field', async () => {
    vi.resetModules();
    const mod = await import('../client/src/lib/enquiries-service');
    mod.clearEnquiryCache();
    mockFetch.mockResolvedValue(mockArrayResponse([{ account_ID: 12345, accountNumber: '000000012345' }]));

    await mod.searchAccounts({ accountNo: '12345' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/platinum/billing-enquiry/enquiry-results');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toHaveProperty('accountID', '12345');
  });

  it('maps name criteria to companyName field', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { searchAccounts } = await import('../client/src/lib/enquiries-service');
    await searchAccounts({ name: 'John Doe' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty('companyName', 'John Doe');
  });

  it('maps idNo criteria to idRegistrationNumber field', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { searchAccounts } = await import('../client/src/lib/enquiries-service');
    await searchAccounts({ idNo: '9501015012083' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty('idRegistrationNumber', '9501015012083');
  });

  it('maps sgNumber criteria correctly', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { searchAccounts } = await import('../client/src/lib/enquiries-service');
    await searchAccounts({ sgNumber: 'C027/0002/00009010/00000' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty('sgNumber', 'C027/0002/00009010/00000');
  });

  it('email-only search routes through searchByEmail', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([{ account_ID: 1 }]));

    const { searchAccounts } = await import('../client/src/lib/enquiries-service');
    await searchAccounts({ emailAddress: 'test@example.com' });

    expect(mockFetch).toHaveBeenCalled();
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain('billing-enquiry');
  });
});

describe('Account Detail Endpoint URLs', () => {
  const endpointTests: [string, string, (mod: any) => Promise<any>][] = [
    ['getBasicAccountDetails', '/api/platinum/billing-enquiry/basic-account-details?accountId=12345', (m) => m.getBasicAccountDetails(12345)],
    ['getAccountInfoResult', '/api/platinum/billing-enquiry/account-info-result?accountId=12345', (m) => m.getAccountInfoResult(12345)],
    ['getAccountInformation', '/api/platinum/billing-account-management/account-information?accountId=12345', (m) => m.getAccountInformation(12345)],
    ['getAccountDeliveryAddressDetail', '/api/platinum/billing-enquiry/account-delivery-address-detail?accountId=12345', (m) => m.getAccountDeliveryAddressDetail(12345)],
    ['getNameInfo', '/api/platinum/billing-enquiry/name-info-by-account?accountId=12345', (m) => m.getNameInfo(12345)],
    ['getContactDetails', '/api/platinum/billing-account-management/get-contact-details?accountId=12345', (m) => m.getContactDetails(12345)],
    ['getAccountBalance', '/api/platinum/billing-enquiry/total-balance-debt?accountId=12345', (m) => m.getAccountBalance(12345)],
    ['getAccountStatus', '/api/platinum/billing-enquiry/get-status?accountId=12345', (m) => m.getAccountStatus(12345)],
    ['getPropertyDetails', '/api/platinum/billing-enquiry/property-details-by-account?AccountId=12345', (m) => m.getPropertyDetails(12345)],
    ['getPartitionDetails', '/api/platinum/billing-enquiry/partition-details?accountId=12345', (m) => m.getPartitionDetails(12345)],
    ['getDepositAmount', '/api/platinum/billing-enquiry/deposit-amount?accountId=12345', (m) => m.getDepositAmount(12345)],
    ['getHandoverInfo', '/api/platinum/billing-enquiry/handover-by-account?accountId=12345', (m) => m.getHandoverInfo(12345)],
    ['getPaymentIncentive', '/api/platinum/billing-enquiry/payment-incentive-by-account?accountId=12345', (m) => m.getPaymentIncentive(12345)],
    ['getRepaymentPlanStatus', '/api/platinum/billing-enquiry/repayment-plan-status?accountId=12345', (m) => m.getRepaymentPlanStatus(12345)],
  ];

  for (const [name, expectedUrl, callFn] of endpointTests) {
    it(`${name} calls correct Platinum endpoint`, async () => {
      mockFetch.mockReset();
      vi.resetModules();
      const mod = await import('../client/src/lib/enquiries-service');
      mod.clearEnquiryCache();
      mockFetch.mockResolvedValue(mockJsonResponse({}));

      await callFn(mod);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(expectedUrl);
    });
  }
});

describe('Array-returning Enquiry Functions', () => {
  const arrayTests: [string, (mod: any) => Promise<any>][] = [
    ['getAccountNotifications', (m) => m.getAccountNotifications(12345)],
    ['getContactDetailsHistory', (m) => m.getContactDetailsHistory(12345)],
    ['getDeliveryAddressHistory', (m) => m.getDeliveryAddressHistory(12345)],
    ['getMeteredServicesOnAccount', (m) => m.getMeteredServicesOnAccount(12345)],
    ['getAllServices', (m) => m.getAllServices(12345)],
    ['getServicesSearchResults', (m) => m.getServicesSearchResults(12345)],
    ['getDeposits', (m) => m.getDeposits(12345)],
    ['getOccupiers', (m) => m.getOccupiers(12345)],
    ['getChequeFinalSearchList', (m) => m.getChequeFinalSearchList(12345)],
    ['getGeneratedStatements', (m) => m.getGeneratedStatements(12345)],
  ];

  for (const [name, callFn] of arrayTests) {
    it(`${name} normalizes response to array`, async () => {
      mockFetch.mockReset();
      vi.resetModules();
      const mod = await import('../client/src/lib/enquiries-service');
      mod.clearEnquiryCache();
      mockFetch.mockResolvedValue(mockArrayResponse([{ id: 1 }, { id: 2 }]));

      const result = await callFn(mod);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it(`${name} handles empty response`, async () => {
      mockFetch.mockReset();
      vi.resetModules();
      const mod = await import('../client/src/lib/enquiries-service');
      mod.clearEnquiryCache();
      mockFetch.mockResolvedValue(mockArrayResponse([]));

      const result = await callFn(mod);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  }
});

describe('Service Type Balance — Financial Year Parameter', () => {
  it('includes financialYear in URL when provided', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { getServiceTypeBalance, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();
    await getServiceTypeBalance(12345, '2025/2026');

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('financialYear=2025%2F2026');
  });

  it('generates default financial year when not provided', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { getServiceTypeBalance, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();
    await getServiceTypeBalance(12345);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('financialYear=');
    expect(url).toMatch(/financialYear=\d{4}%2F\d{4}/);
  });
});

describe('Autocomplete Type Detection — getAutocompleteTypesForQuery', () => {
  it('detects mobile number (starts with 0, 10 digits)', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    expect(getAutocompleteTypesForQuery('0821234567')).toEqual(['mobileNumber']);
  });

  it('detects SA ID number (13 digits)', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    expect(getAutocompleteTypesForQuery('9501015012083')).toEqual(['idRegistrationNumber']);
  });

  it('detects ERF number pattern', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    expect(getAutocompleteTypesForQuery('C027/0002/00009010/00000')).toEqual(['erfNumber']);
  });

  it('detects numeric input as account/ERF/oldAccount/meter', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    const types = getAutocompleteTypesForQuery('12345');
    expect(types).toContain('accountNumber');
    expect(types).toContain('erfNumber');
    expect(types).toContain('oldAccountCode');
    expect(types).toContain('physicalMeterNumber');
  });

  it('detects email address', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    expect(getAutocompleteTypesForQuery('john@test.com')).toEqual(['email']);
  });

  it('defaults to name/address for text input', async () => {
    const { getAutocompleteTypesForQuery } = await import('../client/src/lib/enquiries-service');
    const types = getAutocompleteTypesForQuery('John Doe');
    expect(types).toContain('nameCompany');
    expect(types).toContain('locationAddress');
  });
});

describe('Error Handling & Timeout', () => {
  it('propagates fetch errors from detail functions', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const { getBasicAccountDetails, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();

    await expect(getBasicAccountDetails(12345)).rejects.toThrow('Network failure');
  });

  it('propagates fetch errors from array functions', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const { getAccountNotifications, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();

    await expect(getAccountNotifications(12345)).rejects.toThrow('Connection refused');
  });
});

describe('Meter Reading History', () => {
  it('includes meterNo in URL', async () => {
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    const { getMeterReadingHistory, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();
    await getMeterReadingHistory(12345, 'WM-001');

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('WM-001');
    expect(url).toContain('12345');
  });
});

describe('Clearance Inquiries', () => {
  it('uses propertyId when provided', async () => {
    mockFetch.mockReset();
    vi.resetModules();
    const mod = await import('../client/src/lib/enquiries-service');
    mod.clearEnquiryCache();
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    await mod.getClearanceInquiries(12345, 100);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('propertyId=100');
  });

  it('uses accountId when propertyId not provided', async () => {
    mockFetch.mockReset();
    vi.resetModules();
    const mod = await import('../client/src/lib/enquiries-service');
    mod.clearEnquiryCache();
    mockFetch.mockResolvedValue(mockArrayResponse([]));

    await mod.getClearanceInquiries(12345);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('accountId=12345');
  });
});

describe('Accounts By Name ID', () => {
  it('calls correct endpoint', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ nameId: 500, accounts: [{ accountId: 1 }] }));

    const { getAccountsByNameId, clearEnquiryCache } = await import('../client/src/lib/enquiries-service');
    clearEnquiryCache();
    const result = await getAccountsByNameId(12345);

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('/api/platinum/accounts-by-name-id');
    expect(url).toContain('12345');
  });
});
