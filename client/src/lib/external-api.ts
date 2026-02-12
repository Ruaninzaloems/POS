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
        const [cashiersRes, userDetailsRes] = await Promise.all([
            fetch(`${API_BASE}/odata/ConstCashiers`, {
                headers: { 'Accept': 'application/json' }
            }),
            // Fetch User_UserDetail as requested to get float information
            fetch(`${API_BASE}/odata/UserUserDetails`, {
                headers: { 'Accept': 'application/json' }
            }).catch(e => {
                console.warn("Failed to fetch user details for float", e);
                return null;
            })
        ]);

        let userDetails: any[] = [];
        if (userDetailsRes && userDetailsRes.ok) {
            const data = await userDetailsRes.json();
            userDetails = data.value || [];
        }

        if (cashiersRes.ok) {
            const data = await cashiersRes.json();
            // Map API response to our expected format if needed
            return data.value.map((c: any) => {
                // Link cashier to user detail to get the float
                // Trying common join keys: id, cashierId, userId
                const detail = userDetails.find((u: any) => 
                    u.id === c.id || 
                    u.userId === c.id || 
                    u.userName === c.name
                );

                return {
                    id: c.id || c.cashierId, // specific field mapping might be needed
                    name: c.name || c.cashierName,
                    cashOfficeId: c.cashOfficeId,
                    // Use float from UserDetail if available, otherwise fall back to 0
                    float: detail?.cashFloat || detail?.float || c.float || 0
                };
            }) || [];
        }
    } catch (e: any) {
        console.warn(`Failed to fetch cashiers from API: ${e.message || e}`, e);
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
    allowPrepaidAndMiscellaneous?: boolean;
    allowPrepaidAndRecovery?: boolean;
    allowNormalReceipting?: boolean;
    // Add other config fields
}

export async function fetchBillingConfig(): Promise<BillingConfig | null> {
    try {
        const res = await fetch(`${API_BASE}/odata/BillingConfigSettings`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            const items = data.value || []; // Array of { Id, KeyName, KeyValue }
            
            // Transform array of KV pairs into a single object
            const config: BillingConfig = {
                allowPrepaidAndMiscellaneous: items.find((i: any) => i.KeyName === "Allow Prepaid And Miscellaneous")?.KeyValue === "1",
                allowPrepaidAndRecovery: items.find((i: any) => i.KeyName === "Allow Prepaid And Recovery")?.KeyValue === "1",
                allowNormalReceipting: items.find((i: any) => i.KeyName === "Allow Normal Receipting")?.KeyValue === "1",
                receiptingOptions: items // Store raw items too if needed
            };
            
            return config;
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
        
        // This endpoint might fail with 400 if reference is not found or invalid
        // Need to be robust
        const res = await fetch(`${API_BASE}/api/billing-stage-cashier-receipt-details/reference?${params.toString()}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.value || []);
        } else if (res.status === 404 || res.status === 400) {
            // Not found is a valid result (no receipts)
            return [];
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
        if (criteria.sgNumber) params.append('sgNumber', criteria.sgNumber);
        if (criteria.street) params.append('streetName', criteria.street);
        if (criteria.physicalMeterNumber) params.append('physicalMeterNumber', criteria.physicalMeterNumber);
        if (criteria.oldAccountCode) params.append('oldAccountCode', criteria.oldAccountCode);
        
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
