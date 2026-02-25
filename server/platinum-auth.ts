const PLATINUM_API_URL = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
const PLATINUM_USERNAME = process.env.PLATINUM_API_USERNAME || "Francois";
const PLATINUM_PASSWORD = process.env.PLATINUM_API_PASSWORD || "";
const PLATINUM_DBNAME = process.env.PLATINUM_API_DBNAME || "George";

export interface UserSession {
  token: string;
  tokenExpiry: number;
  userData: any;
  posCashierId: number | null;
  authMode: 'direct' | 'azure' | 'override';
  loggedIn: boolean;
}

export function createEmptySession(): UserSession {
  return { token: '', tokenExpiry: 0, userData: null, posCashierId: null, authMode: 'override', loggedIn: false };
}

const responseCache = new Map<string, { data: any; ts: number }>();
const RESPONSE_CACHE_TTL = 30 * 1000;
const RESPONSE_CACHE_MAX = 500;

const inFlightRequests = new Map<string, Promise<any>>();

function getResponseCache(key: string, ttl: number = RESPONSE_CACHE_TTL): any | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setResponseCache(key: string, data: any): void {
  responseCache.set(key, { data, ts: Date.now() });
  if (responseCache.size > RESPONSE_CACHE_MAX) {
    const oldest = Array.from(responseCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 100; i++) responseCache.delete(oldest[i][0]);
  }
}

const CACHEABLE_PATHS = [
  '/api/BillingEnquiry/',
  '/api/ReceiptPrepaid/cashier-detailsById',
  '/api/ReceiptPrepaid/active-cashier-details',
  '/api/billing-payment/payment-options',
  '/api/billing-payment/payment-types',
];

const SHORT_CACHEABLE_PATHS: string[] = [];
const SHORT_RESPONSE_CACHE_TTL = 5 * 1000;

const NEVER_CACHE_PATHS = [
  '/api/BillingEnquiry/rebuild-full-account',
  '/api/BillingEnquiry/TotalBalanceDebtInquiry',
  '/api/billing-payment/submit-consumer-payment',
  '/api/billing-payment/submit-multiple-payment',
  '/api/billing-payment/save-multiple-account-payment',
  '/api/ReceiptPrepaid/validate-cashier',
  '/api/ReceiptPrepaid/ValidateCashierDayEndRecon',
  '/api/billing-payment-day-end-reconcile/save-Reconcile-data',
];

function getCacheableInfo(path: string): { cacheable: boolean; ttl: number } {
  if (NEVER_CACHE_PATHS.some(p => path.includes(p))) return { cacheable: false, ttl: 0 };
  if (CACHEABLE_PATHS.some(p => path.startsWith(p))) return { cacheable: true, ttl: RESPONSE_CACHE_TTL };
  if (SHORT_CACHEABLE_PATHS.some(p => path.startsWith(p))) return { cacheable: true, ttl: SHORT_RESPONSE_CACHE_TTL };
  return { cacheable: false, ttl: 0 };
}

const USER_SPECIFIC_PATHS = [
  '/api/ReceiptPrepaid/validate-cashier',
  '/api/ReceiptPrepaid/cashier-detailsById',
  '/api/ReceiptPrepaid/active-cashier-details',
  '/api/billing-payment/payment-options',
  '/api/billing-payment/payment-types',
];

function isUserSpecificPath(path: string): boolean {
  return USER_SPECIFIC_PATHS.some(p => path.startsWith(p));
}

let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 100;
const requestQueue: Array<{ resolve: () => void }> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    requestQueue.push({ resolve });
  });
}

function releaseSlot(): void {
  activeRequests--;
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    const next = requestQueue.shift()!;
    next.resolve();
  }
}

const tokenRefreshPromises = new Map<string, Promise<{ token: string; userData: any; authMode: 'direct' | 'azure' | 'override' }>>();

async function fetchTokenForUser(username: string, password: string, dbName: string): Promise<{ token: string; userData: any; authMode: 'direct' | 'azure' | 'override' }> {
  console.log(`[PlatinumAuth] Attempting login for username: ${username} on DB: ${dbName}`);

  const usernamesToTry = [username];
  if (PLATINUM_USERNAME && PLATINUM_USERNAME.toLowerCase() !== username.toLowerCase()) {
    usernamesToTry.push(PLATINUM_USERNAME);
  }

  if (password) {
    for (const tryName of usernamesToTry) {
      try {
        const res = await fetch(`${PLATINUM_API_URL}/auth/createToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: tryName, password, dbName }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            const userData = data.data || data.user || data.userData || {};
            const apiUserId = userData.user_ID ?? userData.userId ?? userData.id;

            if (apiUserId && apiUserId !== 1) {
              const user = {
                user_ID: apiUserId,
                userName: userData.userName ?? tryName,
                firstName: userData.firstName ?? tryName,
                lastName: userData.lastName ?? '',
                eMail: userData.eMail ?? null,
                enabled: userData.enabled ?? true,
                superUser: userData.superUser ?? false,
                cashFloat: userData.cashFloat ?? 0,
                finYear: userData.finYear || data.finYear || "2026/2027"
              };
              console.log(`[PlatinumAuth] Token obtained via createToken (tried "${tryName}"). User: ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
              return { token: data.token, userData: user, authMode: 'direct' as const };
            }
            console.log(`[PlatinumAuth] createToken for "${tryName}" returned generic user (ID:${apiUserId}), will try next`);
          }
        } else {
          const text = await res.text();
          console.log(`[PlatinumAuth] createToken failed for "${tryName}": ${res.status} - ${text.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.log(`[PlatinumAuth] createToken error for "${tryName}": ${e.message}`);
      }
    }
  }

  const res = await fetch(`${PLATINUM_API_URL}/auth/createTokenAzure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      azureUid: "00000000-0000-0000-0000-000000000000",
      email: username,
      username: username,
      dbName,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log(`[PlatinumAuth] Azure auth failed for ${username}: ${res.status} - ${text.substring(0, 200)}`);
    throw new Error(`User "${username}" not found in the system`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error("No token returned from server");
  }

  const apiUserData = data.data || data.user || data.userData || {};
  const apiUserId = apiUserData.user_ID ?? apiUserData.userId ?? apiUserData.id;
  const tokenUserName = apiUserData.userName ?? '';

  if (tokenUserName.toLowerCase() !== username.toLowerCase() && apiUserId) {
    console.log(`[PlatinumAuth] Token resolved to ${tokenUserName} (ID:${apiUserId}), looking up actual user "${username}"...`);
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
          console.log(`[PlatinumAuth] Login successful — resolved "${username}" to ${user.firstName} ${user.lastName} (user_ID: ${user.user_ID})`);
          return { token: data.token, userData: user, authMode: 'azure' as const };
        } else {
          throw new Error(`User "${username}" not found in the system. Please check the username.`);
        }
      }
    } catch (lookupErr: any) {
      if (lookupErr.message.includes('not found')) throw lookupErr;
      console.log(`[PlatinumAuth] User lookup failed: ${lookupErr.message}, using token user`);
    }
  }

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
      finYear: apiUserData.finYear || data.finYear || "2025/2026"
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
  return { token: data.token, userData: overrideUser, authMode: 'override' as const };
}

export async function refreshSessionToken(session: UserSession): Promise<string> {
  const now = Date.now();
  if (session.token && session.tokenExpiry > now + 60000) {
    return session.token;
  }

  const username = PLATINUM_USERNAME || session.userData?.userName || 'Francois';
  const mutexKey = `refresh-${username}`;

  const existing = tokenRefreshPromises.get(mutexKey);
  if (existing) {
    const result = await existing;
    session.token = result.token;
    session.tokenExpiry = Date.now() + 7 * 60 * 60 * 1000;
    return result.token;
  }

  const promise = fetchTokenForUser(username, PLATINUM_PASSWORD, PLATINUM_DBNAME);
  tokenRefreshPromises.set(mutexKey, promise);
  try {
    const result = await promise;
    session.token = result.token;
    session.tokenExpiry = Date.now() + 7 * 60 * 60 * 1000;
    return result.token;
  } finally {
    tokenRefreshPromises.delete(mutexKey);
  }
}

export async function loginWithCredentials(username: string, password: string, dbName?: string): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  const db = dbName || PLATINUM_DBNAME;
  try {
    const result = await fetchTokenForUser(username, password, db);
    const session: UserSession = {
      token: result.token,
      tokenExpiry: Date.now() + 7 * 60 * 60 * 1000,
      userData: result.userData,
      posCashierId: null,
      authMode: result.authMode,
      loggedIn: true,
    };
    console.log(`[PlatinumAuth] Login successful: ${result.userData.firstName} ${result.userData.lastName} (user_ID: ${result.userData.user_ID})`);
    return { success: true, session };
  } catch (e: any) {
    console.log(`[PlatinumAuth] Login failed for ${username}: ${e.message}`);
    return { success: false, error: e.message || "Could not connect to the billing system" };
  }
}

export function logoutSession(session: UserSession): void {
  const name = session.userData ? `${session.userData.firstName} ${session.userData.lastName}` : 'unknown';
  session.token = '';
  session.tokenExpiry = 0;
  session.userData = null;
  session.posCashierId = null;
  session.authMode = 'override';
  session.loggedIn = false;
  console.log(`[PlatinumAuth] User logged out: ${name}`);
}

export function isSessionAuthenticated(session: UserSession): boolean {
  return session.loggedIn && !!(session.token && session.userData && session.tokenExpiry > Date.now());
}

export async function getSessionPosCashierId(session: UserSession): Promise<number | null> {
  if (session.posCashierId) return session.posCashierId;

  const token = await refreshSessionToken(session);
  if (!session.userData?.user_ID) {
    console.error(`[PlatinumAuth] Cannot get POS cashier ID: no authenticated user data`);
    return null;
  }
  const userId = session.userData.user_ID;
  try {
    const res = await fetch(`${PLATINUM_API_URL}/api/billing/auth-day-end-reconcile/pos-cashier?cashierId=${userId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        session.posCashierId = data.id;
        console.log(`[PlatinumAuth] POS Cashier session ID: ${data.id}, office: ${data.cashOfficeName} (user: ${session.userData.userName})`);
        return data.id;
      }
    }
  } catch (e) {
    console.error(`[PlatinumAuth] Failed to get POS cashier ID:`, e);
  }
  return null;
}

function buildCacheKey(url: string, session: UserSession, path: string): string {
  if (isUserSpecificPath(path)) {
    return `u${session.userData?.user_ID || 0}:${url}`;
  }
  return url;
}

export async function platinumGet(session: UserSession, path: string, params?: Record<string, string>, options?: { timeoutMs?: number }): Promise<any> {
  const timeoutMs = options?.timeoutMs || 30000;

  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const cacheInfo = getCacheableInfo(path);
  const cacheKey = buildCacheKey(url, session, path);
  if (cacheInfo.cacheable) {
    const cached = getResponseCache(cacheKey, cacheInfo.ttl);
    if (cached !== undefined) return cached;
  }

  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const doFetch = async () => {
    await acquireSlot();
  try {
    const token = await refreshSessionToken(session);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: controller.signal,
      });

      if (res.status === 401) {
        session.token = '';
        session.tokenExpiry = 0;
        const retryToken = await refreshSessionToken(session);
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 30000);
        try {
          const retryRes = await fetch(url, {
            headers: { Authorization: `Bearer ${retryToken}`, Accept: "application/json" },
            signal: retryController.signal,
          });
          if (!retryRes.ok) return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
          const text = await retryRes.text();
          try {
            const data = text ? JSON.parse(text) : null;
            if (cacheInfo.cacheable && data && !data._error) setResponseCache(buildCacheKey(url, session, path), data);
            return data;
          } catch { return text; }
        } finally { clearTimeout(retryTimeout); }
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error(`[PlatinumGET] ${path} returned ${res.status}: ${errBody.substring(0, 500)}`);
        return { _error: true, status: res.status, statusText: res.statusText, detail: errBody.substring(0, 500) };
      }

      const text = await res.text();
      try {
        const data = text ? JSON.parse(text) : null;
        if (cacheInfo.cacheable && data && !data._error) setResponseCache(buildCacheKey(url, session, path), data);
        return data;
      } catch { return text; }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.error(`[PlatinumGET] ${path} timed out after ${timeoutMs/1000}s`);
        return { _error: true, status: 408, statusText: 'Request Timeout' };
      }
      throw e;
    } finally { clearTimeout(timeoutId); }
  } finally { releaseSlot(); }
  };

  const promise = doFetch().finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export async function platinumPost(session: UserSession, path: string, body: any, params?: Record<string, string>, options?: { timeout?: number }): Promise<any> {
  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const timeoutMs = options?.timeout || 30000;
  await acquireSlot();
  try {
    const token = await refreshSessionToken(session);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 401) {
        session.token = '';
        session.tokenExpiry = 0;
        const retryToken = await refreshSessionToken(session);
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs);
        try {
          const retryRes = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${retryToken}`, Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: retryController.signal,
          });
          if (!retryRes.ok) return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
          const text = await retryRes.text();
          try { return text ? JSON.parse(text) : null; } catch { return text; }
        } finally { clearTimeout(retryTimeout); }
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
        console.error(`[PlatinumPOST] ${path} timed out after ${timeoutMs / 1000}s`);
        return { _error: true, status: 408, statusText: 'Request Timeout' };
      }
      throw e;
    } finally { clearTimeout(timeoutId); }
  } finally { releaseSlot(); }
}

export async function platinumPut(session: UserSession, path: string, body: any, params?: Record<string, string>): Promise<any> {
  const token = await refreshSessionToken(session);
  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    session.token = '';
    session.tokenExpiry = 0;
    const retryToken = await refreshSessionToken(session);
    const retryRes = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${retryToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!retryRes.ok) return { _error: true, status: retryRes.status, statusText: retryRes.statusText };
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

export async function platinumDelete(session: UserSession, path: string, params?: Record<string, string>): Promise<any> {
  const token = await refreshSessionToken(session);
  let url = `${PLATINUM_API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { _error: true, status: res.status, statusText: res.statusText, detail: errText };
    }

    const text = await res.text();
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  } catch (e: any) {
    if (e.name === 'AbortError') return { _error: true, status: 408, statusText: 'Request Timeout' };
    throw e;
  } finally { clearTimeout(timeoutId); }
}

export function getPlatinumApiUrl(): string {
  return PLATINUM_API_URL;
}

export function getPlatinumDbName(): string {
  return PLATINUM_DBNAME;
}
