import { resolveApiUrl, getAuthHeaders } from "./pos-config-context";

const TIMEOUT_MS = 15000;

const apiCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const SHORT_CACHE_TTL = 60 * 1000;

const inflightRequests = new Map<string, Promise<any>>();

function getCached(key: string, ttl: number = CACHE_TTL): any | null {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  if (entry) apiCache.delete(key);
  return null;
}

export function clearCacheKey(key: string): void {
  apiCache.delete(key);
}

function setCache(key: string, data: any): void {
  apiCache.set(key, { data, ts: Date.now() });
  if (apiCache.size > 200) {
    const oldest = Array.from(apiCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) apiCache.delete(oldest[i][0]);
  }
}

async function deduplicatedFetch(cacheKey: string, fetcher: () => Promise<any>, ttl: number = CACHE_TTL): Promise<any> {
  const cached = getCached(cacheKey, ttl);
  if (cached !== null) return cached;

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) return inflight;

  const promise = fetcher().then(data => {
    setCache(cacheKey, data);
    inflightRequests.delete(cacheKey);
    return data;
  }).catch(err => {
    inflightRequests.delete(cacheKey);
    throw err;
  });

  inflightRequests.set(cacheKey, promise);
  return promise;
}

export function clearEnquiryCache(accountId?: number): void {
  if (!accountId) {
    apiCache.clear();
    inflightRequests.clear();
    return;
  }
  const suffix = `-${accountId}`;
  const keys = Array.from(apiCache.keys());
  for (const key of keys) {
    if (key.endsWith(suffix) || key.includes(`${suffix}-`)) apiCache.delete(key);
  }
  const inflightKeys = Array.from(inflightRequests.keys());
  for (const key of inflightKeys) {
    if (key.endsWith(suffix) || key.includes(`${suffix}-`)) inflightRequests.delete(key);
  }
}

async function fetchOnce(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resolved = resolveApiUrl(url);
    const authHeaders = getAuthHeaders();
    const mergedHeaders = {
      ...authHeaders,
      ...(options?.headers as Record<string, string> || {}),
    };
    const res = await fetch(resolved, { ...options, headers: mergedHeaders, credentials: "include", signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (data && data._error) throw new Error(data.detail || data.statusText || `API error: ${data.status || 'unknown'}`);
    return data;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

const MAX_RETRIES = 1;
const RETRY_DELAY = 400;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchOnce(url, options);
    } catch (e: any) {
      lastError = e;
      const isRetryable = e.message?.includes('timed out') || e.message?.includes('502') || e.message?.includes('503') || e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError');
      if (!isRetryable || attempt >= MAX_RETRIES) throw e;
      await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
    }
  }
  throw lastError;
}

function normalizeArray(data: any): any[] {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { console.error('[normalizeArray] Failed to parse JSON string:', e); return []; }
  }
  if (Array.isArray(data)) return data;
  if (data?.value && Array.isArray(data.value)) return data.value;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data && typeof data === 'object' && !data._error) return [data];
  return [];
}

export interface EnquirySearchCriteria {
  accountNo?: string;
  oldAccountCode?: string;
  name?: string;
  idNo?: string;
  passportNumber?: string;
  locationAddress?: string;
  mobileNumber?: string;
  physicalMeterNumber?: string;
  emailAddress?: string;
  sgNumber?: string;
  erfNumber?: string;
}

export interface EnquirySearchResult {
  account_ID: number;
  accountID: number;
  accountNumber: string;
  oldAccountCode: string;
  name: string;
  surname_Company: string;
  initials: string;
  idRegistrationNumber: string;
  deliveryAddress: string;
  locationAddress: string;
  address: string;
  statusDesc: string;
  accountStatus: string;
  accountDesc: string;
  accountType: string;
  outStandingAmt: number;
  outStandingAmount: number;
  addName: string;
  contactDetails: string;
  unitID: number;
  unitPartitionID: number;
  sgNumber: string;
  propertyID: string;
  [key: string]: any;
}

// === SEARCH ===
export async function searchAccounts(criteria: EnquirySearchCriteria): Promise<EnquirySearchResult[]> {
  if (criteria.emailAddress && !criteria.accountNo && !criteria.name && !criteria.idNo) {
    return searchByEmail(criteria.emailAddress);
  }

  const body: Record<string, any> = {};
  if (criteria.accountNo) body.accountID = criteria.accountNo;
  if (criteria.oldAccountCode) body.oldAccount = criteria.oldAccountCode;
  if (criteria.name) body.companyName = criteria.name;
  if (criteria.idNo) body.idRegistrationNumber = criteria.idNo;
  if (criteria.passportNumber) body.passportNumber = criteria.passportNumber;
  if (criteria.locationAddress) body.locationAddress = criteria.locationAddress;
  if (criteria.mobileNumber) body.mobileNumber = criteria.mobileNumber;
  if (criteria.physicalMeterNumber) body.physicalMeterNumber = criteria.physicalMeterNumber;
  if (criteria.emailAddress) body.emailAddress = criteria.emailAddress;
  if (criteria.sgNumber) body.sgNumber = criteria.sgNumber;
  if (criteria.erfNumber) body.erfNumber = criteria.erfNumber;

  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeArray(data);
}

export async function getAdditionalEmails(emailAddress: string): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-account-management/get-additional-emails?emailAddress=${encodeURIComponent(emailAddress)}`);
  return normalizeArray(data);
}

export async function searchByEmail(email: string): Promise<EnquirySearchResult[]> {
  const [directResults, emailResults] = await Promise.allSettled([
    fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailAddress: email }),
    }).then(normalizeArray),
    getAdditionalEmails(email),
  ]);

  const direct = directResults.status === 'fulfilled' ? directResults.value : [];
  const emailMatches = emailResults.status === 'fulfilled' ? emailResults.value : [];

  const accountIds = new Set<number>();
  direct.forEach((r: any) => { const id = r.account_ID || r.accountID; if (id) accountIds.add(id); });

  const emailAccountIds: number[] = [];
  emailMatches.forEach((em: any) => {
    const id = em.accountId || em.account_ID || em.accountID;
    if (id && !accountIds.has(id)) { emailAccountIds.push(id); accountIds.add(id); }
  });

  const additionalResults: EnquirySearchResult[] = [];
  if (emailAccountIds.length > 0) {
    const BATCH = 5;
    for (let i = 0; i < emailAccountIds.length; i += BATCH) {
      const batch = emailAccountIds.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(id =>
          fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountID: id }),
          }).then(normalizeArray)
        )
      );
      batchResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value.length > 0) additionalResults.push(...r.value);
      });
    }
  }

  return [...direct, ...additionalResults];
}

export async function billingEnquirySearch(body: any): Promise<any[]> {
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeArray(data);
}

const FIELD_TO_AUTOCOMPLETE_TYPE: Record<string, string> = {
  accountNo: 'accountNumber',
  name: 'nameCompany',
  idNo: 'idRegistrationNumber',
  emailAddress: 'email',
  physicalMeterNumber: 'physicalMeterNumber',
  oldAccountCode: 'oldAccountCode',
  locationAddress: 'locationAddress',
  erfNumber: 'erfNumber',
  sgNumber: 'erfNumber',
  mobileNumber: 'mobileNumber',
  passportNumber: 'passportNumber',
};

export function getAutocompleteType(searchField: string): string | null {
  return FIELD_TO_AUTOCOMPLETE_TYPE[searchField] || null;
}

export async function autocomplete(search: string, type: string = 'accountNumber'): Promise<{ displayItem: string; accountId: number }[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/autocomplete?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`);
  return normalizeArray(data);
}

export async function autocompleteSearch(search: string, searchField: string = 'accountNo'): Promise<EnquirySearchResult[]> {
  const acType = getAutocompleteType(searchField);
  if (!acType) return [];
  const suggestions = await autocomplete(search, acType);
  if (!suggestions.length) return [];
  const validSuggestions = suggestions.filter(s => s.accountId && s.accountId > 0);
  if (!validSuggestions.length) return [];
  const top = validSuggestions.slice(0, 10);
  const results = await Promise.allSettled(
    top.map(s =>
      fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountID: String(s.accountId) }),
      }).then(normalizeArray)
    )
  );
  const all: EnquirySearchResult[] = [];
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
  return all;
}

export function getAutocompleteTypesForQuery(query: string): string[] {
  const trimmed = query.trim();
  if (/^0\d{9}$/.test(trimmed)) return ['mobileNumber'];
  if (/^\d{13}$/.test(trimmed)) return ['idRegistrationNumber'];
  if (/^[A-Z]\d{3}\/\d{4}\/\d+\/\d+$/i.test(trimmed)) return ['erfNumber'];
  if (/^\d+$/.test(trimmed)) return ['accountNumber', 'erfNumber', 'oldAccountCode', 'physicalMeterNumber'];
  if (/@/.test(trimmed)) return ['email'];
  return ['nameCompany', 'locationAddress'];
}

export async function multiAutocompleteSearch(search: string): Promise<{ suggestions: { displayItem: string; accountId: number; sourceType: string }[]; results: EnquirySearchResult[] }> {
  const types = getAutocompleteTypesForQuery(search);
  const allSuggestions = await Promise.allSettled(
    types.map(async (t) => {
      const items = await autocomplete(search, t);
      return items.map(item => ({ ...item, sourceType: t }));
    })
  );
  const suggestions: { displayItem: string; accountId: number; sourceType: string }[] = [];
  for (const r of allSuggestions) {
    if (r.status === 'fulfilled') suggestions.push(...r.value);
  }
  const validSuggestions = suggestions.filter(s => s.accountId && s.accountId > 0);
  const seen = new Set<number>();
  const unique = validSuggestions.filter(s => { if (seen.has(s.accountId)) return false; seen.add(s.accountId); return true; });
  if (!unique.length) return { suggestions, results: [] };
  const top = unique.slice(0, 5);
  const lookups = await Promise.allSettled(
    top.map(s =>
      fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountID: String(s.accountId) }),
      }).then(normalizeArray)
    )
  );
  const results: EnquirySearchResult[] = [];
  lookups.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
  return { suggestions, results };
}

// === CONFIG ===
export async function getConfigSetting(keyName: string): Promise<any> {
  const cacheKey = `config-setting-${keyName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-config-setting?strKeyName=${encodeURIComponent(keyName)}`);
  setCache(cacheKey, data);
  return data;
}

export async function getAppSetting(key: string): Promise<any> {
  const cacheKey = `app-setting-${key}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-app-setting?key=${encodeURIComponent(key)}`);
  setCache(cacheKey, data);
  return data;
}

export async function checkFileExists(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return fetchWithTimeout(`/api/platinum/billing-enquiry/check-file-exists?${qs}`);
}

// === ACCOUNT INFO ===
export async function getBasicAccountDetails(accountId: number): Promise<any> {
  return deduplicatedFetch(`basic-account-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/basic-account-details?accountId=${accountId}`));
}

export async function getAccountInfoResult(accountId: number): Promise<any> {
  return deduplicatedFetch(`account-info-result-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/account-info-result?accountId=${accountId}`));
}

export async function getAccountInformation(accountId: number): Promise<any> {
  return deduplicatedFetch(`account-information-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-account-management/account-information?accountId=${accountId}`));
}

export async function getAccountDeliveryAddressDetail(accountId: number): Promise<any> {
  return deduplicatedFetch(`account-delivery-addr-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/account-delivery-address-detail?accountId=${accountId}`));
}

export async function getDeliveryAccountDetailsById(accountId: number): Promise<any> {
  return deduplicatedFetch(`delivery-account-details-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/delivery-account-details-by-id?accountId=${accountId}`));
}

export async function getAccountNotifications(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`account-notifications-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/account-notifications?accountId=${accountId}`)),
    SHORT_CACHE_TTL);
}

export async function getAccountInquiries(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`account-inquiries-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/account-inquiries?accountId=${accountId}`)));
}

export async function getAccountStatus(accountId: number): Promise<any> {
  return deduplicatedFetch(`account-status-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/get-status?accountId=${accountId}`));
}

// === CONTACT / NAME ===
export async function getNameInfo(accountId: number): Promise<any> {
  return deduplicatedFetch(`name-info-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`));
}

export async function getAccountsByNameId(accountId: number): Promise<{ nameId: number | null; accounts: any[] }> {
  return deduplicatedFetch(`accounts-by-name-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/accounts-by-name-id?accountId=${accountId}`));
}

export async function getContactDetails(accountId: number): Promise<any> {
  return deduplicatedFetch(`contact-details-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`));
}

export async function getContactDetailsHistory(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`contact-details-history-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/contact-details-history-by-id?accountId=${accountId}`)));
}

export async function getDeliveryAddressHistory(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`delivery-addr-history-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/delivery-address-history-by-id?accountId=${accountId}`)));
}

// === BALANCE & DEBT ===
export async function getAccountBalance(accountId: number): Promise<any> {
  return deduplicatedFetch(`account-balance-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/total-balance-debt?accountId=${accountId}`),
    SHORT_CACHE_TTL);
}

export async function getServiceTypeBalance(accountId: number, financialYear?: string): Promise<any[]> {
  if (!financialYear) throw new Error('Financial year is required for service type balance');
  const yr = financialYear;
  return deduplicatedFetch(`svc-type-bal-${accountId}-${yr}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/service-type-balance?accountId=${accountId}&financialYear=${encodeURIComponent(yr)}`)),
    SHORT_CACHE_TTL);
}

// === PROPERTY ===
export async function getPropertyDetails(accountId: number): Promise<any> {
  return deduplicatedFetch(`property-details-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/property-details-by-account?AccountId=${accountId}`));
}

export async function getProperty(propertyId: number): Promise<any> {
  return deduplicatedFetch(`property-${propertyId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/property?propertyId=${propertyId}`));
}

export async function getPartitionDetails(accountId: number): Promise<any> {
  return deduplicatedFetch(`partition-details-${accountId}`,
    () => fetchWithTimeout(`/api/platinum/billing-enquiry/partition-details?accountId=${accountId}`));
}

export async function getPartitionDetailsByUnit(unitPartitionId: number): Promise<any> {
  const cacheKey = `partition-details-unit-${unitPartitionId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/partition-details?unitPartitionId=${unitPartitionId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getUnitPartitionOwner(unitPartitionId: number): Promise<any> {
  const cacheKey = `unit-partition-owner-${unitPartitionId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/unit-partition-owner?unitPartitionId=${unitPartitionId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getAllotmentDescription(allotmentId: number): Promise<any> {
  const cacheKey = `allotment-desc-${allotmentId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/allotment-description-by-id?allotmentId=${allotmentId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getSectionalTitleScheme(accountId: number): Promise<any> {
  const cacheKey = `sectional-title-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/sectional-title-scheme?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getPropertyNotification(accountId: number, finYear?: string): Promise<any> {
  if (!finYear) throw new Error('Financial year is required for property notification');
  const yr = finYear;
  const cacheKey = `property-notification-${accountId}-${yr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/property-notification?accountId=${accountId}&finYear=${encodeURIComponent(yr)}`);
  setCache(cacheKey, data);
  return data;
}

// === SERVICES & METERS ===
export async function getConsumptionUnits(accountId: number): Promise<any[]> {
  const cacheKey = `cons-units-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-unit-by-account?AccountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getConsUnitSearch(query: string): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-unit-search?searchText=${encodeURIComponent(query)}`);
  return normalizeArray(data);
}

export async function getAllServices(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`all-services-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/all-services?accountId=${accountId}`)));
}

export async function getServicesSearchResults(accountId: number): Promise<any[]> {
  return deduplicatedFetch(`services-search-${accountId}`,
    async () => normalizeArray(await fetchWithTimeout(`/api/platinum/billing-enquiry/services-search-results?accountId=${accountId}`)));
}

export async function getMeteredServicesOnAccount(accountId: number): Promise<any[]> {
  const cacheKey = `metered-services-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/metered-services-on-account?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getAccountServiceMeterPerProperty(accountId: number): Promise<any[]> {
  const cacheKey = `account-svc-meter-prop-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/account-service-meter-per-property?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getUnitLinkedMeters(unitId: number): Promise<any[]> {
  const cacheKey = `unit-linked-meters-${unitId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/unit-linked-meters?unitId=${unitId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getMeterReadingHistory(accountId: number, meterNo: string): Promise<any[]> {
  const cacheKey = `meter-history-${accountId}-${meterNo}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/meter-reading-history?accountId=${accountId}&meterNo=${meterNo}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getMeterReadingHistoryBarchart(accountId: number, meterNo: string): Promise<any[]> {
  const cacheKey = `meter-history-bar-${accountId}-${meterNo}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/meter-reading-history-barchart?accountId=${accountId}&meterNo=${meterNo}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getMeterInfoById(meterId: number): Promise<any> {
  const cacheKey = `meter-info-${meterId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/meter-info-by-id?meterId=${meterId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getPrepaidMeterServicesForAccount(accountId: number): Promise<any[]> {
  const cacheKey = `prepaid-meter-svc-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/prepaid-meter-services-for-account?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getPrepaidRechargeDetailsForMeter(meterId: number): Promise<any[]> {
  const cacheKey = `prepaid-recharge-${meterId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/prepaid-recharge-details-for-meter?meterId=${meterId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === TRANSACTIONS ===
export async function getDetailedTransactionResults(accountId: number, finYear: string): Promise<any[]> {
  const cacheKey = `detailed-txn-${accountId}-${finYear}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/detailed-transaction-results?accountId=${accountId}&finYear=${encodeURIComponent(finYear)}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getBillingPeriodTransactions(accountId: number, finYear: string, billingMonth: string, balanceType: number = 3): Promise<any[]> {
  const cacheKey = `billing-period-txn-${accountId}-${finYear}-${billingMonth}-${balanceType}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-billing-period-transactions?accountId=${accountId}&finYear=${encodeURIComponent(finYear)}&billingMonth=${encodeURIComponent(billingMonth)}&balanceType=${balanceType}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getAllBillingPeriodTransactions(accountId: number, finYear: string): Promise<any[]> {
  const months = ['July','August','September','October','November','December','January','February','March','April','May','June'];
  const results = await Promise.allSettled(
    months.map(month => getBillingPeriodTransactions(accountId, finYear, month))
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

export async function getReceiptTransactionDetail(primaryId: number): Promise<any> {
  const cacheKey = `receipt-txn-detail-${primaryId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/receipt-transaction-detail?primaryId=${primaryId}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

function normalizeDetailResponse(data: any): any[] | string {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('<') || trimmed.includes('<table')) {
      return trimmed;
    }
    try { data = JSON.parse(trimmed); } catch (e) { console.error('[normalizeDetailResponse] Failed to parse JSON string:', e); return []; }
  }
  return normalizeArray(data);
}

export async function getLevyTransactionDetail(primaryId: number): Promise<any[] | string> {
  const cacheKey = `levy-txn-detail-${primaryId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/levy-transaction-detail?primaryId=${primaryId}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getOpenBalanceDetail(primaryId: number | string, billingMonth?: number): Promise<any[] | string> {
  const params = new URLSearchParams({ primaryId: String(primaryId) });
  if (billingMonth !== undefined) params.append('billingMonth', String(billingMonth));
  const cacheKey = `open-bal-detail-${primaryId}-${billingMonth ?? ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/open-balance-detail?${params.toString()}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getCloseBalanceDetail(primaryId: number | string, billingMonth?: number): Promise<any[] | string> {
  const params = new URLSearchParams({ primaryId: String(primaryId) });
  if (billingMonth !== undefined) params.append('billingMonth', String(billingMonth));
  const cacheKey = `close-bal-detail-${primaryId}-${billingMonth ?? ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/close-balance-detail?${params.toString()}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getJournalTransactionDetails(primaryId: number | string, accountId: number): Promise<any[] | string> {
  const cacheKey = `journal-txn-detail-${primaryId}-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/journal-transaction-details?primaryId=${primaryId}&accountId=${accountId}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getRebateTransactionDetail(primaryId: number | string): Promise<any[] | string> {
  const cacheKey = `rebate-txn-detail-${primaryId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/rebate-transaction-detail?primaryId=${primaryId}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getInterestConsPaymentDetail(accountId: number, finYear?: string): Promise<any[] | string> {
  const params = new URLSearchParams({ accountId: String(accountId) });
  if (finYear) params.append('finYear', finYear);
  const cacheKey = `interest-cons-payment-${accountId}-${finYear ?? ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/interest-cons-payment-detail?${params.toString()}`);
  const result = normalizeDetailResponse(data);
  setCache(cacheKey, result);
  return result;
}

export async function getInterestLatePaymentDetail(accountId: number): Promise<any[]> {
  const cacheKey = `interest-late-payment-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/interest-late-payment-detail?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getTransactionHistory(accountNumber: string, accountId?: number): Promise<any[]> {
  const cacheKey = `txn-history-${accountNumber}-${accountId ?? ''}`;
  const cached = getCached(cacheKey, SHORT_CACHE_TTL);
  if (cached) return cached;

  if (accountId) {
    try {
      const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-amount-by-account-ids?accountId=${accountId}`);
      const items = normalizeArray(data);
      if (items.length > 0) {
        const result = items.map((r: any) => ({
          receiptNo: r.receiptNo || '-',
          receiptId: r.receiptID || r.receiptId,
          receiptDate: r.receiptDate,
          paymentType: r.paymentType || '-',
          paymentOption: r.paymentOption || '-',
          amount: r.amount ?? 0,
          tenderAmount: r.tenderAmount ?? r.amount ?? 0,
          changeAmount: r.changeAmount ?? 0,
          cashierName: r.cashier || r.cashierName || '-',
          cashBook: r.cashBook || '-',
          cardChequeDetail: r.cardChequeDetail || '',
          isCancelled: !!(r.cancelReson || r.isCancelled),
          cancelReason: r.cancelReson || r.cancelReason || '',
          billId: r.billId || r.billID || r.bill_ID || null,
          posItemId: r.posItemId || r.posItem_ID || r.posItemID || null,
          bankStatementNote: r.note || r.bankStatementNote || '',
        }));
        setCache(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.error('[getTransactionHistory] Failed to fetch payment-amount-by-account-ids:', e);
    }
  }

  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 2);
  const body = {
    accountNumber,
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    page: 1,
    pageSize: 200,
    orderby: 'receiptDate',
    shortDirection: 'desc',
  };
  const data = await fetchWithTimeout('/api/platinum/view-receipt/get-receipt-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const items = normalizeArray(data);
  if (items.length > 0) {
    setCache(cacheKey, items);
    return items;
  }

  return [];
}

export async function getBankStatementNotes(posItemIds: number[]): Promise<Record<string, string>> {
  if (!posItemIds.length) return {};
  const cacheKey = `bank-notes-${posItemIds.sort().join(',')}`;
  const cached = getCached(cacheKey, SHORT_CACHE_TTL);
  if (cached) return cached;
  const data = await fetchWithTimeout('/api/platinum/bank-statement-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posItemIds }),
  });
  if (data && typeof data === 'object') {
    setCache(cacheKey, data);
    return data;
  }
  return {};
}

export async function getBankStatementNotesByAccount(accountId: number): Promise<Record<string, string>> {
  const cacheKey = `bank-notes-acct-${accountId}`;
  const cached = getCached(cacheKey, SHORT_CACHE_TTL);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/bank-statement-notes-by-account?accountId=${accountId}`);
  if (data && typeof data === 'object' && !data.message) {
    setCache(cacheKey, data);
    return data;
  }
  return {};
}

export async function getEftBankStatementNotesForAccount(accountId: number): Promise<any[]> {
  const cacheKey = `eft-bank-notes-acct-${accountId}`;
  const cached = getCached(cacheKey, SHORT_CACHE_TTL);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-eft-bank-statement-notes?accountId=${accountId}`);
  const result = normalizeArray(data);
  if (result.length > 0) {
    setCache(cacheKey, result);
  }
  return result;
}

// === PAYMENTS ===
export async function getPaymentAmountByAccountIds(accountId: number): Promise<any[]> {
  const cacheKey = `payment-amount-${accountId}`;
  const cached = getCached(cacheKey, SHORT_CACHE_TTL);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-amount-by-account-ids?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getPaymentPlansByAccountId(accountId: number): Promise<any[]> {
  const cacheKey = `payment-plans-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-plans-by-account-id?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getPaymentPlanRemainingCapital(accountId: number): Promise<any> {
  const cacheKey = `payment-plan-remaining-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-plan-remaining-capital?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getRepaymentPlanStatus(accountId: number): Promise<any> {
  const cacheKey = `repayment-plan-status-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/repayment-plan-status?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getPaymentExtensionSearchResults(accountId: number): Promise<any[]> {
  const cacheKey = `payment-ext-search-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-extension-search-results?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === INCENTIVES ===
export async function getPaymentIncentive(accountId: number): Promise<any> {
  const cacheKey = `payment-incentive-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-incentive-by-account?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getPaymentIncentiveJournals(accountId: number): Promise<any[]> {
  const cacheKey = `payment-incentive-journals-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-incentive-journals?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === DEPOSITS ===
export async function getDeposits(accountId: number): Promise<any[]> {
  const cacheKey = `deposits-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/deposits-by-account-id?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getDepositAmount(accountId: number): Promise<any> {
  const cacheKey = `deposit-amount-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/deposit-amount?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

// === HANDOVER ===
export async function getHandoverInfo(accountId: number): Promise<any> {
  const cacheKey = `handover-info-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/handover-by-account?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getHandoverAccountEnquiry(accountId: number): Promise<any> {
  const cacheKey = `handover-account-enquiry-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/handover-account-enquiry?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getConsHandoverTransactionDetail(accountId: number): Promise<any[]> {
  const cacheKey = `cons-handover-txn-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-handover-transaction-detail?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === DEBIT ORDERS ===
export async function getDebitOrderDeductionByAccount(accountId: number): Promise<any[]> {
  const cacheKey = `debit-order-by-account-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/debit-order-deduction-by-account?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getDebitOrderDeduction(accountId: number): Promise<any[]> {
  const cacheKey = `debit-order-deduction-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-debit-order-deduction?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === RATES & VALUATIONS ===
export async function getValuationById(propertyId: number): Promise<any> {
  const cacheKey = `valuation-${propertyId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-by-id?propertyId=${propertyId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getValuationByUnit(unitId: number): Promise<any> {
  const cacheKey = `valuation-unit-${unitId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-by-unit?unitId=${unitId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getValuationImportById(propertyId: number): Promise<any> {
  const cacheKey = `valuation-import-${propertyId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-import-by-id?propertyId=${propertyId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getSupplementaryValuations(propertyId: number): Promise<any[]> {
  const cacheKey = `supplementary-valuations-${propertyId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/supplementary-valuations?propertyId=${propertyId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getRatesRunHistory(accountId: number, finYear?: string): Promise<any[]> {
  const yr = finYear || getCurrentFinYear();
  const cacheKey = `rates-run-history-${accountId}-${yr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/rates-run-history?accountId=${accountId}&finYear=${encodeURIComponent(yr)}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getAccountRatesDetails(accountId: number, finYear?: string): Promise<any> {
  const yr = finYear || getCurrentFinYear();
  const cacheKey = `account-rates-details-${accountId}-${yr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/account-rates-details?accountId=${accountId}&finYear=${encodeURIComponent(yr)}`);
  setCache(cacheKey, data);
  return data;
}

function getCurrentFinYear(): string {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

// === CHEQUES ===
export async function getChequeFinalSearchList(accountId: number): Promise<any[]> {
  const cacheKey = `cheque-final-search-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cheque-final-search-list?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function getChequeWriteBackDetail(chequeId: number): Promise<any> {
  const cacheKey = `cheque-write-back-${chequeId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cheque-write-back-detail?chequeId=${chequeId}`);
  setCache(cacheKey, data);
  return data;
}

// === BILLED VS PAID ===
export async function getBilledVsPaidAmounts(accountId: number, financialYear?: string): Promise<any[]> {
  if (!financialYear) throw new Error('Financial year is required for billed vs paid');
  const yr = financialYear;
  const cacheKey = `billed-vs-paid-${accountId}-${yr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/billed-vs-paid-amounts?accountId=${accountId}&financialYear=${encodeURIComponent(yr)}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === CLEARANCE ===
export async function getClearanceInquiries(accountId: number, propertyId?: number): Promise<any[]> {
  const cacheKey = propertyId ? `clearance-inquiries-prop-${propertyId}` : `clearance-inquiries-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  if (propertyId) {
    const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/clearance-inquiries?propertyId=${propertyId}`);
    const result = normalizeArray(data);
    setCache(cacheKey, result);
    return result;
  }
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/clearance-inquiries?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export function downloadClearanceDocument(costScheduleId: number | string, type: 'cost-schedule' | 'clearance-certificate'): void {
  window.open(resolveApiUrl(`/api/platinum/clearance-document-download?costScheduleId=${costScheduleId}&type=${type}`), '_blank');
}

// === BANK GUARANTEE ===
export async function getBankGuaranteeHistory(accountId: number): Promise<any[]> {
  const cacheKey = `bank-guarantee-history-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/bank-guarantee-history?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === SECTION 129 ===
export async function getSection129AccountEnquiry(accountId: number): Promise<any> {
  const cacheKey = `section129-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/section129-account-enquiry?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

// === OCCUPIERS ===
export async function getOccupiers(accountId: number): Promise<any[]> {
  const cacheKey = `occupiers-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/add-occupiers?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

export async function addOccupier(body: any): Promise<any> {
  const result = await fetchWithTimeout('/api/platinum/billing-enquiry/add-occupier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  clearEnquiryCache(body.accountId);
  return result;
}

export async function deleteOccupier(occupierId: number): Promise<any> {
  const result = await fetchWithTimeout(`/api/platinum/billing-enquiry/add-occupier?occupierId=${occupierId}`, {
    method: 'DELETE',
  });
  return result;
}

// === STATEMENTS ===
export async function getGeneratedStatements(accountId: number): Promise<any[]> {
  const cacheKey = `generated-statements-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/generated-statements-by-id?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === BILLING TEMPLATES ===
export async function getBillingTemplate(accountId: number): Promise<any> {
  const cacheKey = `billing-template-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/billing-template?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

export async function getDetailBillingTemplate(accountId: number): Promise<any> {
  const cacheKey = `detail-billing-template-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/detail-billing-template?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

// === BILLING ===
export async function getBillingProcessingMonth(): Promise<any> {
  const cacheKey = `billing-processing-month`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/billing-processing-month');
  setCache(cacheKey, data);
  return data;
}

export async function getBillingCalculationPopupData(accountId: number): Promise<any> {
  const cacheKey = `billing-calc-popup-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/billing-calculation-popup-data?accountId=${accountId}`);
  setCache(cacheKey, data);
  return data;
}

// === ADDITIONAL BILLING ===
export async function getAdditionalBillingSearchResults(accountId: number): Promise<any[]> {
  const cacheKey = `additional-billing-search-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/additional-billing-search-results?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === PERIODS ===
export async function getPeriods(): Promise<any[]> {
  const cacheKey = `periods`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/periods');
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === DEBTOR NOTES ===
export async function getDebtorNoteLists(accountId: number): Promise<any[]> {
  const cacheKey = `debtor-note-lists-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/debtor-note-lists?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === ATTP APPLICATION HISTORY ===
export async function getAttpApplicationHistory(accountId: number): Promise<any[]> {
  const cacheKey = `attp-app-history-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/attp-application-history?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === TRANSFER OWNERSHIP ===
export async function getTransferOwnership(accountId: number): Promise<any[]> {
  const cacheKey = `transfer-ownership-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/transfer-ownership?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === LINKED ACCOUNTS ON PROPERTY ===
export async function getLinkedAccountsOnProperty(accountId: number): Promise<any[]> {
  const cacheKey = `linked-accounts-prop-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/linked-accounts-on-property?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === DEPARTMENTAL ACCOUNTS ===
export async function getDepartmentalAccountsById(accountId: number): Promise<any[]> {
  const cacheKey = `departmental-accounts-${accountId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/departmental-accounts-by-id?accountId=${accountId}`);
  const result = normalizeArray(data);
  setCache(cacheKey, result);
  return result;
}

// === REBUILD / CONFIG ===
export async function rebuildFullAccount(accountId: number): Promise<any> {
  const result = await fetchWithTimeout(`/api/platinum/billing-enquiry/rebuild-full-account?accountId=${accountId}`);
  clearEnquiryCache(accountId);
  return result;
}

export async function getRebuildAccountSSCheck(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/get-rebuild-account-ss-check?accountId=${accountId}`);
}

export async function reconcile(receiptId: number, body?: any): Promise<any> {
  const result = await fetchWithTimeout(`/api/platinum/billing-enquiry/reconcile/${receiptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (body?.accountId) clearEnquiryCache(body.accountId);
  return result;
}

export async function getLookups(): Promise<any> {
  const cacheKey = `lookups`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/lookups');
  setCache(cacheKey, data);
  return data;
}

// === PREFETCH ===
export async function prefetchAccountData(accountId: number): Promise<void> {
  const critical = [
    getBasicAccountDetails(accountId),
    getAccountInfoResult(accountId),
    getPropertyDetails(accountId),
    getAccountInformation(accountId),
    getDepositAmount(accountId),
    getNameInfo(accountId),
    getAccountBalance(accountId),
  ];
  await Promise.allSettled(critical);

  const secondary = [
    getAllServices(accountId),
    getContactDetails(accountId),
    getSectionalTitleScheme(accountId),
    getAccountNotifications(accountId),
    getServiceTypeBalance(accountId),
    getDeposits(accountId),
    getPaymentIncentive(accountId),
    getHandoverInfo(accountId),
    getDepartmentalAccountsById(accountId),
    getRepaymentPlanStatus(accountId),
    getAccountDeliveryAddressDetail(accountId),
    getServicesSearchResults(accountId),
    getAdditionalBillingSearchResults(accountId),
    getChequeFinalSearchList(accountId),
    getConsumptionUnits(accountId),
  ];
  Promise.allSettled(secondary);
}
