import { CashOffice } from "./mock-data";

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

export async function fetchPlatinumUserInfo(): Promise<PlatinumUserInfo | null> {
    try {
        const res = await fetch('/api/platinum/auth/user-info');
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('Failed to fetch Platinum user info', e);
        return null;
    }
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
    try {
        const res = await fetch(`/api/proxy/odata/ConstCashOffices`);
        if (res.ok) {
            const data = await res.json();
            const items = data.value || [];
            return items.map((item: any) => ({
                id: item.cashOfficeId?.toString() || item.id?.toString(),
                name: item.cashOfficeDesc || item.name,
                ledgerVote: item.ledgerVote || "Unknown Vote",
                maxTransactionLimit: item.maxTransactionLimit || 5000
            }));
        }
    } catch (e) {
        console.warn("Failed to fetch cash offices from API", e);
    }
    return [];
}

export interface ApiCashier {
    id: string;
    name: string;
    cashOfficeId: string;
    float: number;
}

export async function fetchCashiers(): Promise<ApiCashier[]> {
    try {
        const [cashiersRes, userDetailsRes] = await Promise.all([
            fetch(`/api/proxy/odata/ConstCashiers`),
            fetch(`/api/proxy/odata/UserUserDetails`).catch(() => null)
        ]);

        let userDetails: any[] = [];
        if (userDetailsRes && userDetailsRes.ok) {
            const data = await userDetailsRes.json();
            userDetails = data.value || [];
        }

        if (cashiersRes.ok) {
            const data = await cashiersRes.json();
            return (data.value || []).map((c: any) => {
                const detail = userDetails.find((u: any) =>
                    u.id === c.id ||
                    u.userId === c.id ||
                    u.userName === c.name
                );
                return {
                    id: c.id || c.cashierId,
                    name: c.name || c.cashierName,
                    cashOfficeId: c.cashOfficeId,
                    float: detail?.cashFloat || detail?.float || c.float || 0
                };
            });
        }
    } catch (e: any) {
        console.warn(`Failed to fetch cashiers from API: ${e.message || e}`, e);
    }
    return [];
}

export interface BillingConfig {
    receiptingOptions?: any;
    allowPrepaidAndMiscellaneous?: boolean;
    allowPrepaidAndRecovery?: boolean;
    allowNormalReceipting?: boolean;
}

export async function fetchBillingConfig(): Promise<BillingConfig | null> {
    try {
        const res = await fetch(`/api/proxy/odata/BillingConfigSettings`);
        if (res.ok) {
            const data = await res.json();
            const items = data.value || [];
            const config: BillingConfig = {
                allowPrepaidAndMiscellaneous: items.find((i: any) => i.KeyName === "Allow Prepaid And Miscellaneous")?.KeyValue === "1",
                allowPrepaidAndRecovery: items.find((i: any) => i.KeyName === "Allow Prepaid And Recovery")?.KeyValue === "1",
                allowNormalReceipting: items.find((i: any) => i.KeyName === "Allow Normal Receipting")?.KeyValue === "1",
                receiptingOptions: items
            };
            return config;
        }
    } catch (e) {
        console.warn("Failed to fetch billing config", e);
    }
    return null;
}

export async function fetchBillingStageCashierReceiptDetails(referenceId: string): Promise<any[]> {
    try {
        const params = new URLSearchParams();
        params.append('referenceId', referenceId);
        const res = await fetch(`/api/proxy/billing-stage-cashier-receipt-details/reference?${params.toString()}`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.value || []);
        }
    } catch (e) {
        console.warn(`Failed to fetch receipt details for referenceId ${referenceId}`, e);
    }
    return [];
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
}

export async function fetchPosMultiReceiptPrint(receiptId: string): Promise<PosMultiReceiptPrintItem[]> {
    try {
        const params = new URLSearchParams();
        params.append('receiptId', receiptId);
        const res = await fetch(`/api/proxy/pos-multi-receipt-print?${params.toString()}`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.value || []);
        }
    } catch (e) {
        console.warn(`Failed to fetch pos multi receipt print for receiptId ${receiptId}`, e);
    }
    return [];
}

export async function fetchBillingStagePrepaidRecharge(id: string): Promise<any | null> {
    try {
        const res = await fetch(`/api/proxy/billing-stage-prepaid-recharge/${id}`);
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
            url = `/api/proxy/billing-stage-prepaid-recovery/${identifier}`;
        } else {
            const params = new URLSearchParams();
            params.append('reference', identifier);
            url = `/api/proxy/billing-stage-prepaid-recovery/reference?${params.toString()}`;
        }
        const res = await fetch(url);
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
        const res = await fetch(`/api/proxy/cons-accounts/${id}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn(`Failed to fetch cons account for id ${id}`, e);
    }
    return null;
}

export async function fetchBanks(): Promise<Bank[]> {
    try {
        const res = await fetch(`/api/proxy/odata/ConstBanks`);
        if (res.ok) {
            const data = await res.json();
            return data.value || [];
        }
    } catch (e) {
        console.error("Failed to fetch banks", e);
    }
    return [];
}

export async function fetchGroups(): Promise<GroupCode[]> {
    try {
        const res = await fetch(`/api/proxy/odata/ConstGroupCodes`);
        if (res.ok) {
            const data = await res.json();
            return data.value || [];
        }
    } catch (e) {
        console.error("Failed to fetch groups", e);
    }
    return [];
}

export async function fetchInstitutions(): Promise<Institution[]> {
    try {
        const res = await fetch(`/api/proxy/odata/ConstInstitutions`);
        if (res.ok) {
            const data = await res.json();
            return data.value || [];
        }
    } catch (e) {
        console.error("Failed to fetch institutions", e);
    }
    return [];
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
    try {
        const params = new URLSearchParams();
        params.append('name', query);
        const res = await fetch(`/api/proxy/const-institutions/search?${params.toString()}`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (e) {
        console.error("Failed to search institutions", e);
    }
    return [];
}

export async function fetchAccountsByGroup(institutionId: number): Promise<any[]> {
    try {
        const res = await fetch(`/api/proxy/billing-enquiry-search?accountGroup=${institutionId}`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
            if (data?.value && Array.isArray(data.value)) return data.value;
            return [];
        }
    } catch (e) {
        console.error("Failed to fetch accounts by group", e);
    }
    return [];
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
        if (criteria.erfNumber) body.eftNumber = criteria.erfNumber;
        if (criteria.emailAddress) body.emailAddress = criteria.emailAddress;
        if (criteria.mobileNumber) body.mobileNumber = criteria.mobileNumber;
        if (criteria.physicalMeterNumber) body.physicalMeterNumber = criteria.physicalMeterNumber;
        if (criteria.trading) body.trading = criteria.trading;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await fetch('/api/platinum/billing-enquiry/enquiry-results', {
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
        const [consDetails, nameData, contactDetails] = await Promise.all([
            platinumGetConsAccountDetails(Number(accountId)).catch(() => null),
            platinumFetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`).catch(() => null),
            platinumFetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`).catch(() => null),
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

        console.log(`[Enrich] Account ${accountId} enriched: email=${enriched.email}, oldCode=${enriched.oldCode}, outstanding=${enriched.outstandingAmount}`);
    } catch (e) {
        console.warn(`[Enrich] Failed to enrich account ${accountId}:`, e);
    }

    return enriched;
}

export async function fetchConfigSettings(): Promise<any[]> {
    try {
        const res = await fetch(`/api/proxy/odata/AaaaConfigSettings`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch config settings", e);
    }
    return [];
}


export async function postMultipleAccountPaymentReceipt(capturerId: string, accountId: string | number, receiptId: string | number): Promise<any> {
    const res = await fetch(`/api/proxy/pos-multiple-account-payments/${capturerId}/${accountId}/receipt/${receiptId}`, {
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
    const res = await fetch(`/api/proxy/pos-multi-receipt-print/batch?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch receipts batch');
    return res.json();
}

export async function updateTransactionStatusApi(id: string, status: string, reason?: string): Promise<any> {
    const res = await fetch(`/api/transactions/${id}/status`, {
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

async function platinumFetch(url: string, options?: RequestInit): Promise<any> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Platinum API error (${res.status}): ${text}`);
    }
    return res.json();
}

export async function platinumValidateCashier(userId: number, finYear: string): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/validate-cashier?userId=${userId}&finYear=${encodeURIComponent(finYear)}`);
}

export async function platinumGetConsAccounts(params: Record<string, string>): Promise<any[]> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/receipt-prepaid/cons-accounts?${qs}`);
}

export async function platinumGetConsAccountDetails(accountId: number): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/cons-account-details?accountId=${accountId}`);
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

export async function platinumPrintReceipt(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment/print-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function fetchReceiptAllocations(receiptId: string): Promise<{ service: string; amount: number; vat: number; total: number }[]> {
    try {
        const res = await fetch(`/api/platinum/billing-payment/receipt-allocations?receiptId=${encodeURIComponent(receiptId)}`);
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

export async function platinumGetAuthDayEndCashierList(): Promise<any[]> {
    return platinumFetch(`/api/platinum/auth-day-end/cashier-list`);
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

export async function platinumAuthDayEndSubmitReconcile(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/submit-day-auth-reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumAuthDayEndValidateCashbook(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/auth-day-end/validate-cashbook`, {
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
}

export async function fetchMiscPaymentGroups(): Promise<MiscPaymentGroup[]> {
    const res = await fetch('/api/platinum/billing-payment-miscellaneous/get-groups');
    if (!res.ok) throw new Error('Failed to fetch misc payment groups');
    return res.json();
}

export async function fetchMiscPaymentScoaItems(groupId: number): Promise<MiscPaymentScoaItem[]> {
    const res = await fetch(`/api/platinum/billing-payment-miscellaneous/get-scoa-items?mISCPayGroupId=${groupId}`);
    if (!res.ok) throw new Error('Failed to fetch SCOA items');
    const items = await res.json();
    return items;
}

export async function fetchMiscPaymentVatRate(): Promise<number> {
    const res = await fetch('/api/platinum/billing-payment-miscellaneous/get-vat-rate');
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
    const res = await fetch('/api/platinum/billing-payment-miscellaneous/submit', {
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
    return result;
}

export async function rebuildFullAccount(accountId: number): Promise<any> {
    const res = await fetch(`/api/platinum/billing-enquiry/rebuild-full-account?accountId=${accountId}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to rebuild account ${accountId}: ${text}`);
    }
    return res.json();
}

export async function submitConsumerPayment(userId: number, data: any): Promise<any> {
    const res = await fetch(`/api/platinum/billing-payment/submit-consumer-payment/${userId}`, {
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


export async function submitPrepaidPayment(data: any): Promise<any> {
    const res = await fetch('/api/platinum/receipt-prepaid/submit-prepaid-payment', {
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
    const res = await fetch('/api/platinum/billing-dashboard/get-deposit-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetDirectDepositsAllocationTableData(pager: any): Promise<any> {
    const res = await fetch('/api/platinum/billing-dashboard/get-direct-deposits-allocation-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetThirdPartyPaymentPendingTableData(pager: any): Promise<any> {
    const res = await fetch('/api/platinum/billing-dashboard/get-third-party-payment-pending-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function platinumGetPostDatedChequeTableData(pager: any): Promise<any> {
    const res = await fetch('/api/platinum/billing-dashboard/get-post-dated-cheque-search-table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pager),
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

export async function fetchReceiptList(query: ReceiptSearchQuery): Promise<ReceiptListResponse> {
    try {
        const res = await fetch('/api/platinum/view-receipt/get-receipt-list', {
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
        throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.warn('Failed to fetch receipt list', e);
        return { items: [], totalCount: 0, page: 1, pageSize: 50 };
    }
}

// --- Municipality / Receipt Info ---

export async function getReceiptTransactionDetail(primaryId: number): Promise<any> {
    try {
        const data = await platinumFetch(`/api/platinum/billing-enquiry/receipt-transaction-detail?primaryId=${primaryId}`);
        console.log(`[getReceiptTransactionDetail] primaryId=${primaryId}, response:`, data);
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

const FALLBACK_MUNICIPALITY: MunicipalityInfo = {
    name: 'George UAT Municipality',
    address1: 'York Street 1 George 6530',
    address2: 'George',
    address3: '',
    postalCode: '6530',
    tel: '044 801 9111',
    fax: '',
    vatNo: '4630193664',
    email: '',
    website: '',
    receiptFooter: '',
    receiptHeader: '',
};

let cachedMunicipalityInfo: MunicipalityInfo | null = null;

export async function fetchMunicipalityInfo(): Promise<MunicipalityInfo> {
    if (cachedMunicipalityInfo) return cachedMunicipalityInfo;

    try {
        const res = await fetch('/api/platinum/receipt-info');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const info: MunicipalityInfo = {
            name: data.InstitutionName || data.MunicipalityName || FALLBACK_MUNICIPALITY.name,
            address1: data.InstitutionAddress1 || data.MunicipalityAddress || FALLBACK_MUNICIPALITY.address1,
            address2: data.InstitutionAddress2 || FALLBACK_MUNICIPALITY.address2,
            address3: data.InstitutionAddress3 || FALLBACK_MUNICIPALITY.address3,
            postalCode: data.InstitutionPostalCode || FALLBACK_MUNICIPALITY.postalCode,
            tel: data.InstitutionTel || FALLBACK_MUNICIPALITY.tel,
            fax: data.InstitutionFax || FALLBACK_MUNICIPALITY.fax,
            vatNo: data.VATRegistrationNo || data.MunicipalityVatNo || FALLBACK_MUNICIPALITY.vatNo,
            email: data.InstitutionEmail || FALLBACK_MUNICIPALITY.email,
            website: data.InstitutionWebsite || FALLBACK_MUNICIPALITY.website,
            receiptFooter: data.ReceiptFooter || FALLBACK_MUNICIPALITY.receiptFooter,
            receiptHeader: data.ReceiptHeader || FALLBACK_MUNICIPALITY.receiptHeader,
        };

        cachedMunicipalityInfo = info;
        return info;
    } catch (e) {
        console.warn('Failed to fetch municipality info, using fallback:', e);
        return FALLBACK_MUNICIPALITY;
    }
}
