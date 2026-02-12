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
        const res = await fetch(`${API_BASE}/odata/ConstCashOffices`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            return data.value || [];
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
    return [];
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
