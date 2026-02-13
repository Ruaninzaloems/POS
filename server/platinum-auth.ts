const PLATINUM_API_URL = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
const PLATINUM_USERNAME = "Francois";
const PLATINUM_DBNAME = process.env.PLATINUM_API_DBNAME || "George";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedUserData: any = null;
let cachedPosCashierId: number | null = null;

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

  // API returns Test User (ID:1) regardless of credentials - override with actual Francois profile
  // Francois Francois = user_ID 4697
  const hardcodedUser = {
    user_ID: 4697, 
    userName: "Francois",
    firstName: "Francois",
    lastName: "Francois",
    eMail: null,
    enabled: true,
    superUser: true,
    cashFloat: 0,
    finYear: data.data?.finYear || "2026/2027"
  };

  console.log(`[PlatinumAuth] Token obtained. Using Francois Francois profile (user_ID: 4697)`);

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

export async function getPosCashierId(): Promise<number | null> {
  if (cachedPosCashierId) return cachedPosCashierId;
  
  const token = await getPlatinumToken();
  try {
    const res = await fetch(`${PLATINUM_API_URL}/api/billing/auth-day-end-reconcile/pos-cashier?cashierId=4697`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        cachedPosCashierId = data.id;
        console.log(`[PlatinumAuth] POS Cashier session ID: ${data.id}, office: ${data.cashOfficeName}`);
        return data.id;
      }
    }
  } catch (e) {
    console.error(`[PlatinumAuth] Failed to get POS cashier ID:`, e);
  }
  return null;
}

export async function platinumGet(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getPlatinumToken();

  // Intercept cashier-detailsById to fetch actual cashier 4697 details from Platinum
  if (path === "/api/ReceiptPrepaid/cashier-detailsById" && params?.cashierId === "1") {
    params = { ...params, cashierId: "4697" };
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
