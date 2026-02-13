import { CashOffice } from "./mock-data";

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

export async function fetchAccounts(criteria: any): Promise<any[]> {
    try {
        const params = new URLSearchParams();
        if (criteria.accountNo) params.append('accountId', criteria.accountNo);
        if (criteria.oldAccountCode) params.append('oldAccount', criteria.oldAccountCode);
        if (criteria.name) params.append('companyName', criteria.name);
        if (criteria.idNo) params.append('idRegistrationNumber', criteria.idNo);
        if (criteria.passportNumber) params.append('passportNumber', criteria.passportNumber);
        if (criteria.deliveryAddress) params.append('deliveryAddress', criteria.deliveryAddress);
        if (criteria.locationAddress) params.append('locationAddress', criteria.locationAddress);
        if (criteria.street) params.append('locationAddress', criteria.street);
        if (criteria.allotmentArea) params.append('allotmentArea', criteria.allotmentArea);
        if (criteria.erfNumber) params.append('eftNumber', criteria.erfNumber);
        if (criteria.emailAddress) params.append('emailAddress', criteria.emailAddress);
        if (criteria.mobileNumber) params.append('mobileNumber', criteria.mobileNumber);
        if (criteria.physicalMeterNumber) params.append('physicalMeterNumber', criteria.physicalMeterNumber);
        if (criteria.trading) params.append('trading', criteria.trading);

        const res = await fetch(`/api/proxy/billing-enquiry-search?${params.toString()}`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.value || []);
        }
    } catch (e) {
        console.error("Failed to fetch accounts", e);
    }
    return [];
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

export async function createSessionApi(data: {
    cashierId: string;
    cashierName: string;
    cashOfficeId: string;
    cashOfficeName?: string;
    floatAmount: number;
}): Promise<any> {
    const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
}

export async function endSessionApi(sessionId: string): Promise<any> {
    const res = await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to end session');
    return res.json();
}

export async function createTransactionApi(data: any): Promise<any> {
    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    return res.json();
}

export async function listTransactionsApi(filters?: {
    cashierId?: string;
    cashOfficeId?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
}): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.cashierId) params.append('cashierId', filters.cashierId);
    if (filters?.cashOfficeId) params.append('cashOfficeId', filters.cashOfficeId);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);
    if (filters?.status) params.append('status', filters.status);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to list transactions');
    return res.json();
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

export async function platinumValidateCashier(userId: number, finYear: number): Promise<any> {
    return platinumFetch(`/api/platinum/receipt-prepaid/validate-cashier?userId=${userId}&finYear=${finYear}`);
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

export async function platinumGetCashOffices(): Promise<any[]> {
    return platinumFetch(`/api/platinum/receipt-prepaid/cash-offices`);
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

export async function platinumSubmitMultiplePayment(userId: string, data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
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

export async function platinumSaveDayEndReconcileData(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/billing-payment-day-end/save-reconcile-data`, {
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

export async function platinumGetBankReconPosItemList(data: any): Promise<any[]> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
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

export async function platinumLoadDetailsPaymentGrouping(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-payment-grouping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function platinumLoadDetailsConsumerServices(data: any): Promise<any> {
    return platinumFetch(`/api/platinum/direct-deposit-allocation/load-details-consumer-services`, {
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

export async function platinumGetDepositAmount(params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return platinumFetch(`/api/platinum/billing-enquiry/deposit-amount?${qs}`);
}

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
    return res.json();
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
    return res.json();
}

export async function submitMultiplePayment(userId: number, data: any): Promise<any> {
    const res = await fetch(`/api/platinum/billing-payment/submit-multiple-payment/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to submit multiple payment: ${text}`);
    }
    return res.json();
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
