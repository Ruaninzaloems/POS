const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

export interface EnquirySearchCriteria {
  accountNo?: string;
  oldAccountCode?: string;
  name?: string;
  idNo?: string;
  passportNumber?: string;
  deliveryAddress?: string;
  locationAddress?: string;
  allotmentArea?: string;
  erfNumber?: string;
  emailAddress?: string;
  mobileNumber?: string;
  physicalMeterNumber?: string;
  trading?: string;
}

export interface EnquirySearchResult {
  account_ID: number;
  accountNumber: string;
  oldAccountCode: string;
  name: string;
  surname_Company: string;
  initials: string;
  idRegistrationNumber: string;
  deliveryAddress: string;
  locationAddress: string;
  statusDesc: string;
  accountDesc: string;
  outStandingAmt: number;
  [key: string]: any;
}

export async function searchAccounts(criteria: EnquirySearchCriteria): Promise<EnquirySearchResult[]> {
  const body: Record<string, any> = {};
  if (criteria.accountNo) body.accountID = criteria.accountNo;
  if (criteria.oldAccountCode) body.oldAccount = criteria.oldAccountCode;
  if (criteria.name) body.companyName = criteria.name;
  if (criteria.idNo) body.idRegistrationNumber = criteria.idNo;
  if (criteria.passportNumber) body.passportNumber = criteria.passportNumber;
  if (criteria.deliveryAddress) body.deliveryAddress = criteria.deliveryAddress;
  if (criteria.locationAddress) body.locationAddress = criteria.locationAddress;
  if (criteria.allotmentArea) body.allotmentArea = criteria.allotmentArea;
  if (criteria.erfNumber) body.eftNumber = criteria.erfNumber;
  if (criteria.emailAddress) body.emailAddress = criteria.emailAddress;
  if (criteria.mobileNumber) body.mobileNumber = criteria.mobileNumber;
  if (criteria.physicalMeterNumber) body.physicalMeterNumber = criteria.physicalMeterNumber;
  if (criteria.trading) body.trading = criteria.trading;

  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (Array.isArray(data)) return data;
  if (data?.value && Array.isArray(data.value)) return data.value;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

export async function getAccountBalance(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/total-balance-debt?accountId=${accountId}`);
}

export async function getServiceTypeBalance(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/service-type-balance?accountId=${accountId}`);
  return Array.isArray(data) ? data : (data?.value || data?.results || [data]).filter(Boolean);
}

export async function getPropertyDetails(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/property-details-by-account?AccountId=${accountId}`);
}

export async function getConsumptionUnits(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-unit-by-account?AccountId=${accountId}`);
  return Array.isArray(data) ? data : (data?.value || data?.results || [data]).filter(Boolean);
}

export async function getNameInfo(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`);
}

export async function getHandoverInfo(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/handover-by-account?accountId=${accountId}`);
}

export async function getPaymentIncentive(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/payment-incentive-by-account?accountId=${accountId}`);
}

export async function getDeposits(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/deposits-by-account-id?accountId=${accountId}`);
  return Array.isArray(data) ? data : (data?.value || data?.results || []).filter(Boolean);
}

export async function getDepositAmount(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/deposit-amount?accountId=${accountId}`);
}

export async function getReceiptTransactionDetail(primaryId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/receipt-transaction-detail?primaryId=${primaryId}`);
}

export async function getTransactionHistory(accountNumber: string): Promise<any[]> {
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 2);
  const body = {
    accountNumber,
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    page: 1,
    pageSize: 100,
    orderby: 'receiptDate',
    shortDirection: 'desc',
  };
  const data = await fetchWithTimeout('/api/platinum/view-receipt/get-receipt-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.value && Array.isArray(data.value)) return data.value;
  return [];
}

export async function rebuildFullAccount(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/rebuild-full-account?accountId=${accountId}`);
}

export async function getRebuildAccountSSCheck(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/get-rebuild-account-ss-check?accountId=${accountId}`);
}
