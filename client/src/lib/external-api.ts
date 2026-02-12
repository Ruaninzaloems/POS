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
