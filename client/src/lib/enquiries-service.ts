const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
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

function normalizeArray(data: any): any[] {
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
  const body: Record<string, any> = {};
  if (criteria.accountNo) body.accountID = criteria.accountNo;
  if (criteria.oldAccountCode) body.oldAccount = criteria.oldAccountCode;
  if (criteria.name) body.companyName = criteria.name;
  if (criteria.idNo) body.idRegistrationNumber = criteria.idNo;
  if (criteria.passportNumber) body.passportNumber = criteria.passportNumber;
  if (criteria.locationAddress) body.locationAddress = criteria.locationAddress;
  if (criteria.mobileNumber) body.mobileNumber = criteria.mobileNumber;
  if (criteria.physicalMeterNumber) body.physicalMeterNumber = criteria.physicalMeterNumber;

  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/enquiry-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeArray(data);
}

export async function billingEnquirySearch(body: any): Promise<any[]> {
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeArray(data);
}

export async function autocomplete(query: string): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/autocomplete?searchText=${encodeURIComponent(query)}`);
  return normalizeArray(data);
}

// === ACCOUNT INFO ===
export async function getBasicAccountDetails(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/basic-account-details?accountId=${accountId}`);
}

export async function getAccountInfoResult(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/account-info-result?accountId=${accountId}`);
}

export async function getAccountInformation(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-account-management/account-information?accountId=${accountId}`);
}

export async function getAccountDeliveryAddressDetail(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/account-delivery-address-detail?accountId=${accountId}`);
}

export async function getDeliveryAccountDetailsById(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/delivery-account-details-by-id?accountId=${accountId}`);
}

export async function getAccountNotifications(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/account-notifications?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getAccountInquiries(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/account-inquiries?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getAccountStatus(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/get-status?accountId=${accountId}`);
}

// === CONTACT / NAME ===
export async function getNameInfo(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`);
}

export async function getContactDetails(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`);
}

export async function getContactDetailsHistory(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/contact-details-history-by-id?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getDeliveryAddressHistory(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/delivery-address-history-by-id?accountId=${accountId}`);
  return normalizeArray(data);
}

// === BALANCE & DEBT ===
export async function getAccountBalance(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/total-balance-debt?accountId=${accountId}`);
}

export async function getServiceTypeBalance(accountId: number, financialYear?: string): Promise<any[]> {
  const yr = financialYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/service-type-balance?accountId=${accountId}&financialYear=${encodeURIComponent(yr)}`);
  return normalizeArray(data);
}

// === PROPERTY ===
export async function getPropertyDetails(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/property-details-by-account?AccountId=${accountId}`);
}

export async function getProperty(propertyId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/property?propertyId=${propertyId}`);
}

export async function getPartitionDetails(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/partition-details?accountId=${accountId}`);
}

export async function getPartitionDetailsByUnit(unitPartitionId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/partition-details?unitPartitionId=${unitPartitionId}`);
}

export async function getUnitPartitionOwner(unitPartitionId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/unit-partition-owner?unitPartitionId=${unitPartitionId}`);
}

export async function getAllotmentDescription(allotmentId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/allotment-description-by-id?allotmentId=${allotmentId}`);
}

export async function getSectionalTitleScheme(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/sectional-title-scheme?accountId=${accountId}`);
}

export async function getPropertyNotification(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/property-notification?accountId=${accountId}`);
}

// === SERVICES & METERS ===
export async function getConsumptionUnits(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-unit-by-account?AccountId=${accountId}`);
  return normalizeArray(data);
}

export async function getConsUnitSearch(query: string): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-unit-search?searchText=${encodeURIComponent(query)}`);
  return normalizeArray(data);
}

export async function getAllServices(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/all-services?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getServicesSearchResults(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/services-search-results?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getMeteredServicesOnAccount(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/metered-services-on-account?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getAccountServiceMeterPerProperty(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/account-service-meter-per-property?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getUnitLinkedMeters(unitId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/unit-linked-meters?unitId=${unitId}`);
  return normalizeArray(data);
}

export async function getMeterReadingHistory(meterId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/meter-reading-history?meterId=${meterId}`);
  return normalizeArray(data);
}

export async function getMeterReadingHistoryBarchart(meterId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/meter-reading-history-barchart?meterId=${meterId}`);
  return normalizeArray(data);
}

export async function getMeterInfoById(meterId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/meter-info-by-id?meterId=${meterId}`);
}

export async function getPrepaidMeterServicesForAccount(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/prepaid-meter-services-for-account?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getPrepaidRechargeDetailsForMeter(meterId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/prepaid-recharge-details-for-meter?meterId=${meterId}`);
  return normalizeArray(data);
}

// === TRANSACTIONS ===
export async function getDetailedTransactionResults(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/detailed-transaction-results?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getBillingPeriodTransactions(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-billing-period-transactions?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getReceiptTransactionDetail(primaryId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/receipt-transaction-detail?primaryId=${primaryId}`);
}

export async function getLevyTransactionDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/levy-transaction-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getOpenBalanceDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/open-balance-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getCloseBalanceDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/close-balance-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getJournalTransactionDetails(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/journal-transaction-details?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getRebateTransactionDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/rebate-transaction-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getInterestConsPaymentDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/interest-cons-payment-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getInterestLatePaymentDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/interest-late-payment-detail?accountId=${accountId}`);
  return normalizeArray(data);
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
  return normalizeArray(data);
}

// === PAYMENTS ===
export async function getPaymentAmountByAccountIds(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-amount-by-account-ids?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getPaymentPlansByAccountId(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-plans-by-account-id?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getPaymentPlanRemainingCapital(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/payment-plan-remaining-capital?accountId=${accountId}`);
}

export async function getRepaymentPlanStatus(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/repayment-plan-status?accountId=${accountId}`);
}

export async function getPaymentExtensionSearchResults(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-extension-search-results?accountId=${accountId}`);
  return normalizeArray(data);
}

// === INCENTIVES ===
export async function getPaymentIncentive(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/payment-incentive-by-account?accountId=${accountId}`);
}

export async function getPaymentIncentiveJournals(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/payment-incentive-journals?accountId=${accountId}`);
  return normalizeArray(data);
}

// === DEPOSITS ===
export async function getDeposits(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/deposits-by-account-id?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getDepositAmount(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/deposit-amount?accountId=${accountId}`);
}

// === HANDOVER ===
export async function getHandoverInfo(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/handover-by-account?accountId=${accountId}`);
}

export async function getHandoverAccountEnquiry(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/handover-account-enquiry?accountId=${accountId}`);
}

export async function getConsHandoverTransactionDetail(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cons-handover-transaction-detail?accountId=${accountId}`);
  return normalizeArray(data);
}

// === DEBIT ORDERS ===
export async function getDebitOrderDeductionByAccount(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/debit-order-deduction-by-account?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getDebitOrderDeduction(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/get-debit-order-deduction?accountId=${accountId}`);
  return normalizeArray(data);
}

// === RATES & VALUATIONS ===
export async function getValuationById(propertyId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-by-id?propertyId=${propertyId}`);
}

export async function getValuationByUnit(unitId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-by-unit?unitId=${unitId}`);
}

export async function getValuationImportById(propertyId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/valuation-import-by-id?propertyId=${propertyId}`);
}

export async function getSupplementaryValuations(propertyId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/supplementary-valuations?propertyId=${propertyId}`);
  return normalizeArray(data);
}

export async function getRatesRunHistory(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/rates-run-history?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getAccountRatesDetails(accountId: number, finYear?: string): Promise<any> {
  const yr = finYear || new Date().getFullYear().toString();
  return fetchWithTimeout(`/api/platinum/billing-enquiry/account-rates-details?accountId=${accountId}&finYear=${encodeURIComponent(yr)}`);
}

// === CHEQUES ===
export async function getChequeFinalSearchList(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/cheque-final-search-list?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function getChequeWriteBackDetail(chequeId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/cheque-write-back-detail?chequeId=${chequeId}`);
}

// === CLEARANCE ===
export async function getClearanceInquiries(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/clearance-inquiries?accountId=${accountId}`);
  return normalizeArray(data);
}

// === BANK GUARANTEE ===
export async function getBankGuaranteeHistory(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/bank-guarantee-history?accountId=${accountId}`);
  return normalizeArray(data);
}

// === SECTION 129 ===
export async function getSection129AccountEnquiry(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/section129-account-enquiry?accountId=${accountId}`);
}

// === OCCUPIERS ===
export async function getOccupiers(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/add-occupiers?accountId=${accountId}`);
  return normalizeArray(data);
}

export async function addOccupier(body: any): Promise<any> {
  return fetchWithTimeout('/api/platinum/billing-enquiry/add-occupier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteOccupier(occupierId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/add-occupier?occupierId=${occupierId}`, {
    method: 'DELETE',
  });
}

// === STATEMENTS ===
export async function getGeneratedStatements(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/generated-statements-by-id?accountId=${accountId}`);
  return normalizeArray(data);
}

// === BILLING TEMPLATES ===
export async function getBillingTemplate(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/billing-template?accountId=${accountId}`);
}

export async function getDetailBillingTemplate(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/detail-billing-template?accountId=${accountId}`);
}

// === BILLING ===
export async function getBillingProcessingMonth(): Promise<any> {
  return fetchWithTimeout('/api/platinum/billing-enquiry/billing-processing-month');
}

export async function getBillingCalculationPopupData(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/billing-calculation-popup-data?accountId=${accountId}`);
}

// === ADDITIONAL BILLING ===
export async function getAdditionalBillingSearchResults(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/additional-billing-search-results?accountId=${accountId}`);
  return normalizeArray(data);
}

// === PERIODS ===
export async function getPeriods(): Promise<any[]> {
  const data = await fetchWithTimeout('/api/platinum/billing-enquiry/periods');
  return normalizeArray(data);
}

// === DEBTOR NOTES ===
export async function getDebtorNoteLists(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/debtor-note-lists?accountId=${accountId}`);
  return normalizeArray(data);
}

// === ATTP APPLICATION HISTORY ===
export async function getAttpApplicationHistory(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/attp-application-history?accountId=${accountId}`);
  return normalizeArray(data);
}

// === TRANSFER OWNERSHIP ===
export async function getTransferOwnership(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/transfer-ownership?accountId=${accountId}`);
  return normalizeArray(data);
}

// === DEPARTMENTAL ACCOUNTS ===
export async function getDepartmentalAccountsById(accountId: number): Promise<any[]> {
  const data = await fetchWithTimeout(`/api/platinum/billing-enquiry/departmental-accounts-by-id?accountId=${accountId}`);
  return normalizeArray(data);
}

// === REBUILD / CONFIG ===
export async function rebuildFullAccount(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/rebuild-full-account?accountId=${accountId}`);
}

export async function getRebuildAccountSSCheck(accountId: number): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/get-rebuild-account-ss-check?accountId=${accountId}`);
}

export async function reconcile(receiptId: number, body?: any): Promise<any> {
  return fetchWithTimeout(`/api/platinum/billing-enquiry/reconcile/${receiptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

export async function getLookups(): Promise<any> {
  return fetchWithTimeout('/api/platinum/billing-enquiry/lookups');
}
