const PLATINUM_API_URL = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
const PLATINUM_USERNAME = process.env.PLATINUM_API_USERNAME || "Francois";
const PLATINUM_PASSWORD = process.env.PLATINUM_API_PASSWORD || "";
const PLATINUM_DBNAME = process.env.PLATINUM_API_DBNAME || "George";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function fetchNewToken(): Promise<string> {
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
    throw new Error(`Platinum auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error(`Platinum auth returned no token: ${JSON.stringify(data)}`);
  }

  return data.token;
}

export async function getPlatinumToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) {
    return cachedToken;
  }

  const token = await fetchNewToken();
  cachedToken = token;
  tokenExpiry = now + 7 * 60 * 60 * 1000;
  return token;
}

export async function platinumGet(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getPlatinumToken();
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
    return { _error: true, status: res.status, statusText: res.statusText };
  }

  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

export function getPlatinumApiUrl(): string {
  return PLATINUM_API_URL;
}
