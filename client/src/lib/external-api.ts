import { CASH_OFFICES, CashOffice, CASHIERS } from "./mock-data";

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
        console.warn("Failed to fetch cash offices from API, using mock data", e);
    }
    return CASH_OFFICES;
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
    return CASHIERS.map(c => ({
        id: c.id,
        name: c.name,
        cashOfficeId: c.cashOffice,
        float: c.float || 0
    }));
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

export async function updateTransactionStatusApi(id: string, status: string, reason?: string): Promise<any> {
    const res = await fetch(`/api/transactions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellationReason: reason }),
    });
    if (!res.ok) throw new Error('Failed to update transaction status');
    return res.json();
}
