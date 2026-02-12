import { AccountGroup, CASH_OFFICES, CashOffice } from "./mock-data";

const API_BASE = "https://george-uat-ems-billing-api.azurewebsites.net";

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
        // Attempt to fetch from API first
        // Based on user screenshot: Const_CashOffice table
        // URL seems to follow OData convention based on table name
        const res = await fetch(`${API_BASE}/odata/ConstCashOffices`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            const items = data.value || [];
            
            // Map API fields to internal CashOffice interface
            return items.map((item: any) => ({
                id: item.cashOfficeId?.toString() || item.id?.toString(),
                name: item.cashOfficeDesc || item.name,
                // Default values for fields not in screenshot
                ledgerVote: item.ledgerVote || "Unknown Vote",
                maxTransactionLimit: item.maxTransactionLimit || 5000
            }));
        }
    } catch (e) {
        console.warn("Failed to fetch cash offices from API, using mock data", e);
    }
    
    // Fallback to mock data if API fails or doesn't exist yet
    return CASH_OFFICES;
}

export interface ApiCashier {
    id: string;
    name: string;
    cashOfficeId: string;
    float: number;
    // Add other fields as they appear in the API
}

export async function fetchCashiers(): Promise<ApiCashier[]> {
    try {
        const res = await fetch(`${API_BASE}/odata/ConstCashiers`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            // Map API response to our expected format if needed
            return data.value.map((c: any) => ({
                id: c.id || c.cashierId, // specific field mapping might be needed
                name: c.name || c.cashierName,
                cashOfficeId: c.cashOfficeId,
                float: c.float || 0
            })) || [];
        }
    } catch (e) {
        console.warn("Failed to fetch cashiers from API", e);
    }
    
    // Fallback to mock data if API fails or doesn't exist yet
    return CASHIERS.map(c => ({
        id: c.id,
        name: c.name,
        cashOfficeId: c.cashOffice, 
        float: c.float || 0
    }));
}

export interface BillingConfig {
    receiptingOptions?: any;
    // Add other config fields
}

export async function fetchBillingConfig(): Promise<BillingConfig | null> {
    try {
        const res = await fetch(`${API_BASE}/odata/BillingConfigSettings`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            return data.value?.[0] || null; // OData returns array
        }
    } catch (e) {
        console.warn("Failed to fetch billing config", e);
    }
    return null;
}

export async function fetchBillingStageCashierReceiptDetails(reference: string): Promise<any[]> {
    try {
        const params = new URLSearchParams();
        params.append('reference', reference);
        
        const res = await fetch(`${API_BASE}/api/billing-stage-cashier-receipt-details/reference?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.value || []);
        }
    } catch (e) {
        console.warn(`Failed to fetch receipt details for reference ${reference}`, e);
    }
    return [];
}

export async function fetchBillingStagePrepaidRecharge(id: string): Promise<any | null> {
    try {
        const res = await fetch(`${API_BASE}/api/billing-stage-prepaid-recharge/${id}`, {
            headers: { 'Accept': 'application/json' }
        });
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
            url = `${API_BASE}/api/billing-stage-prepaid-recovery/${identifier}`;
        } else {
            const params = new URLSearchParams();
            params.append('reference', identifier);
            url = `${API_BASE}/api/billing-stage-prepaid-recovery/reference?${params.toString()}`;
        }

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            // Handle array return for reference search if needed, but assuming single object or list based on endpoint name
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
        const res = await fetch(`${API_BASE}/api/cons-accounts/${id}`, {
             headers: { 'Accept': 'application/json' }
        });
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
        const res = await fetch(`${API_BASE}/odata/ConstBanks`, {
            headers: { 'Accept': 'application/json' }
        });
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
        const res = await fetch(`${API_BASE}/odata/ConstGroupCodes`, {
            headers: { 'Accept': 'application/json' }
        });
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
        const res = await fetch(`${API_BASE}/odata/ConstInstitutions`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            return data.value || [];
        }
    } catch (e) {
        console.error("Failed to fetch institutions", e);
    }
    return [];
}

export async function fetchAccounts(criteria: any): Promise<any[]> {
    try {
        // Construct query parameters based on criteria
        const params = new URLSearchParams();
        if (criteria.accountNo) params.append('accountNumber', criteria.accountNo);
        if (criteria.name) params.append('name', criteria.name);
        if (criteria.idNo) params.append('idNumber', criteria.idNo);
        
        // Use the endpoint provided by user
        const res = await fetch(`${API_BASE}/api/cons-accounts/search?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
            const data = await res.json();
            // Handle both OData wrapper and direct array return styles
            return Array.isArray(data) ? data : (data.value || []);
        }
    } catch (e) {
        console.error("Failed to fetch accounts", e);
    }
    return [];
}

export async function fetchConfigSettings(): Promise<any[]> {
    try {
        const res = await fetch(`${API_BASE}/api/aaaa-config-settings`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Failed to fetch config settings", e);
    }
    return [];
}
