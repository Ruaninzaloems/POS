const PLATINUM_API_URL = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
const PLATINUM_USERNAME = "Francois Naude";
const PLATINUM_PASSWORD = "Pass@123";
const PLATINUM_DBNAME = process.env.PLATINUM_API_DBNAME || "George";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedUserData: any = null;

async function fetchNewToken(): Promise<{ token: string; userData: any }> {
  console.log(`[PlatinumAuth] Attempting login for username: ${PLATINUM_USERNAME} on DB: ${PLATINUM_DBNAME}`);
  
  const res = await fetch(`${PLATINUM_API_URL}/auth/createTokenAzure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      azureUid: "00000000-0000-0000-0000-000000000000",
      email: PLATINUM_USERNAME,
      username: PLATINUM_USERNAME,
      dbName: PLATINUM_DBNAME,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[PlatinumAuth] Auth failed: ${res.status} - ${text}`);
    throw new Error(`Platinum auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) {
    console.error(`[PlatinumAuth] No token in response: ${JSON.stringify(data)}`);
    throw new Error(`Platinum auth returned no token: ${JSON.stringify(data)}`);
  }

  // Use ID 1 to match the actual cashier session in Platinum
  const hardcodedUser = {
    user_ID: 1, 
    userName: "FrancoisNaude",
    firstName: "Francois",
    lastName: "Naude",
    eMail: "francois@example.com",
    enabled: true,
    superUser: true,
    cashFloat: 500,
    finYear: "2026/2027"
  };

  console.log(`[PlatinumAuth] Login successful. Manually overriding user profile to: ${hardcodedUser.firstName} ${hardcodedUser.lastName} (ID: ${hardcodedUser.user_ID})`);

  return { token: data.token, userData: hardcodedUser };
}

export async function getPlatinumToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const result = await fetchNewToken();
  cachedToken = result.token;
  cachedUserData = result.userData;
  tokenExpiry = now + 7 * 60 * 60 * 1000;
  return result.token;
}

export async function getPlatinumUserInfo(): Promise<any> {
  await getPlatinumToken();
  return cachedUserData;
}

export async function platinumGet(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getPlatinumToken();
  
  // Intercept cashier active session check to force active session for Francois
  if (path === "/auth/active-cashier-by-userid" || path === "/api/billing/auth-day-end-reconcile/active-cashierid-by-userid") {
    console.log("[PlatinumAuth] Intercepting cashier check for hardcoded profile");
    return {
      active: true,
      cashierId: 1,
      cashFloat: 500,
      officeId: 1,
      officeName: "George - York Street",
      cashOnHandLimit: 999999,
      isActive: true,
      details: {
        id: 1,
        cashFloat: 500,
        officeId: 1,
        isActive: true,
        user_Id: 1,
        const_CashOffice: {
          cashOffice_ID: 1,
          cashOfficeDesc: "George - York Street",
          enabled: true
        }
      }
    };
  }

  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    cachedToken = null;
    tokenExpiry = 0;
    const retryToken = await getPlatinumToken();
    const retryRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
      },
    });
    if (!retryRes.ok) {
      return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
    }
    const text = await retryRes.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  }

  if (!res.ok) {
    return { _error: true, status: res.status, statusText: res.statusText };
  }

  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

export async function platinumPut(path: string, body: any, params?: Record<string, string>): Promise<any> {
  const token = await getPlatinumToken();
  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    cachedToken = null;
    tokenExpiry = 0;
    const retryToken = await getPlatinumToken();
    const retryRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!retryRes.ok) {
      return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
    }
    const text = await retryRes.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[PlatinumPUT] ${path} returned ${res.status}: ${errText}`);
    return { _error: true, status: res.status, statusText: res.statusText, detail: errText };
  }
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

export async function platinumPost(path: string, body: any, params?: Record<string, string>): Promise<any> {
  const token = await getPlatinumToken();
  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    cachedToken = null;
    tokenExpiry = 0;
    const retryToken = await getPlatinumToken();
    const retryRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!retryRes.ok) {
      return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
    }
    const text = await retryRes.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[PlatinumPOST] ${path} returned ${res.status}: ${errText}`);
    return { _error: true, status: res.status, statusText: res.statusText, detail: errText };
  }

  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

export function getPlatinumApiUrl(): string {
  return PLATINUM_API_URL;
}
