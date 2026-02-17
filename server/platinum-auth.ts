const PLATINUM_API_URL = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
const PLATINUM_USERNAME = process.env.PLATINUM_API_USERNAME || "Francois";
const PLATINUM_PASSWORD = process.env.PLATINUM_API_PASSWORD || "";
const PLATINUM_DBNAME = process.env.PLATINUM_API_DBNAME || "George";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedUserData: any = null;
let cachedPosCashierId: number | null = null;
let cachedAuthMode: 'direct' | 'azure' | 'override' = 'override';
let userLoggedIn: boolean = false;

async function fetchNewToken(): Promise<{ token: string; userData: any; authMode: 'direct' | 'azure' | 'override' }> {
  console.log(`[PlatinumAuth] Attempting login for username: ${PLATINUM_USERNAME} on DB: ${PLATINUM_DBNAME}`);

  if (PLATINUM_PASSWORD) {
    try {
      const res = await fetch(`${PLATINUM_API_URL}/auth/createToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: PLATINUM_USERNAME,
          password: PLATINUM_PASSWORD,
          dbName: PLATINUM_DBNAME,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          const userData = data.data || data.user || data.userData || {};
          const apiUserId = userData.user_ID ?? userData.userId ?? userData.id;

          if (apiUserId && apiUserId !== 1) {
            const user = {
              user_ID: apiUserId,
              userName: userData.userName ?? PLATINUM_USERNAME,
              firstName: userData.firstName ?? PLATINUM_USERNAME,
              lastName: userData.lastName ?? PLATINUM_USERNAME,
              eMail: userData.eMail ?? null,
              enabled: userData.enabled ?? true,
              superUser: userData.superUser ?? false,
              cashFloat: userData.cashFloat ?? 0,
              finYear: userData.finYear || data.finYear || "2026/2027"
            };
            console.log(`[PlatinumAuth] Token obtained via createToken. User: ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
            return { token: data.token, userData: user, authMode: 'direct' as const };
          }
          console.log(`[PlatinumAuth] createToken returned generic user (ID:${apiUserId}), will use override`);
        }
      } else {
        const text = await res.text();
        console.log(`[PlatinumAuth] createToken failed (${res.status}): ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`[PlatinumAuth] createToken error: ${e.message}`);
    }
  }

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

  const apiUserData = data.data || data.user || data.userData || {};
  const apiUserId = apiUserData.user_ID ?? apiUserData.userId ?? apiUserData.id;

  if (apiUserId && apiUserId !== 1) {
    const user = {
      user_ID: apiUserId,
      userName: apiUserData.userName ?? PLATINUM_USERNAME,
      firstName: apiUserData.firstName ?? PLATINUM_USERNAME,
      lastName: apiUserData.lastName ?? PLATINUM_USERNAME,
      eMail: apiUserData.eMail ?? null,
      enabled: apiUserData.enabled ?? true,
      superUser: apiUserData.superUser ?? false,
      cashFloat: apiUserData.cashFloat ?? 0,
      finYear: apiUserData.finYear || data.finYear || "2026/2027"
    };
    console.log(`[PlatinumAuth] Token obtained. User: ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
    return { token: data.token, userData: user, authMode: 'azure' as const };
  }

  const overrideUser = {
    user_ID: 213, 
    userName: "Francois Naude",
    firstName: "Francois",
    lastName: "Naude",
    eMail: "FrancoisN@Solvem.co.za",
    enabled: true,
    superUser: false,
    cashFloat: 0,
    finYear: apiUserData.finYear || data.finYear || "2025/2026"
  };

  console.log(`[PlatinumAuth] Token obtained. API returned generic user (ID:${apiUserId}) — overriding with Francois Naude (user_ID: 213)`);
  console.log(`[PlatinumAuth] NOTE: The JWT token identity is 'System Administration' (ID:1). Platinum enquiries will attribute actions to this token user, not to the userId parameter.`);
  console.log(`[PlatinumAuth] To fix this, the Platinum admin must configure the Azure SSO mapping to resolve '${PLATINUM_USERNAME}' to the correct user.`);

  return { token: data.token, userData: overrideUser, authMode: 'override' as const };
}

export async function getPlatinumToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const result = await fetchNewToken();
  cachedToken = result.token;
  cachedUserData = result.userData;
  cachedAuthMode = result.authMode;
  tokenExpiry = now + 7 * 60 * 60 * 1000;
  return result.token;
}

export async function getPlatinumUserInfo(): Promise<any> {
  if (!userLoggedIn) return null;
  await getPlatinumToken();
  return cachedUserData;
}

export function getPlatinumAuthMode(): 'direct' | 'azure' | 'override' {
  return cachedAuthMode;
}

export async function loginWithCredentials(username: string, password: string, dbName?: string): Promise<{ success: boolean; userData?: any; error?: string }> {
  const db = dbName || PLATINUM_DBNAME;

  if (password) {
    try {
      const res = await fetch(`${PLATINUM_API_URL}/auth/createToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: username, password, dbName: db }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          const apiUserData = data.data || data.user || data.userData || {};
          const apiUserId = apiUserData.user_ID ?? apiUserData.userId ?? apiUserData.id;

          if (apiUserId && apiUserId !== 1) {
            const user = {
              user_ID: apiUserId,
              userName: apiUserData.userName ?? username,
              firstName: apiUserData.firstName ?? username,
              lastName: apiUserData.lastName ?? '',
              eMail: apiUserData.eMail ?? null,
              enabled: apiUserData.enabled ?? true,
              superUser: apiUserData.superUser ?? false,
              cashFloat: apiUserData.cashFloat ?? 0,
              finYear: apiUserData.finYear || data.finYear || "2025/2026",
              authMode: 'direct' as const
            };

            cachedToken = data.token;
            cachedUserData = user;
            cachedAuthMode = 'direct';
            cachedPosCashierId = null;
            tokenExpiry = Date.now() + 7 * 60 * 60 * 1000;
            userLoggedIn = true;

            console.log(`[PlatinumAuth] Login successful via createToken: ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
            return { success: true, userData: user };
          }
        }
      } else {
        const text = await res.text();
        console.log(`[PlatinumAuth] createToken failed for ${username}: ${res.status} - ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`[PlatinumAuth] createToken error: ${e.message}`);
    }
  }

  try {
    const res = await fetch(`${PLATINUM_API_URL}/auth/createTokenAzure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        azureUid: "00000000-0000-0000-0000-000000000000",
        email: username,
        username: username,
        dbName: db,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`[PlatinumAuth] Login failed for ${username}: ${res.status} - ${text.substring(0, 200)}`);
      return { success: false, error: `User "${username}" not found in the system` };
    }

    const data = await res.json();
    if (!data.token) {
      return { success: false, error: "No token returned from server" };
    }

    const apiUserData = data.data || data.user || data.userData || {};
    const apiUserId = apiUserData.user_ID ?? apiUserData.userId ?? apiUserData.id;
    const tokenUserName = apiUserData.userName ?? '';

    cachedToken = data.token;
    tokenExpiry = Date.now() + 7 * 60 * 60 * 1000;

    if (tokenUserName.toLowerCase() !== username.toLowerCase() && apiUserId) {
      console.log(`[PlatinumAuth] Token resolved to ${tokenUserName} (ID:${apiUserId}), but login was for "${username}". Looking up actual user...`);
      try {
        const userListRes = await fetch(`${PLATINUM_API_URL}/api/User`, {
          headers: { Authorization: `Bearer ${data.token}`, Accept: "application/json" },
        });
        if (userListRes.ok) {
          const users: any[] = await userListRes.json();
          const matchedUser = users.find((u: any) =>
            u.userName?.toLowerCase() === username.toLowerCase() ||
            u.email?.toLowerCase() === username.toLowerCase()
          );
          if (matchedUser) {
            const user = {
              user_ID: matchedUser.userId,
              userName: matchedUser.userName,
              firstName: matchedUser.firstName || username,
              lastName: matchedUser.lastName || '',
              eMail: matchedUser.email || null,
              enabled: matchedUser.enabled ?? true,
              superUser: matchedUser.superUser ?? false,
              cashFloat: matchedUser.cashFloat ?? 0,
              finYear: apiUserData.finYear || data.finYear || "2025/2026",
              authMode: 'azure' as const
            };
            cachedUserData = user;
            cachedAuthMode = 'azure';
            cachedPosCashierId = null;
            userLoggedIn = true;
            console.log(`[PlatinumAuth] Login successful — resolved "${username}" to ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
            return { success: true, userData: user };
          } else {
            cachedToken = null;
            tokenExpiry = 0;
            console.log(`[PlatinumAuth] User "${username}" not found in Platinum user list`);
            return { success: false, error: `User "${username}" not found in the system. Please check the username.` };
          }
        }
      } catch (lookupErr: any) {
        console.log(`[PlatinumAuth] User lookup failed: ${lookupErr.message}, using token user`);
      }
    }

    const user = {
      user_ID: apiUserId || 0,
      userName: apiUserData.userName ?? username,
      firstName: apiUserData.firstName ?? username,
      lastName: apiUserData.lastName ?? '',
      eMail: apiUserData.eMail ?? null,
      enabled: apiUserData.enabled ?? true,
      superUser: apiUserData.superUser ?? false,
      cashFloat: apiUserData.cashFloat ?? 0,
      finYear: apiUserData.finYear || data.finYear || "2025/2026",
      authMode: 'azure' as const
    };

    cachedUserData = user;
    cachedAuthMode = 'azure';
    cachedPosCashierId = null;

    console.log(`[PlatinumAuth] Login successful via Azure: ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
    userLoggedIn = true;
    return { success: true, userData: user };
  } catch (e: any) {
    console.error(`[PlatinumAuth] Login error:`, e.message);
    return { success: false, error: "Could not connect to the billing system" };
  }
}

export function logoutUser(): void {
  cachedToken = null;
  cachedUserData = null;
  cachedPosCashierId = null;
  cachedAuthMode = 'override';
  tokenExpiry = 0;
  userLoggedIn = false;
  console.log(`[PlatinumAuth] User logged out`);
}

export function isAuthenticated(): boolean {
  return userLoggedIn && !!(cachedToken && cachedUserData && tokenExpiry > Date.now());
}

export async function getPosCashierId(): Promise<number | null> {
  if (cachedPosCashierId) return cachedPosCashierId;
  
  const token = await getPlatinumToken();
  if (!cachedUserData?.user_ID) {
    console.error(`[PlatinumAuth] Cannot get POS cashier ID: no authenticated user data available`);
    return null;
  }
  const userId = cachedUserData.user_ID;
  try {
    const res = await fetch(`${PLATINUM_API_URL}/api/billing/auth-day-end-reconcile/pos-cashier?cashierId=${userId}`, {
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

  const actualUserId = String(cachedUserData?.user_ID || 1);
  if (path === "/api/ReceiptPrepaid/cashier-detailsById" && params?.cashierId && params.cashierId !== actualUserId) {
    params = { ...params, cashierId: actualUserId };
  }

  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (res.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      const retryToken = await getPlatinumToken();
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 30000);
      try {
        const retryRes = await fetch(url, {
          headers: {
            Authorization: `Bearer ${retryToken}`,
            Accept: "application/json",
          },
          signal: retryController.signal,
        });
        if (!retryRes.ok) {
          return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
        }
        const text = await retryRes.text();
        try { return text ? JSON.parse(text) : null; } catch { return text; }
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[PlatinumGET] ${path} returned ${res.status}: ${errBody.substring(0, 500)}`);
      return { _error: true, status: res.status, statusText: res.statusText, detail: errBody.substring(0, 500) };
    }

    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error(`[PlatinumGET] ${path} timed out after 30s`);
      return { _error: true, status: 408, statusText: 'Request Timeout' };
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      const retryToken = await getPlatinumToken();
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), 30000);
      try {
        const retryRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${retryToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: retryController.signal,
        });
        if (!retryRes.ok) {
          return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
        }
        const text = await retryRes.text();
        try { return text ? JSON.parse(text) : null; } catch { return text; }
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[PlatinumPOST] ${path} returned ${res.status}: ${errText}`);
      return { _error: true, status: res.status, statusText: res.statusText, detail: errText };
    }

    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error(`[PlatinumPOST] ${path} timed out after 30s`);
      return { _error: true, status: 408, statusText: 'Request Timeout' };
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getPlatinumApiUrl(): string {
  return PLATINUM_API_URL;
}
