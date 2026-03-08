import { resolveApiUrl, getAuthHeaders } from "./pos-config-context";

const LOG_ENABLED = true;
function apiLog(tag: string, ...args: unknown[]): void {
    if (LOG_ENABLED) console.log(`[${tag}]`, ...args);
}

function apiFetch(url: string, init?: RequestInit): Promise<Response> {
    const resolved = resolveApiUrl(url);
    const authHeaders = getAuthHeaders();
    const mergedHeaders = {
        ...authHeaders,
        ...(init?.headers instanceof Headers
            ? Object.fromEntries(init.headers.entries())
            : (init?.headers as Record<string, string>) || {}),
    };
    return fetch(resolved, { ...init, headers: mergedHeaders, credentials: "include" });
}

export interface EasyPayBill {
  id: string;
  reference: string;
  billerName: string;
  accountName: string;
  amount: number;
  dueDate: string;
  status: "unpaid" | "paid";
}

export interface Account {
  accountNo: string;
  name: string;
  idNo: string;
  sgNo: string;
  address: string;
  outstandingAmount: number;
  prepaidMeterNo?: string;
  prepaidType?: "Electricity" | "Water";
  email: string;
  mobile: string;
  apiId?: number;
  linkedToClearance?: string;
  unitId?: string;
  oldCode?: string;
  accountType?: string;
  status?: string;
  deliveryAddress?: string;
  valuationCategory?: string;
  marketValue?: number;
  agingBreakdown?: AgingItem[];
  prepaidBlocked?: boolean;
  prepaidBlockReason?: string;
  blockedServices?: string[];
  apiId?: number;
  accountGroup?: string;
  subAccountGroup?: string;
  paymentGroup?: string;
  locationAddress?: string;
  propertyId?: string;
  addName?: string;
  contactDetails?: string;
  unitPartitionId?: number;
  paidDepositAmount?: number;
  billingCycle?: string;
  firstName?: string;
  surname?: string;
  nameId?: number;
  oldPropertyCode?: string;
  registrationStatus?: string;
  allotmentArea?: string;
  propertyType?: string;
  magisterialDistrict?: string;
  propertyTypeOfUse?: string;
  propertyCategory?: string;
  partitionDescription?: string;
  interestWaiverStatus?: string;
  indigentSubsidyStatus?: string;
  consumerRppStatus?: string;
  departmentalAccount?: string;
  rebateStatus?: string;
  handoverStatus?: string;
  loanRppStatus?: string;
  incentiveSchemeCode?: string;
  sectionalTitleScheme?: string;
  farmName?: string;
  propertyStatus?: string;
  accountableOwnerName?: string;
  partitionMarketValue?: number;
}

export interface AgingItem {
  serviceDescription: string;
  totalOutstanding: number;
  newCharge: number;
  currentAccount: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  days150: number;
  days180Plus: number;
}

export interface DirectIncomeItem {
  id: string;
  groupName: string;
  description: string;
  scoaItem: string;
  vatRate: number;
  price?: number;
}

export interface AccountGroup {
  id: string;
  name: string;
  memberAccountNos: string[];
}

export interface ClearanceCostSchedule {
  scheduleNo: string;
  costScheduleID: number;
  status: string;
  totalDue: number;
  linkedAccounts: Account[];
  section118_1_Breakdown: { item: string; amount: number; accountNo: string }[];
  section118_3_Breakdown: { item: string; amount: number; accountNo: string }[];
  clearanceData?: {
    sgNumber: string;
    locationAddress: string;
    expiryDate: string;
    accountName: string;
    paid: number;
    total: number;
    remaining: number;
  };
}

export interface CashOffice {
  id: string;
  name: string;
  ledgerVote: string;
  maxTransactionLimit: number;
}

export interface CashierProfile {
  id: string;
  name: string;
  role: string;
  cashOffice: string;
  float: number;
}

export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference: string;
  status: 'UNMATCHED' | 'DRAFT' | 'ALLOCATED' | 'REVERSED' | 'PROCESSING' | 'ERROR';
  allocatedAmount: number;
  bankAccount: string;
}

export interface AllocationLine {
  id: string;
  accountNo: string;
  amount: number;
  description: string;
  allocationType?: 'ACCOUNT' | 'PREPAID' | 'DIRECT' | 'CLEARANCE' | 'GROUP' | 'CASHBOOK';
  accountId?: number;
  groupId?: number;
  miscPaymentGroupId?: number;
  scoaItemId?: number;
  voteId?: number;
  clearanceId?: number;
  costScheduleId?: number;
  outstandingAmount?: number;
  reference?: string;
  note?: string;
  lastName?: string;
  initials?: string;
  vatAmount?: number;
  vatPercentage?: number;
  vatableVote?: number;
  paymentTypeId?: number;
}

export interface AllocationDraft {
  transactionId: string;
  lines: AllocationLine[];
  status: 'DRAFT' | 'POSTED' | 'PROCESSING';
  updatedAt: string;
  method: 'MANUAL' | 'BULK';
  allocatedBy: string;
  allocationDate: string;
  bulkJobStatus?: 'Processing' | 'Performing rebuilds' | 'Completing reconciliation' | 'Bulk allocations complete' | 'Error';
  allocationType?: 'DIRECT_PAYMENT' | 'CLEARANCE_PAYMENT' | 'ACCOUNT_PAYMENT' | 'ELECTRICITY_RECHARGE' | 'WATER_RECHARGE' | 'CSV_FILE';
  fileName?: string;
  fileUrl?: string;
}

export type PlatinumApiPayload = Record<string, unknown>;
export type PlatinumApiResponse = Record<string, unknown>;

export interface AccountSearchCriteria {
    accountNo?: string;
    name?: string;
    idNumber?: string;
    street?: string;
    allotmentArea?: string;
    erfNumber?: string;
    emailAddress?: string;
    mobileNumber?: string;
    physicalMeterNumber?: string;
    trading?: string;
}

export interface PaymentSubmission {
    paymentType: number;
    paymentOption: number;
    accountId: number;
    amount: number;
    receiptNo?: string;
    cashierId?: number;
    userId?: number;
}

export interface DayEndReconcileData {
    userId: number;
    cashierId: number;
    cashCount?: Record<string, number>;
    note?: string;
}

export interface PlatinumUserInfo {
    user_ID: number;
    userName: string;
    firstName: string;
    lastName: string;
    eMail: string;
    enabled: boolean;
    superUser: boolean;
    cashFloat: number;
    finYear: string;
    authMode?: 'direct' | 'azure' | 'override';
}

export async function fetchPlatinumUserInfo(): Promise<PlatinumUserInfo> {
    const res = await apiFetch('/api/platinum/auth/user-info');
    if (!res.ok) {
        let detail = '';
        try { const body = await res.json(); detail = body?.message || body?.error || ''; } catch (err) { console.error('[fetchPlatinumUserInfo] Failed to parse error response:', err); }
        throw new Error(`Failed to fetch user info from Platinum API (status ${res.status})${detail ? ': ' + detail : ''}`);
    }
    return await res.json();
}

export interface Bank {
    id: number;
    bankName: string;
    branchCode: string;
}

export interface GroupCode {
    groupCodeId: number;
    groupCode: string;
    groupDescription: string;
}

export interface Institution {
    institutionId: number;
    institutionName: string;
}

export async function fetchCashOffices(): Promise<CashOffice[]> {
    const res = await apiFetch(`/api/platinum/receipt-prepaid/cash-offices`);
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch cash offices from API (status ${res.status})`);
    }
    const items = await res.json();
    const arr = Array.isArray(items) ? items : [];
    return arr.map((item: any) => ({
        id: item.cashOffice_ID?.toString() || item.cashOfficeId?.toString() || item.id?.toString(),
        name: item.cashOfficeDesc || item.name,
        ledgerVote: item.vote || item.ledgerVote || '',
        maxTransactionLimit: item.cashOnHandLimit || item.maxTransactionLimit || 0
    }));
}

export interface ApiCashier {
    id: string;
    name: string;
    cashOfficeId: string;
    float: number;
}

export async function fetchCashiers(): Promise<ApiCashier[]> {
    const res = await apiFetch(`/api/platinum/view-receipt/get-cashiers`);
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch cashiers from API (status ${res.status})`);
    }
    const items = await res.json();
    const arr = Array.isArray(items) ? items : [];
    return arr.map((c: any) => ({
        id: c.id?.toString() || c.cashierId?.toString(),
        name: c.name || c.cashierName,
        cashOfficeId: c.cashOfficeId?.toString() || '',
        float: c.cashFloat || c.float || 0
    }));
}

export interface BillingConfig {
    receiptingOptions?: any;
    allowPrepaidAndMiscellaneous?: boolean;
    allowPrepaidAndRecovery?: boolean;
    allowNormalReceipting?: boolean;
}

export async function fetchBillingConfig(): Promise<BillingConfig | null> {
    const res = await apiFetch(`/api/platinum/billing-config`);
    if (!res.ok) {
        throw new Error(`Failed to fetch billing config from API (status ${res.status})`);
    }
    const data = await res.json();
    return {
        allowPrepaidAndMiscellaneous: data["Allow Prepaid And Miscellaneous"] === "1",
        allowPrepaidAndRecovery: data["Allow Prepaid And Recovery"] === "1",
        allowNormalReceipting: data["Allow Normal Receipting"] === "1",
        receiptingOptions: data
    } as BillingConfig;
}

// === CASHIER PAYMENT OPTIONS & TYPES ===

export interface CashierPaymentOption {
    posPaymentOption_ID: number;
    posPaymentOptionDesc: string;
    isTicked: boolean;
    enabled: boolean;
}

export interface CashierPaymentType {
    posPaymentType_ID: number;
    posPaymentTypeDesc: string;
    isTicked: boolean;
    enabled: boolean;
}

export async function fetchCashierPaymentOptions(
    cashierId: number,
    userId?: number,
    cashofficeId?: number,
    officeOnly?: boolean
): Promise<{ source: string; data: CashierPaymentOption[] }> {
    const params = new URLSearchParams();
    params.append('userId', String(userId || 0));
    params.append('cashofficeId', String(cashofficeId || 0));
    params.append('cashierId', String(cashierId));
    if (officeOnly) {
        params.append('officeOnly', 'true');
    }
    const res = await apiFetch(`/api/platinum/receipt-prepaid/cashier-payment-options?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch cashier payment options (status ${res.status})`);
    }
    const result = await res.json();
    apiLog('PaymentOptions', `Loaded for cashier ${cashierId}, userId=${userId}, officeId=${cashofficeId}, officeOnly=${officeOnly} (source: ${result.source}):`, result.data?.length, 'options');
    if (result.data) {
        result.data.forEach((opt: CashierPaymentOption) => {
            apiLog('PaymentOptions', `  ${opt.posPaymentOption_ID}: ${opt.posPaymentOptionDesc} — isTicked=${opt.isTicked}, enabled=${opt.enabled}`);
        });
    }
    return result;
}

export async function fetchCashierPaymentTypes(
    cashierId: number,
    userId?: number,
    cashofficeId?: number,
    officeOnly?: boolean
): Promise<{ source: string; data: CashierPaymentType[] }> {
    const params = new URLSearchParams();
    params.append('userId', String(userId || 0));
    params.append('cashofficeId', String(cashofficeId || 0));
    params.append('cashierId', String(cashierId));
    if (officeOnly) {
        params.append('officeOnly', 'true');
    }
    const res = await apiFetch(`/api/platinum/receipt-prepaid/cashier-payment-types?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch cashier payment types (status ${res.status})`);
    }
    const result = await res.json();
    apiLog('PaymentTypes', `Loaded for cashier ${cashierId}, userId=${userId}, officeId=${cashofficeId}, officeOnly=${officeOnly} (source: ${result.source}):`, result.data?.length, 'types');
    if (result.data) {
        result.data.forEach((t: CashierPaymentType) => {
            apiLog('PaymentTypes', `  ${t.posPaymentType_ID}: ${t.posPaymentTypeDesc} — isTicked=${t.isTicked}, enabled=${t.enabled}`);
        });
    }
    return result;
}

export interface ReceiptRangeValidation {
    valid: boolean;
    reason: string;
    isActive?: boolean;
    cashierDetailsId?: number;
    officeId?: number | null;
    officeName?: string | null;
}

export async function validateReceiptRange(
    userId: number,
    cashierId?: number,
    finYear?: string,
    officeId?: number
): Promise<ReceiptRangeValidation> {
    try {
        const params = new URLSearchParams();
        params.append('userId', String(userId));
        if (cashierId) params.append('cashierId', String(cashierId));
        if (finYear) params.append('finYear', finYear);
        if (officeId) params.append('officeId', String(officeId));
        const res = await apiFetch(`/api/platinum/receipt-prepaid/validate-receipt-range?${params.toString()}`);
        if (res.ok) {
            const result = await res.json();
            apiLog('ReceiptRange', `Validation result for userId=${userId}:`, result);
            return result;
        }
        console.warn(`[ReceiptRange] API returned ${res.status}`);
        return { valid: false, reason: `Receipt range validation failed (HTTP ${res.status})` };
    } catch (e) {
        console.warn("Failed to validate receipt range", e);
        return { valid: false, reason: "Unable to reach receipt range validation API" };
    }
}

// Maps our internal TransactionType to the Platinum payment option IDs
// This mapping should be verified against the actual Const_POSPaymentOption_sys table
// once the developer confirms the exact IDs
export function mapTransactionTypeToPaymentOptionId(type: string): number | null {
    const mapping: Record<string, number> = {
        'CONSUMER_SERVICES': 1,
        'MULTI_ACCOUNT': 1,
        'ACCOUNT_GROUP': 3,
        'DIRECT_INCOME': 2,
        'CLEARANCE': 4,
        'PREPAID': 5,
    };
    return mapping[type] ?? null;
}

export async function fetchBillingStageCashierReceiptDetails(referenceId: string): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('referenceId', referenceId);
    const res = await apiFetch(`/api/platinum/billing-stage-cashier-receipt-details/reference?${params.toString()}`);
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch receipt details for referenceId ${referenceId} (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.value || []);
}

export interface PosMultiReceiptPrintItem {
    receiptNo: string | null;
    cashOfficeName: string | null;
    billType: string | null;
    amount: number | null;
    vatAmount: number | null;
    amountInWord: string | null;
    payMode: string | null;
    accountId: string | null;
    oldAccountCode: string | null;
    sgNumber: string | null;
    accAddress: string | null;
    accName: string | null;
    prePaidUnit: string | null;
    receiptDate: string | null;
    paymentDate: string | null;
    billTypeId: number | null;
    cutOffAmount: number | null;
    isCancelled: boolean | null;
    tenderAmount: number | null;
    changeAmount: number | null;
    paymentTypeId: number | null;
    cashierName: string | null;
    outstandingAmount: number | null;
    _serviceAllocations?: { service: string; amount: number; vat: number; total: number }[];
    _viewPaymentOption?: string;
}

export async function fetchPosMultiReceiptPrint(receiptId: string, maxRetries: number = 2, receiptNo?: string): Promise<PosMultiReceiptPrintItem[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const params = new URLSearchParams();
            params.append('receiptId', receiptId);
            if (receiptNo) params.append('receiptNo', receiptNo);
            const res = await apiFetch(`/api/platinum/pos-multi-receipt-print?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data) ? data : (data.value || []);
                if (items.length > 0) return items;
                if (attempt < maxRetries) {
                    const delay = 300 * attempt;
                    console.log(`[ReceiptFetch] receiptId ${receiptId} returned empty on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            } else if (attempt < maxRetries) {
                const delay = 300 * attempt;
                console.log(`[ReceiptFetch] receiptId ${receiptId} returned ${res.status} on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
        } catch (e) {
            if (attempt < maxRetries) {
                const delay = 300 * attempt;
                console.warn(`[ReceiptFetch] receiptId ${receiptId} failed on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`, e);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            console.error(`[ReceiptFetch] receiptId ${receiptId} failed after ${maxRetries} attempts`, e);
            throw e instanceof Error ? e : new Error(`Failed to fetch receipt print for receiptId ${receiptId} after ${maxRetries} attempts`);
        }
    }
    throw new Error(`Failed to fetch receipt print for receiptId ${receiptId}: empty response after ${maxRetries} attempts`);
}

export async function fetchBillingStagePrepaidRecharge(id: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/platinum/billing-stage-prepaid-recharge/${id}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn(`Failed to fetch prepaid recharge for id ${id}`, e);
    }
    return null;
}

export async function fetchBillingStagePrepaidRecovery(identifier: string, type: 'id' | 'reference' = 'id'): Promise<any | null> {
    try {
        let url = '';
        if (type === 'id') {
            url = `/api/platinum/billing-stage-prepaid-recovery/${identifier}`;
        } else {
            const params = new URLSearchParams();
            params.append('reference', identifier);
            url = `/api/platinum/billing-stage-prepaid-recovery/reference?${params.toString()}`;
        }
        const res = await apiFetch(url);
        if (res.ok) {
            const data = await res.json();
            if (type === 'reference' && Array.isArray(data)) {
                return data[0] || null;
            }
            return data;
        }
    } catch (e) {
        console.warn(`Failed to fetch prepaid recovery for ${type} ${identifier}`, e);
    }
    return null;
}

export async function fetchConsAccountById(id: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/platinum/cons-accounts/${id}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn(`Failed to fetch cons account for id ${id}`, e);
    }
    return null;
}

export async function fetchBanks(): Promise<Bank[]> {
    const res = await apiFetch(`/api/platinum/billing-payment-clearance/get-banks`);
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch banks from API (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function fetchGroups(): Promise<GroupCode[]> {
    const res = await apiFetch(`/api/platinum/billing-payment-miscellaneous/get-groups`);
    if (!res.ok) {
        throw new Error(`Failed to fetch groups from API (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function fetchInstitutions(): Promise<any[]> {
    const res = await apiFetch(`/api/platinum/const-institutions`);
    if (!res.ok) {
        throw new Error(`Failed to fetch institutions from API (status ${res.status})`);
    }
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    return arr.map((item: any) => {
        const id = item.accountGroupId || item.accountGroupID || item.institutionID || item.institutionId || item.institution_ID || item.id;
        const name = item.accountGroupDesc || item.accountGroupName || item.institutionDesc || item.institutionName || item.name || '';
        const enabled = item.isEnabled !== undefined ? item.isEnabled : (item.enabled !== undefined ? item.enabled : true);
        return {
            institutionId: id,
            institutionName: name,
            Id: id,
            Description: name,
            IsEnabled: enabled,
            ...item,
        };
    });
}

export interface InstitutionSearchResult {
    institutionDesc: string | null;
    institutionID: number | null;
    groupCodeID: number | null;
    groupCodeDesc: string | null;
    accountID: number | null;
    accountNumber: string | null;
    outStandingAmt: number | null;
    activeServiceCount: number | null;
}

export async function searchInstitutions(query: string): Promise<InstitutionSearchResult[]> {
    const params = new URLSearchParams();
    params.append('name', query);
    const res = await apiFetch(`/api/platinum/const-institutions/search?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`Failed to search institutions from API (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function fetchAccountsByGroup(institutionId: number): Promise<any[]> {
    const res = await apiFetch(`/api/platinum/receipting-account-group-payment/search-accounts-by-group?institutionId=${institutionId}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch accounts for institution ${institutionId} (status ${res.status})`);
    }
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data?.value && Array.isArray(data.value) ? data.value : []);
    return arr;
}

export async function fetchAccounts(criteria: any): Promise<any[]> {
    try {
        const body: Record<string, any> = {};
        if (criteria.accountNo) body.accountID = criteria.accountNo;
        if (criteria.oldAccountCode) body.oldAccount = criteria.oldAccountCode;
        if (criteria.name) body.companyName = criteria.name;
        if (criteria.idNo) body.idRegistrationNumber = criteria.idNo;
        if (criteria.passportNumber) body.passportNumber = criteria.passportNumber;
        if (criteria.deliveryAddress) body.deliveryAddress = criteria.deliveryAddress;
        if (criteria.locationAddress) body.locationAddress = criteria.locationAddress;
        if (criteria.street) body.locationAddress = criteria.street;
        if (criteria.allotmentArea) body.allotmentArea = criteria.allotmentArea;
        if (criteria.erfNumber) body.erfNumber = criteria.erfNumber;
        if (criteria.emailAddress) body.emailAddress = criteria.emailAddress;
        if (criteria.mobileNumber) body.mobileNumber = criteria.mobileNumber;
        if (criteria.physicalMeterNumber) body.physicalMeterNumber = criteria.physicalMeterNumber;
        if (criteria.trading) body.trading = criteria.trading;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await apiFetch('/api/platinum/billing-enquiry/enquiry-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
            if (data?.value && Array.isArray(data.value)) return data.value;
            if (data?.results && Array.isArray(data.results)) return data.results;
            return [];
        }
    } catch (e) {
        console.error("Failed to fetch accounts", e);
    }
    return [];
}

export async function enrichAccountData(account: any): Promise<any> {
    const accountId = account.apiId || account.accountID || account.account_ID;
    if (!accountId) return account;

    const enriched = { ...account };

    try {
        const [consDetails, nameData, contactDetails, balanceDebt] = await Promise.all([
            platinumGetConsAccountDetails(Number(accountId), true).catch((err) => { console.error('[enrichAccountData] Failed to fetch cons account details:', err); return null; }),
            platinumFetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`).catch((err) => { console.error('[enrichAccountData] Failed to fetch name info:', err); return null; }),
            platinumFetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`).catch((err) => { console.error('[enrichAccountData] Failed to fetch contact details:', err); return null; }),
            fetchTotalBalanceDebt(Number(accountId)).catch((err) => { console.error('[enrichAccountData] Failed to fetch balance debt:', err); return null; }),
        ]);

        if (consDetails && !consDetails._error) {
            Object.keys(consDetails).forEach(key => {
                if (key !== '_error' && consDetails[key] !== undefined && consDetails[key] !== null) {
                    enriched[key] = consDetails[key];
                }
            });
            enriched.outstandingAmount = consDetails.outStandingAmt ?? enriched.outstandingAmount;
            enriched.oldCode = consDetails.oldAccountCode || enriched.oldCode;
            enriched.oldPropertyCode = consDetails.oldAccountCode || enriched.oldPropertyCode;
            if (consDetails.deliveryAddress) {
                enriched.deliveryAddress = consDetails.deliveryAddress.replace(/\r\n/g, ', ').replace(/,\s*$/, '');
            }
            enriched.sgNo = consDetails.erfNumber || enriched.sgNo;
            enriched.accountType = consDetails.accountDesc || enriched.accountType;
            enriched.account_ID = consDetails.account_ID || accountId;
            enriched.accountNumber = consDetails.accountNumber || enriched.accountNo;
            enriched.oldAccountCode = consDetails.oldAccountCode || enriched.oldCode;
            enriched.statusDesc = consDetails.statusDesc || enriched.status;
            enriched.accountDesc = consDetails.accountDesc || enriched.accountType;
            enriched.accountHolder = consDetails.name || enriched.name;
            enriched.streetName = consDetails.streetName || '';
            enriched.town = consDetails.town || '';
        }

        if (balanceDebt) {
            let rows: any[] = [];
            if (Array.isArray(balanceDebt)) rows = balanceDebt;
            else if (balanceDebt?.results && Array.isArray(balanceDebt.results)) rows = balanceDebt.results;
            else if (balanceDebt && typeof balanceDebt === 'object' && !balanceDebt._error) rows = [balanceDebt];

            if (rows.length > 0) {
                const totalFromDebt = rows.reduce((sum: number, row: any) => {
                    return sum + (row.totalOutStanding || row.totalOutstanding || 0);
                }, 0);
                const rounded = Math.round(totalFromDebt * 100) / 100;
                enriched.outstandingAmount = rounded;
                enriched.outStandingAmt = rounded;
                apiLog('Enrich', `Account ${accountId} balance from TotalBalanceDebt: R${rounded} (overrides cons-account-details)`);
            }
        }

        if (nameData && typeof nameData === 'object' && nameData.surname_Company) {
            enriched.email = nameData.email || enriched.email;
            enriched.mobile = nameData.tel_Mobile || nameData.tel_Home || enriched.mobile;
            enriched.name = `${nameData.firstNames || ''} ${nameData.surname_Company || ''}`.trim() || enriched.name;
            enriched.idNo = nameData.idNo_RegistrationNo || enriched.idNo;
        }

        if (contactDetails && !contactDetails._error) {
            enriched.email = contactDetails.email || enriched.email;
            if (contactDetails.tel_Mobile) enriched.mobile = contactDetails.tel_Mobile;
        }

        apiLog('Enrich', `Account ${accountId} enriched: email=${enriched.email}, oldCode=${enriched.oldCode}, outstanding=${enriched.outstandingAmount}`);
    } catch (e) {
        console.warn(`[Enrich] Failed to enrich account ${accountId}:`, e);
    }

    return enriched;
}

export async function fetchConfigSettings(): Promise<any[]> {
    const res = await apiFetch(`/api/platinum/billing-enquiry/get-config-settings-batch`);
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch config settings from API (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}


export async function postMultipleAccountPaymentReceipt(capturerId: string, accountId: string | number, receiptId: string | number): Promise<any> {
    const res = await apiFetch(`/api/platinum/pos-multiple-account-payments/${capturerId}/${accountId}/receipt/${receiptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to post receipt for account ${accountId}`);
    return res.json();
}

export async function fetchReceiptsBatch(startId: number, count: number = 50, direction: 'backward' | 'forward' = 'backward'): Promise<PosMultiReceiptPrintItem[]> {
    const params = new URLSearchParams({
        startId: startId.toString(),
        count: count.toString(),
        direction
    });
    const res = await apiFetch(`/api/platinum/pos-multi-receipt-print/batch?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch receipts batch');
    return res.json();
}

export async function updateTransactionStatusApi(id: string, status: string, reason?: string): Promise<any> {
    const res = await apiFetch(`/api/transactions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellationReason: reason }),
    });
    if (!res.ok) throw new Error('Failed to update transaction status');
    return res.json();
}

// =====================================================
// PLATINUM API FUNCTIONS
// =====================================================

async function platinumFetch(url: string, options?: RequestInit & { timeoutMs?: number }): Promise<any> {
    const timeout = options?.timeoutMs || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const { timeoutMs: _, ...fetchOpts } = options || {};
        const mergedSignal = options?.signal
            ? options.signal
            : controller.signal;
        const res = await apiFetch(url, { ...fetchOpts, signal: mergedSignal });
        if (!res.ok) {
            let text = '';
            try { text = await res.text(); } catch (err) { console.error('[platinumFetch] Failed to read error response text:', err); }
            let detail = text;
            try {
                const parsed = JSON.parse(text);
                let raw = parsed.detail || parsed.message || text;
                if (typeof raw === 'string') {
                    try {
                        const nested = JSON.parse(raw);
                        if (nested.errors && typeof nested.errors === 'object') {
                            const msgs = Object.entries(nested.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
                            detail = nested.title ? `${nested.title} — ${msgs.join('; ')}` : msgs.join('; ');
                        } else {
                            detail = nested.title || nested.message || raw;
                        }
                    } catch {
                        detail = raw;
                    }
                } else {
                    detail = parsed.message || JSON.stringify(raw);
                }
            } catch (err) { console.error('[platinumFetch] Failed to parse error response JSON:', err); }
            detail = detail?.replace(/<[^>]*>/g, '')?.substring(0, 300) || '';
            throw new Error(detail || `Platinum API error (${res.status})`);
        }
        return res.json();
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000}s. The API server may be under heavy load — please try again.`);
        }
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function platinumValidateCashier(userId: number, finYear: string): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/validate-cashier?userId=${userId}&finYear=${encodeURIComponent(finYear)}`);
}

export async function platinumGetConsAccounts(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/receipt-prepaid/cons-accounts?${qs}`);
}

export async function platinumGetConsAccountDetails(accountId: number, nocache?: boolean): Promise<any> {
    const cacheBust = nocache ? `&_nocache=${Date.now()}` : '';
    return platinumFetch(`/api/platinum/receipt-prepaid/cons-account-details?accountId=${accountId}${cacheBust}`);
}

export async function platinumGetPrepaidAccountDetails(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/prepaid-account-details?accountId=${accountId}`);
}

export async function platinumGetCashierDetailsById(cashierId: number): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/cashier-details-by-id?cashierId=${cashierId}`);
}

export async function platinumGetActiveCashierDetails(): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/active-cashier-details`);
}

export async function platinumGetActiveCashOfficeDetails(): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/active-cash-office-details`);
}

export async function platinumGetPosPaymentTypes(): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/pos-payment-type`);
}

export async function platinumIsBilling(): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/is-billing`);
}

export async function platinumGetServiceTypePrepaidList(accountId: number): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/service-type-wise-prepaid-list?accountId=${accountId}`);
}

export async function platinumGetCashOffices(finYear?: string): Promise<any[]> {
    const params = finYear ? `?finYear=${encodeURIComponent(finYear)}` : '';
    return platinumFetch(`/api/platinum/receipt-prepaid/cash-offices${params}`);
}

export async function platinumSubmitCashierSetup(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/submit-cashier-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumSubmitPrepaidPayment(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/submit-prepaid-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumUtiliPayBreakdownRequest(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/utilipay-breakdown-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumUtiliPayTokenRequest(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/utilipay-token-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumSearchPropertyRatesPayment(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/receipt-prepaid/search-property-rates-payment?${qs}`);
}

export async function platinumValidateCashierDayEndRecon(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/receipt-prepaid/validate-cashier-day-end-recon?${qs}`);
}

export async function platinumGetBillingRuns(): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/get-billing-runs`);
}

export async function platinumGetChequeAmendList(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/receipt-prepaid/cheque-amend-list?${qs}`);
}

// --- Billing Payment ---

export async function platinumSubmitConsumerPayment(userId: string, data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumSaveMultipleAccountPayment(data: any, params?: Record<string, string>): Promise<any> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return platinumFetch(`/api/platinum/billing-payment/save-multiple-account-payment${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetMultipleAccountPayment(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment/get-multiple-account-payment?${qs}`);
}


export async function platinumSearchAccountsPayment(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment/search-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPrintReceiptRaw(data: any, receiptNos?: string[], isReprint?: boolean): Promise<Response> {
    const ids = Array.isArray(data) ? data : [data];
    const payload = { ids, receiptNos: receiptNos || [], isReprint: isReprint ?? false };
    return apiFetch(`/api/platinum/billing-payment/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export async function platinumPrintReceipt(data: any, isReprint?: boolean): Promise<any> {
    const ids = Array.isArray(data) ? data : [data];
    const payload = { ids, receiptNos: [], isReprint: isReprint ?? false };
    return platinumFetch(`/api/platinum/billing-payment/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export async function fetchServiceTypeBalance(accountId: string): Promise<{ serviceDescription: string; amount: number; vat: number; totalAmount: number; currentCharge: number; openingBalance: number }[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await apiFetch(`/api/platinum/billing-enquiry/service-type-balance?accountId=${encodeURIComponent(accountId)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {
        console.warn(`Failed to fetch service type balance for accountId ${accountId}`, e);
    }
    return [];
}

export async function fetchReceiptAllocations(receiptId: string): Promise<{ service: string; amount: number; vat: number; total: number }[]> {
    try {
        const res = await apiFetch(`/api/platinum/billing-payment/receipt-allocations?receiptId=${encodeURIComponent(receiptId)}`);
        if (res.ok) {
            const data = await res.json();
            return data.allocations || [];
        }
    } catch (e) {
        console.warn(`Failed to fetch receipt allocations for receiptId ${receiptId}`, e);
    }
    return [];
}

export async function platinumPrintMiscellaneousReceipt(data: any, params?: Record<string, string>): Promise<any> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return platinumFetch(`/api/platinum/billing-payment/print-miscellaneous-receipt${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Clearance ---

export async function platinumGetClearanceIds(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-clearanceids?${qs}`);
}

export async function platinumGetClearancePaymentTypes(): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/pos-payment-type`);
}

export async function platinumGetBanks(): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-banks`);
}

export async function platinumGetBranchesByBank(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-branches-by-bank?${qs}`);
}

export async function platinumGetClearanceData(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-clearance-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetAccountsForClearance(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-accounts-for-clearance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumSubmitClearancePayment(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/submit-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Miscellaneous Payments ---

export async function platinumGetMiscGroups(): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-miscellaneous/get-groups`);
}

export async function platinumGetMiscScoaItems(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment-miscellaneous/get-scoa-items?${qs}`);
}

export async function platinumGetMiscVatRate(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-miscellaneous/get-vat-rate`);
}

export async function platinumSubmitMiscPayment(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-miscellaneous/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Drop Box (Cash Drop) ---

export async function platinumSubmitDropBox(data: {
    amount: number;
    description?: string;
    userId: number;
    finYear?: string;
    paymentType?: number;
}): Promise<any> {
    return platinumFetch(`/api/platinum/drop-box/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetDropBoxList(cashierId: number): Promise<any> {
    return platinumFetch(`/api/platinum/drop-box/list?cashierId=${cashierId}`);
}

// --- Day-End Reconciliation (Cashier) ---

export async function platinumGetDayEndCashierList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-list`);
}

export async function platinumGetDayEndCashierDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-details?${qs}`);
}

export async function platinumGetDayEndReconcileList(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-receipt-reconcile-list?${qs}`);
}

export async function platinumGetDayEndUnreconciledList(id: string | number): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-payment-day-end/cashier-receipt-unreconciled-list?id=${id}`);
}

export async function platinumReceiptDiscovery(cashierId: string): Promise<{ items: any[]; totalCount: number }> {
    return platinumFetch(`/api/platinum/receipt-discovery?cashierId=${cashierId}`);
}

export async function platinumGetDayEndChequeList(cashierId: number, pager?: { page?: number; pageSize?: number }): Promise<any[]> {
    const body = { page: pager?.page ?? 1, pageSize: pager?.pageSize ?? 100, orderby: null, shortDirection: null };
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-receipt-cheque-list?id=${cashierId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export async function platinumGetDayEndCardList(cashierId: number, pager?: { page?: number; pageSize?: number }): Promise<any[]> {
    const body = { page: pager?.page ?? 1, pageSize: pager?.pageSize ?? 100, orderby: null, shortDirection: null };
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-receipt-card-list?id=${cashierId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export async function platinumGetDayEndDropBoxList(cashierId: number, pager?: { page?: number; pageSize?: number }): Promise<any[]> {
    const body = { page: pager?.page ?? 1, pageSize: pager?.pageSize ?? 100, orderby: null, shortDirection: null };
    return platinumFetch(`/api/platinum/billing-payment-day-end/get-cashier-receipt-drop-box-list?id=${cashierId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export async function platinumSaveDayEndReconcileData(userId: number, data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-day-end/save-reconcile-data?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Auth Day-End Reconciliation (Supervisor) ---

export async function platinumGetAuthDayEndCashierList(): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/cashier-list`);
}

export async function platinumGetAuthDayEndCashOfficeList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/cash-office-list`);
}

export async function platinumGetAuthDayEndCashbookList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/cashbook-list`);
}

export async function platinumAuthDayEndCashierReceiptOfflineDataList(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/cashier-receipt-offline-data-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndDirectCancelReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/cancel-day-auth-reconcile-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetAuthDayEndCashierReconcile(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/auth-day-end/cashier-reconcile-by-cashierid?${qs}`);
}

export async function platinumGetAuthDayEndPosCashier(): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/pos-cashier`);
}

export async function platinumGetAuthDayEndCashierDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/auth-day-end/cashier-details?${qs}`);
}

export async function platinumAuthDayEndCashierReceiptCashList(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/cashier-receipt-cash-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndSystemVsCashierDataList(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/system-vs-cashier-data-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndFinishReconcile(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/finish-day-end-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndReturnReconcile(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/return-day-end-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndCancelReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/cancel-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumRequestCancelReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/request-cancel-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumApproveCancelReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/approve-cancel-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumDeclineCancelReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/decline-cancel-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetPendingCancelRequests(cashierId?: number): Promise<any> {
    const qs = cashierId ? `?cashierId=${cashierId}` : '';
    return platinumFetch(`/api/platinum/auth-day-end/pending-cancel-requests${qs}`);
}

export async function platinumAuthDayEndPrintReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndPrintCashReport(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/print-cash-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndPrintDepositSlip(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/print-deposit-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndSubmitReconcile(params: { cashierId: number; cashBookId: number; cashierOfficeId: number }): Promise<any> {
    const qs = new URLSearchParams({
        cashierId: String(params.cashierId),
        cashBookId: String(params.cashBookId),
        cashierOfficeId: String(params.cashierOfficeId),
    }).toString();
    return platinumFetch(`/api/platinum/auth-day-end/submit-day-auth-reconcile?${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

export async function platinumAuthDayEndValidateCashbook(cashierId: number): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/validate-cashbook?cashierId=${cashierId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

// --- Auth Day-End Reconciliation Per Office (GroupCashiers = true) ---

export async function platinumPerOfficeCashOfficeList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/cash-office-list`);
}

export async function platinumPerOfficeCashOfficeSelection(cashOfficeId: number): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/cash-office-selection?cashOfficeId=${cashOfficeId}`);
}

export async function platinumPerOfficeCashierSummary(cashOfficeId: number): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/cashier-summary-by-office?cashOfficeId=${cashOfficeId}`);
}

export async function platinumPerOfficeCashierReconcileStatus(cashierId: number, cashOfficeId: number): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/cashier-reconcile-status?cashierId=${cashierId}&cashOfficeId=${cashOfficeId}`);
}

export async function platinumPerOfficeProcessStagingPayments(cashOfficeId: number): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/process-staging-payments?cashOfficeId=${cashOfficeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

export async function platinumPerOfficeAddStage(): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/add-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

export async function platinumPerOfficeVerifyCashierReconcile(data: { cashierId: number; cashOfficeId: number; cashBookId: number }): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/verify-cashier-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficeSubmitReconcile(data: { cashOfficeId: number; cashBookId: number }): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/submit-reconcile-per-office`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficeFinishStage(): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/finish-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

export async function platinumPerOfficeCancelReceipt(data: { id: number; returnReason: string }): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/cancel-day-auth-reconcile-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficeReturnReconcile(data: { id: number; returnReason: string }): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/return-day-end-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficePrintReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficePrintCashReport(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/print-cash-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumPerOfficePrintDepositSlip(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end-per-office/print-deposit-slip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Direct Deposit Allocation ---

export async function platinumGetBankReconPosItemList(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetPosItemDetails(posItemId: number): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-pos-item-details?posItemId=${posItemId}`);
}

export async function platinumCheckSelectedItemProcessed(userId: number, finYear: string, posItemId: number): Promise<{ success: boolean; message: string }> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/check-selected-item-processed?userId=${userId}&finYear=${encodeURIComponent(finYear)}&posItemId=${posItemId}`);
}

export async function platinumGetMiscPaymentGroup(): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-misc-payment-group`);
}

export async function platinumGetMiscVoteIdByGroup(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-misc-vote-id-by-group?${qs}`);
}

export async function platinumGetGroupPaymentDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-group-payment-details?${qs}`);
}

export async function platinumGetDDVatRate(): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-vat-rate`);
}

export async function platinumGetVoteDetails(voteId: number): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/vote-details?voteId=${voteId}`);
}

export async function platinumGetAccountAutocomplete(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-account-autocomplete?${qs}`);
}

export async function platinumGetClearanceAutocomplete(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-clearance-autocomplete?${qs}`);
}

export async function platinumGetOldAccountAutocomplete(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-old-account-autocomplete?${qs}`);
}

export async function platinumLoadDetailsPaymentGrouping(data: any, queryParams?: Record<string, string>): Promise<any> {
    const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-payment-grouping${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumLoadDetailsPaymentGroupingInstitutionData(data: any, queryParams?: Record<string, string>): Promise<any> {
    const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-payment-grouping-institution-data${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumLoadDetailsConsumerServices(data: any, queryParams?: Record<string, string>): Promise<any> {
    const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-consumer-services${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumDDAccountAutocomplete(searchTerm: string): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-account-autocomplete?searchTerm=${encodeURIComponent(searchTerm)}`);
}

export async function platinumDDOldAccountAutocomplete(searchTerm: string): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-old-account-autocomplete?searchTerm=${encodeURIComponent(searchTerm)}`);
}

export async function platinumDDClearanceAutocomplete(searchTerm: string): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-clearance-autocomplete?searchTerm=${encodeURIComponent(searchTerm)}`);
}

export async function platinumSearchClearanceIds(clearanceId: string): Promise<string[]> {
    return platinumFetch(`/api/platinum/billing-payment-clearance/get-clearanceids?clearanceId=${encodeURIComponent(clearanceId)}`);
}

export async function platinumLoadDetailsClearance(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-clearance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetClearanceDetailsInfo(data: { costScheduleID: string; accountID: string; transactionAmount: number; posItemID: number }): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-clearance-details-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetConsumerDetailsData(data: { costScheduleID?: string; accountID: string; posItemID: number; transactionAmount: number }): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-consumer-details-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetMiscReceiptData(receiptId: number): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-misc-receipt-data?receiptId=${receiptId}`);
}

export async function platinumLoadConfirmPaymentDetails(data: any, queryParams?: Record<string, string>): Promise<any> {
    const qs = queryParams ? `?${new URLSearchParams(queryParams).toString()}` : '';
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-confirm-payment-details${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumSubmitDirectDepositAllocation(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/submit-details-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function submitDDAllocationBatch(data: {
    posItemId: number;
    reconId: number;
    financialYear: string;
    transactionDate: string;
    transactionNote: string;
    lines: any[];
}): Promise<{ jobId: string; message: string }> {
    return platinumFetch(`/api/dd-allocation/submit-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function pollDDAllocationJob(jobId: string): Promise<{
    jobId: string;
    posItemId: number;
    status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
    totalLines: number;
    completedLines: number;
    failedLines: number;
    processedLines: number;
    currentLine: string;
    results: any[];
    errors: string[];
}> {
    return platinumFetch(`/api/dd-allocation/job/${jobId}`);
}

export async function createDDVirtualSession(financialYear?: string): Promise<{ success: boolean; virtualCashierId?: number; officeId?: number; message?: string }> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/create-virtual-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYear }),
    });
}

export async function closeDDVirtualSession(): Promise<{ success: boolean; message?: string }> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/close-virtual-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

// --- Generic Import (Direct Deposit Allocation) ---

export async function submitGenericImport(data: {
    cashOfficeId: number;
    cashierId: number;
    userId: number;
    finYear: string;
    postToCashbook: boolean;
    payments: Array<{
        receiptDate: string;
        accountNumber: string;
        amount: number;
        paymentTypeId: number;
    }>;
}): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/submit-generic-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function validateGenericImport(payments: Array<{
    rowNum: number;
    accountNumber: string;
    amount: number;
    receiptDate: string;
    paymentTypeId: number;
}>): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/validate-generic-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments }),
    });
}

export async function fetchGenericImportStatus(jobId: number | string): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/generic-import-status/${jobId}`);
}

export async function fetchGenericImportResults(jobId: number | string): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/generic-import-results/${jobId}`);
}

export async function fetchGenericImportErrors(jobId: number | string): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/generic-import-errors/${jobId}`);
}

// --- Direct Deposit Bulk ---

export async function platinumGetBulkUnprocessed(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-bulk/get-unprocessed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetBulkProcessed(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-bulk/get-processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumBulkReconcile(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-bulk/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumBulkPrintProcessed(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-bulk/print-processed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Third Party Payments V2 ---

export async function platinumThirdPartyImport(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumThirdPartyGetTransactions(importId: string): Promise<any[]> {
    return platinumFetch(`/api/platinum/third-party-payments/${importId}/transactions`);
}

export async function platinumThirdPartyValidateAccount(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/validate-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumThirdPartyReconcile(importId: string, data: any): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/${importId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumThirdPartyCommit(importId: string, data: any): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/${importId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// --- Third Party Payments - Cashier Status ---

export async function platinumThirdPartyIsCashierActive(userId: number, finYear: string): Promise<any> {
    const qs = new URLSearchParams({ userId: String(userId), finYear }).toString();
    return platinumFetch(`/api/platinum/third-party-payments/is-cashier-active?${qs}`);
}

export async function platinumThirdPartyCashierDetails(userId: number, finYear: string): Promise<any> {
    const qs = new URLSearchParams({ userId: String(userId), finYear }).toString();
    return platinumFetch(`/api/platinum/third-party-payments/cashier-details?${qs}`);
}

export async function platinumThirdPartyValidateForReconcile(importId: string): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/${importId}/validate-for-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
}

export async function platinumThirdPartyAccountSearch(params: { accountNo?: string; name?: string; street?: string; oldCode?: string }): Promise<any[]> {
    const body: Record<string, string> = {};
    if (params.accountNo) body.accountID = params.accountNo;
    if (params.name) body.name = params.name;
    if (params.street) body.locationAddress = params.street;
    const results = await platinumFetch('/api/platinum/billing-enquiry/enquiry-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const arr = Array.isArray(results) ? results : [];
    return arr.slice(0, 50).map((r: any) => ({
        accountNumber: r.accountNumber || '',
        accountId: r.accountID || r.accountId || '',
        ownerName: r.name || r.ownerName || '',
        propertyAddress: r.locationAddress || r.address || r.propertyAddress || '',
        accountStatus: r.accountStatus || '',
    }));
}

export async function platinumThirdPartyUpdateTransaction(importId: string, index: number, data: { newAccountNumber: string; comment: string }): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/${importId}/transactions/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumThirdPartyImportFile(data: {
    ContentType?: string;
    ContentDisposition?: string;
    Headers?: Record<string, string>;
    Length?: number;
    Name?: string;
    FileName?: string;
    thirdpartyTypeId?: number;
    paymentReference?: string;
    cashBookId?: number;
    fileContent?: string;
}): Promise<any> {
    return platinumFetch(`/api/platinum/third-party-payments/import-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumThirdPartyPaymentTypes(): Promise<any[]> {
    return platinumFetch(`/api/platinum/third-party-payments/types`);
}

// --- Billing Enquiry ---

export async function platinumGetDepositsByAccountId(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-enquiry/deposits-by-account-id?${qs}`);
}

export async function platinumGetReceiptTransactionDetail(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-enquiry/receipt-transaction-detail?${qs}`);
}

// --- Account Management ---

export async function platinumSearchAccountsManagement(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-account-management/search-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumGetAccountDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-account-management/account-details?${qs}`);
}

export async function platinumGetAccountInformation(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-account-management/account-information?${qs}`);
}

export async function platinumGetContactDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-account-management/get-contact-details?${qs}`);
}

export async function platinumGetPropertyDetails(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-account-management/get-property-details?${qs}`);
}

export async function platinumGetAccountGrouping(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-account-management/get-account-grouping?accountId=${accountId}`);
}

export async function platinumGetSubAccountGrouping(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-account-management/get-sub-account-grouping?accountId=${accountId}`);
}

export async function platinumGetPaymentGroupList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/billing-account-management/get-payment-group-list`);
}

export async function platinumGetReceiptingAccountGroups(userId: number, finYear: string): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipting-account-group/get-account-groups?userId=${userId}&finYear=${encodeURIComponent(finYear)}`);
}

export async function platinumGetReceiptingSubGroups(institutionId: number): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipting-account-group/get-account-sub-groups?institutionId=${institutionId}`);
}

export async function platinumSearchAccountsByGroup(groupId: number, subGroupId?: number): Promise<any[]> {
    let url = `/api/platinum/receipting-account-group-payment/search-accounts-by-group?groupId=${groupId}`;
    if (subGroupId !== undefined) url += `&subGroupId=${subGroupId}`;
    return platinumFetch(url);
}

export async function platinumGetDepositAmount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/deposit-amount?accountId=${accountId}`);
}

export async function platinumGetPropertyDetailsByAccount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/property-details-by-account?AccountId=${accountId}`);
}

export async function platinumGetConsUnitByAccount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/cons-unit-by-account?AccountId=${accountId}`);
}

export async function platinumGetNameInfoByAccount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`);
}

export async function platinumGetHandoverByAccount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/handover-by-account?accountId=${accountId}`);
}

export async function platinumGetPaymentIncentiveByAccount(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/billing-enquiry/payment-incentive-by-account?accountId=${accountId}`);
}

// --- Miscellaneous Payments (Direct Income) ---

export interface MiscPaymentGroup {
    id: number;
    name: string;
}

export interface MiscPaymentScoaItem {
    id: number;
    name: string;
    groupId: number;
    groupName: string;
    isVatable?: boolean;
    vatPercentage?: number;
}

export async function fetchMiscPaymentGroups(): Promise<MiscPaymentGroup[]> {
    const res = await apiFetch('/api/platinum/billing-payment-miscellaneous/get-groups');
    if (!res.ok) throw new Error('Failed to fetch misc payment groups');
    return res.json();
}

export async function fetchMiscPaymentScoaItems(groupId: number): Promise<MiscPaymentScoaItem[]> {
    const res = await apiFetch(`/api/platinum/billing-payment-miscellaneous/get-scoa-items?mISCPayGroupId=${groupId}`);
    if (!res.ok) throw new Error('Failed to fetch SCOA items');
    const items = await res.json();
    return items;
}

export async function fetchMiscPaymentVatRate(): Promise<number> {
    const res = await apiFetch('/api/platinum/billing-payment-miscellaneous/get-vat-rate');
    if (!res.ok) throw new Error('Failed to fetch VAT rate');
    return res.json();
}

export async function submitMiscPayment(data: {
    lastName: string;
    initials: string;
    miscellaneousPaymentGroup: number;
    scoaItem: number;
    description: string;
    receiptDate: string;
    totalAmount: number;
    vatAmount: number;
    amount: number;
    tenderAmount: number;
    changeAmount: number;
    paymentType: number;
    vatPercentage: number;
    isVatable: boolean;
    userId: number;
    finYear: string;
    cardNo?: string;
    expiryDate?: string;
    chequeNo?: string;
    bankBranch?: string;
    bankBranchCode?: string;
    accHolderName?: string;
}): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-payment-miscellaneous/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to submit misc payment: ${text}`);
    }
    const result = await res.json();
    if (result && result.isSuccess === false) {
        throw new Error(result.message || 'Miscellaneous payment submission failed');
    }
    if (result && result._error) {
        throw new Error(result.detail || result.statusText || `Misc payment failed with status ${result.status}`);
    }
    return result;
}

export async function rebuildFullAccount(accountId: number, nocache?: boolean): Promise<any> {
    const cacheBust = nocache ? `&_nocache=${Date.now()}` : '';
    const res = await apiFetch(`/api/platinum/billing-enquiry/rebuild-full-account?accountId=${accountId}${cacheBust}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to rebuild account ${accountId}: ${text}`);
    }
    return res.json();
}

export async function submitConsumerPayment(userId: number, data: any): Promise<any> {
    const res = await apiFetch(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to submit consumer payment: ${text}`);
    }
    return await res.json();
}

export async function submitMultiplePayment(userId: number, data: { accounts: any[]; requestModel: any }): Promise<any> {
    const timeoutMs = Math.max(60000, data.accounts.length * 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await apiFetch(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to submit multiple payment: ${text}`);
        }
        return await res.json();
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error(`Payment submission timed out after ${Math.round(timeoutMs / 1000)}s for ${data.accounts.length} accounts. The billing server did not respond in time. Please check the account balances before retrying.`);
        }
        throw err;
    }
}


export async function submitPrepaidPayment(data: any): Promise<any> {
    const res = await apiFetch('/api/platinum/receipt-prepaid/submit-prepaid-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to submit prepaid payment: ${text}`);
    }
    return res.json();
}

// --- Dashboard ---

export async function platinumGetPosCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/pos-count`);
}

export async function platinumGetPosTabItemDetailsCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/pos-tab-item-details-count`);
}

export async function platinumGetAlertCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-alert-counts`);
}

export async function platinumGetNotificationCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-notification-counts`);
}

export async function platinumGetBillingPaymentByTypeOfUse(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use`);
}

export async function platinumGetAccountCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/account-count`);
}

export async function platinumGetDepositTableData(pager: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-dashboard/get-deposit-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetDirectDepositsAllocationTableData(pager: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetThirdPartyPaymentPendingTableData(pager: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-dashboard/get-third-party-payment-pending-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetPostDatedChequeTableData(pager: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-dashboard/get-post-dated-cheque-search-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetConsumptionCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/consumption-count`);
}
export async function platinumGetDebtCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/debt-count`);
}
export async function platinumGetBillingCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/billing-count`);
}
export async function platinumGetPropertyCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/property-count`);
}
export async function platinumGetIndigentSubsidyCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/indigentsubsidy-count`);
}
export async function platinumGetJournalCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/journal-count`);
}
export async function platinumGetRebateCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/rebate-count`);
}
export async function platinumGetAssetsCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/assets-count`);
}
export async function platinumGetNotificationAccountItemCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-notification-account-item-counts`);
}
export async function platinumGetNotificationConsumptionItemCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-notification-consumption-item-counts`);
}
export async function platinumGetNotificationDebtItemCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-notification-debt-item-counts`);
}
export async function platinumGetSubsidyItemCounts(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-subsidy-item-counts`);
}
export async function platinumGetPropertyTabItemDetailsCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-property-tab-item-details-count`);
}
export async function platinumGetRebateTabItemDetailsCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-rebate-tab-item-details-count`);
}
export async function platinumGetBillingTabItemDetailsCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-billing-tab-item-details-count`);
}
export async function platinumGetBillingTabItemAssetCount(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-billing-tab-item-asset-count`);
}
export async function platinumGetDebtArrangementSummaryChart(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-debt-arrangement-summary-chart`);
}
export async function platinumGetMeterReadingProgressChart(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-meterreading-progress-chart`);
}
export async function platinumGetBillingDashboardCycles(): Promise<any> {
    return platinumFetch(`/api/platinum/billing-dashboard/get-billing-dashboard-billing-cycles`);
}
export async function platinumDashboardGenericTable(endpoint: string, pager: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-dashboard/generic-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, pager }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// --- View Receipt ---

export interface ViewReceiptCashier {
    id: number;
    name: string;
    cashierId?: number;
}

export async function fetchViewReceiptCashiers(): Promise<ViewReceiptCashier[]> {
    try {
        const data = await platinumFetch('/api/platinum/view-receipt/get-cashiers');
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn('Failed to fetch view receipt cashiers', e);
        return [];
    }
}

export async function searchAccountNumbers(query: string): Promise<string[]> {
    try {
        const data = await platinumFetch(`/api/platinum/view-receipt/search-account-numbers?query=${encodeURIComponent(query)}`);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn('Failed to search account numbers', e);
        return [];
    }
}

export async function searchReceiptNumbers(query: string): Promise<string[]> {
    try {
        const data = await platinumFetch(`/api/platinum/view-receipt/search-receipt-numbers?query=${encodeURIComponent(query)}`);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn('Failed to search receipt numbers', e);
        return [];
    }
}

export interface ReceiptSearchQuery {
    accountNumber?: string | null;
    cashierId?: string | null;
    fromDate: string;
    toDate?: string | null;
    receiptNo?: string | null;
    page?: number;
    pageSize?: number;
    orderby?: string | null;
    shortDirection?: string | null;
}

export interface ViewReceiptItem {
    receiptId: number;
    receiptNo: string;
    accountNumber: string;
    paymentType: string;
    paymentOption: string;
    receiptDate: string;
    isStaged: boolean;
    amount: number;
    tenderAmount: number;
    changeAmount: number;
    cashierName: string;
    cashBook: string;
    cashOffice: string;
    isCancelled: number;
    cancellationReason: string;
    accName: string;
    accAddress: string;
    outstandingAmount: number;
    [key: string]: any;
}

export interface ReceiptListResponse {
    items: ViewReceiptItem[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface EftDescriptionSearchResult {
    posItemId: number;
    bankReconId: number;
    description: string;
    amount: number;
    dateOfTransaction: string;
    dateAllocated: string | null;
    allocated: boolean;
    matchedReceipts: any[];
}

export async function searchReceiptsByEftDescription(description: string, fromDate?: string, toDate?: string): Promise<{ results: EftDescriptionSearchResult[]; totalBankReconItems: number; matchingItems: number }> {
    const res = await apiFetch(`/api/platinum/view-receipt/search-by-eft-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, fromDate, toDate }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(err.message || 'Search failed');
    }
    return res.json();
}

export async function fetchReceiptList(query: ReceiptSearchQuery): Promise<ReceiptListResponse> {
    try {
        const res = await apiFetch('/api/platinum/view-receipt/get-receipt-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(query),
        });
        if (res.ok) {
            const data = await res.json();

            let items: ViewReceiptItem[] = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data && typeof data === 'object') {
                items = data.items || data.value || data.results || data.rows || data.data || data.receipts || [];
                if (!Array.isArray(items)) items = [];
            }

            const totalCount = data?.totalCount ?? data?.totalRecords ?? data?.count ?? data?.total ?? items.length;

            return {
                items,
                totalCount: Number(totalCount) || items.length,
                page: data?.page ?? query.page ?? 1,
                pageSize: data?.pageSize ?? query.pageSize ?? 50,
            };
        }
        console.warn(`[fetchReceiptList] API returned ${res.status}`);
        throw new Error(`Receipt API returned error (${res.status}). Please try again.`);
    } catch (e: any) {
        console.warn('Failed to fetch receipt list', e);
        throw e;
    }
}

export async function searchPlatinumReceipts(filters: {
    receiptNo?: string;
    cashierName?: string;
    accountNumber?: string;
}): Promise<ViewReceiptItem[]> {
    try {
        const params = new URLSearchParams();
        if (filters.receiptNo) params.append('receiptNo', filters.receiptNo);
        if (filters.cashierName) params.append('cashierName', filters.cashierName);
        if (filters.accountNumber) params.append('accountNumber', filters.accountNumber);

        const res = await apiFetch(`/api/platinum/pos-multi-receipt-print/search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) return [];

        const grouped = new Map<number, any[]>();
        for (const item of data) {
            const id = item._receiptId || 0;
            if (!grouped.has(id)) grouped.set(id, []);
            grouped.get(id)!.push(item);
        }

        const items: ViewReceiptItem[] = [];
        for (const [receiptId, group] of Array.from(grouped.entries())) {
            const first = group[0];
            const totalAmount = group.reduce((sum: number, g: any) => sum + (parseFloat(g.tenderAmount) || 0), 0);
            items.push({
                receiptId,
                receiptNo: first.receiptNo || '',
                accountNumber: first.accountNo || '',
                paymentType: first.payMode || '',
                paymentOption: first.billType || '',
                receiptDate: first.receiptDate || first.transactionDate || '',
                isStaged: false,
                amount: totalAmount,
                tenderAmount: parseFloat(first.tenderAmount) || 0,
                changeAmount: parseFloat(first.changeAmount) || 0,
                cashierName: first.cashierName || '',
                cashBook: '',
                cashOffice: first.cashOfficeName || '',
                isCancelled: 0,
                cancellationReason: '',
                accName: first.consumerName || '',
                accAddress: '',
                outstandingAmount: parseFloat(first.outstandingAmount) || 0,
                _source: 'platinum-search',
            });
        }
        return items;
    } catch (e) {
        console.warn('Failed to search Platinum receipts', e);
        return [];
    }
}

// --- Municipality / Receipt Info ---

export async function getReceiptTransactionDetail(primaryId: number): Promise<any> {
    try {
        const data = await platinumFetch(`/api/platinum/billing-enquiry/receipt-transaction-detail?primaryId=${primaryId}`);
        apiLog('getReceiptTransactionDetail', `primaryId=${primaryId}, response:`, data);
        return data;
    } catch (e) {
        console.warn(`Failed to fetch receipt transaction detail for primaryId=${primaryId}`, e);
        return null;
    }
}

export interface MunicipalityInfo {
    name: string;
    address1: string;
    address2: string;
    address3: string;
    postalCode: string;
    tel: string;
    fax: string;
    vatNo: string;
    email: string;
    website: string;
    receiptFooter: string;
    receiptHeader: string;
}

let cachedMunicipalityInfo: MunicipalityInfo | null = null;

export async function fetchMunicipalityInfo(): Promise<MunicipalityInfo> {
    if (cachedMunicipalityInfo) return cachedMunicipalityInfo;

    const res = await apiFetch('/api/platinum/receipt-info');
    if (!res.ok) throw new Error(`Failed to fetch municipality info: HTTP ${res.status}`);
    const data = await res.json();

    const info: MunicipalityInfo = {
        name: data.InstitutionName || data.MunicipalityName || '',
        address1: data.InstitutionAddress1 || data.MunicipalityAddress || '',
        address2: data.InstitutionAddress2 || '',
        address3: data.InstitutionAddress3 || '',
        postalCode: data.InstitutionPostalCode || '',
        tel: data.InstitutionTel || '',
        fax: data.InstitutionFax || '',
        vatNo: data.VATRegistrationNo || data.MunicipalityVatNo || '',
        email: data.InstitutionEmail || '',
        website: data.InstitutionWebsite || '',
        receiptFooter: data.ReceiptFooter || '',
        receiptHeader: data.ReceiptHeader || '',
    };

    cachedMunicipalityInfo = info;
    return info;
}

// --- Utility / Session Functions ---

export interface CashbookTransactionTraceResult {
    cashbookTransactionID?: number;
    description?: string;
    amount?: number;
    transactionDate?: string;
    receiptNo?: string;
    accountNumber?: string;
    accountId?: number;
    cashierName?: string;
    paymentType?: string;
    paymentOption?: string;
    cashOffice?: string;
    billType?: string;
    [key: string]: any;
}

export async function searchCashbookTransactionTrace(searchText: string, finYear?: string, month?: number): Promise<CashbookTransactionTraceResult[]> {
    const params = new URLSearchParams({ searchText });
    if (finYear) params.append('finYear', finYear);
    if (month !== undefined && month !== null) params.append('month', String(month));
    const res = await apiFetch(`/api/platinum/cashbook-transaction-trace/search?${params.toString()}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(err.message || 'Cashbook transaction trace search failed');
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.value)) return data.value;
    if (data && Array.isArray(data.results)) return data.results;
    return data ? [data] : [];
}

export interface BankStatementNoteResult {
    receiptNo?: string | number;
    accountId?: number;
    paidAmount?: number;
    paymentTypeId?: number;
    dateCaptured?: string;
    billingAllocationDate?: string;
    allocationStatus?: string;
    miscPaymentGroupDescription?: string;
    bankStatementNote?: string;
    bankAmount?: number;
    bankStatementDate?: string;
    bankReconID?: number;
    billingAllocated?: boolean | number;
    cashbookTransactionID?: number;
    cashbookDocumentNumber?: string;
    cashbookID?: number;
    cashbookDescription?: string;
    [key: string]: any;
}

export async function searchByBankStatementNote(searchText: string): Promise<BankStatementNoteResult[]> {
    const res = await apiFetch(`/api/platinum/billing-enquiry/search-by-bank-statement-note?searchText=${encodeURIComponent(searchText)}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Search failed' }));
        throw new Error(err.message || 'Bank statement note search failed');
    }
    const data = await res.json();
    let results: any[] = [];
    if (Array.isArray(data)) results = data;
    else if (data && Array.isArray(data.items)) results = data.items;
    else if (data && Array.isArray(data.value)) results = data.value;
    else if (data && Array.isArray(data.results)) results = data.results;
    else if (data && typeof data === 'object' && !data.message) results = [data];
    if (results.length > 0) {
        console.log('[BankStatementNote] First result keys:', Object.keys(results[0]));
        console.log('[BankStatementNote] First result:', JSON.stringify(results[0]));
    }
    return results;
}

export async function getEftBankStatementNotes(accountId: number | string): Promise<any[]> {
    const res = await apiFetch(`/api/platinum/billing-enquiry/get-eft-bank-statement-notes?accountId=${accountId}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Fetch failed' }));
        throw new Error(err.message || 'EFT bank statement notes fetch failed');
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.value)) return data.value;
    if (data && Array.isArray(data.results)) return data.results;
    if (data && typeof data === 'object' && !data.message) return [data];
    return [];
}

export async function fetchActiveFinYear(): Promise<string> {
    const res = await apiFetch('/api/platinum/active-fin-year');
    if (!res.ok) {
        throw new Error(`Failed to fetch active financial year: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data) {
        throw new Error('Active financial year API returned empty response');
    }
    return data;
}

export async function fetchActiveCashierByUserId(userId: number, finYear: string): Promise<any> {
    const res = await apiFetch(`/api/platinum/auth/active-cashier-by-userid?userid=${userId}&finYear=${encodeURIComponent(finYear)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchAdditionalEmailsByAccountId(accountId: number): Promise<any> {
    try {
        const res = await apiFetch(`/api/platinum/billing-account-management/get-additional-emails?accountId=${accountId}`);
        if (res.ok) return res.json();
    } catch (e) {
        console.warn(`Failed to fetch additional emails for account ${accountId}`, e);
    }
    return null;
}

export async function fetchPosMultiReceiptPrintByCashier(cashierName: string, scanCount: number = 100): Promise<any[]> {
    try {
        const params = new URLSearchParams({ cashierName, scanCount: String(scanCount) });
        const res = await apiFetch(`/api/platinum/pos-multi-receipt-print/by-cashier?${params}`);
        if (res.ok) return res.json();
    } catch (e) {
        console.warn('Failed to fetch receipts by cashier', e);
    }
    return [];
}

export async function generateStatement(payload: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-enquiry/generate-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchEnquiryResults(payload: any): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-enquiry/enquiry-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchSites(): Promise<any[]> {
    const res = await apiFetch('/api/sites');
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch sites (status ${res.status})`);
    }
    return res.json();
}

export async function loginUser(username: string, password: string, dbName: string, siteId?: string): Promise<{ success: boolean; user?: any; site?: any; error?: string }> {
    const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, dbName, siteId }),
    });
    return res.json();
}

export async function logoutUser(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function queryEasyPay(reference: string): Promise<any> {
    const res = await apiFetch(`/api/easypay/query?reference=${encodeURIComponent(reference)}`);
    if (!res.ok) throw new Error('EasyPay query failed');
    return res.json();
}

export async function fetchTotalBalanceDebt(accountId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/billing-enquiry/total-balance-debt?accountId=${accountId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchBatchAccountNames(accountNumbers: string[]): Promise<Record<string, { name: string; address: string }>> {
    const res = await apiFetch('/api/platinum/billing-enquiry/batch-account-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumbers }),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch batch account names (status ${res.status})`);
    }
    return res.json();
}

export async function fetchBatchBalances(accountIds: number[]): Promise<Record<string, number>> {
    const res = await apiFetch('/api/platinum/billing-enquiry/batch-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds }),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch batch balances (status ${res.status})`);
    }
    return res.json();
}

export async function platinumSearchAccountsWithSignal(data: any, signal?: AbortSignal): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-payment/search-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal,
    });
    if (!res.ok) {
        throw new Error(`Failed to search accounts (status ${res.status})`);
    }
    return res.json();
}

export async function fetchEnquiryResultsWithSignal(payload: any, signal?: AbortSignal): Promise<any> {
    const res = await apiFetch('/api/platinum/billing-enquiry/enquiry-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch enquiry results (status ${res.status})`);
    }
    return res.json();
}

// --- Bulk Progress ---

export interface BulkProgressSearchQuery {
    financialYear: string | null;
    process: string | null;
    billingMonth: number | null;
    orderby: string | null;
    page: number;
    pageSize: number;
    shortDirection: string | null;
}

export async function fetchBulkProgressFinancialYears(): Promise<any[]> {
    const res = await apiFetch('/api/platinum/bulk-progress/get-financial-years');
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch bulk progress financial years (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data?.value ?? [];
}

export async function fetchBulkProgressMonthList(): Promise<any[]> {
    const res = await apiFetch('/api/platinum/bulk-progress/get-month-list');
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch bulk progress month list (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data?.value ?? [];
}

export async function fetchBulkProgressProcessList(): Promise<any[]> {
    const res = await apiFetch('/api/platinum/bulk-progress/get-process-list');
    if (res.status === 404) return [];
    if (!res.ok) {
        throw new Error(`Failed to fetch bulk progress process list (status ${res.status})`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data?.value ?? [];
}

export async function fetchBulkAllocationList(query: BulkProgressSearchQuery): Promise<any> {
    const res = await apiFetch('/api/platinum/bulk-progress/get-bulk-allocation-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch bulk allocation list (status ${res.status})`);
    }
    return res.json();
}

export async function fetchBulkProgressDirectDeposit(jobId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/bulk-progress/direct-deposit/${jobId}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch bulk progress direct deposit for job ${jobId} (status ${res.status})`);
    }
    return res.json();
}

export async function fetchDirectDepositJobDetails(jobId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/direct-deposit-errors/job-details/${jobId}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch direct deposit job details for job ${jobId} (status ${res.status})`);
    }
    return res.json();
}

export async function fetchDirectDepositJobAccountDetails(jobId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/direct-deposit-errors/account-details/${jobId}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch direct deposit job account details for job ${jobId} (status ${res.status})`);
    }
    return res.json();
}

export async function fetchBankStatementNotes(posItemIds: number[]): Promise<Record<string, string>> {
    const res = await apiFetch('/api/platinum/bank-statement-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posItemIds }),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch bank statement notes (status ${res.status})`);
    }
    return res.json();
}

export async function fetchBulkProgressJobAccountDetails(jobId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/bulk-progress/job-account-details/${jobId}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch job account details for job ${jobId} (status ${res.status})`);
    }
    return res.json();
}

export async function retryBulkAllocationJob(jobId: number, userId: number): Promise<any> {
    const res = await apiFetch(`/api/platinum/direct-deposit-errors/retry/${jobId}/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Retry failed (${res.status})`);
    }
    return res.json().catch((e: unknown) => {
        console.error('[retryBulkAllocationJob] Failed to parse response JSON', e);
        return {};
    });
}
