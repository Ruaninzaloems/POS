import type { Request } from "express";
import { createEmptySession, isSessionAuthenticated, type UserSession } from "../platinum-auth";

export function getSession(req: Request): UserSession {
  if (!req.session.platinumAuth) {
    req.session.platinumAuth = createEmptySession();
  }
  return req.session.platinumAuth;
}

export function requireAuth(req: Request, res: any): UserSession | null {
  const session = getSession(req);
  if (!isSessionAuthenticated(session)) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  return session;
}


export const recentPaymentSubmissions = new Map<string, { timestamp: number; response: any }>();
export const PAYMENT_DEDUP_WINDOW_MS = 15000;

export function getPaymentDeduplicationKey(userId: string, body: any): string {
  const rm = body?.requestModel || {};
  const accounts = body?.accounts || [];
  const acct = body?.account || {};
  const accountKey = acct.account_ID ? `single:${acct.account_ID}` :
    accounts.length > 0 ? `multi:${accounts.map((a: any) => a.accountID).sort().join(',')}` : 'unknown';
  return `${userId}|${accountKey}|${rm.totalAmount}|${rm.paymentType}`;
}

export function checkPaymentDedup(key: string): { isDuplicate: boolean; cachedResponse?: any } {
  const now = Date.now();
  for (const [k, v] of recentPaymentSubmissions.entries()) {
    if (now - v.timestamp > PAYMENT_DEDUP_WINDOW_MS) {
      recentPaymentSubmissions.delete(k);
    }
  }
  const cached = recentPaymentSubmissions.get(key);
  if (cached && (now - cached.timestamp) < PAYMENT_DEDUP_WINDOW_MS) {
    return { isDuplicate: true, cachedResponse: cached.response };
  }
  return { isDuplicate: false };
}

export function recordPaymentSubmission(key: string, response: any): void {
  recentPaymentSubmissions.set(key, { timestamp: Date.now(), response });
}

export interface ReceiptAllocation {
  service: string;
  amount: number;
  vat: number;
  total: number;
}

export function parseReceiptAllocations(pdfText: string): ReceiptAllocation[] {
  const allocations: ReceiptAllocation[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const skipLabels = new Set([
    'total', 'tender amount', 'change', 'outstanding balance', 'outstanding',
    'vat amount', 'vat', 'receipt no', 'receipt date', 'account no', 'old account no',
    'account name', 'sg number', 'address', 'payment type', 'payment option',
    'cashier', 'cash office', 'reprint', 'thank you', 'vat registration number',
    'balance', 'amount', 'date', 'outstanding balance', 'outstanding',
  ]);

  const serviceAllocRegex = /^(.+?)\s{2,}(-?[\d, ]+\.\d{2})\s*$/;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const match = line.match(serviceAllocRegex);
    if (match) {
      let label = match[1].trim();
      const amtStr = match[2].replace(/[\s,]/g, '');
      const amount = parseFloat(amtStr);
      if (!label || isNaN(amount)) continue;
      const labelLower = label.toLowerCase();
      if (skipLabels.has(labelLower)) continue;
      if (/^\d/.test(label)) continue;
      if (labelLower.includes('municipality') || labelLower.includes('registration')) continue;

      if (li + 1 < lines.length) {
        const nextLine = lines[li + 1].trim();
        const knownSuffixes = ['basic', 'metered', 'charge', 'disposal', 'rates', 'levy', 'fixed', 'standing', 'contribution', 'payment', 'advance', 'arrear'];
        if (nextLine && !nextLine.match(/\d/) && !skipLabels.has(nextLine.toLowerCase()) && nextLine.length < 30) {
          const nextLineIsService = nextLine.match(serviceAllocRegex);
          const isKnownSuffix = knownSuffixes.some(s => nextLine.toLowerCase() === s || nextLine.toLowerCase().startsWith(s));
          if (!nextLineIsService && isKnownSuffix) {
            label = label + ' ' + nextLine;
            li++;
          }
        }
      }

      allocations.push({
        service: label,
        amount: amount,
        vat: 0,
        total: amount,
      });
    }
  }

  if (allocations.length > 0) {
    return allocations;
  }

  let vatAmount = 0;
  let tenderAmount = 0;
  const usedIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const amountMatch = lines[i].match(/^-?([\d,]+\.\d{2})$/);
    if (amountMatch && i > 0) {
      const val = parseFloat(amountMatch[1].replace(/,/g, ''));
      const prevLine = lines[i - 1].toLowerCase();
      if (prevLine === 'vat amount' || prevLine === 'vat') vatAmount = val;
      else if (prevLine === 'total') { /* skip */ }
      else if (prevLine === 'tender amount') tenderAmount = val;
      else if (prevLine === 'change' || prevLine === 'outstanding balance' || prevLine === 'outstanding') { /* skip */ }
      else if (!skipLabels.has(prevLine) && !/^\d/.test(lines[i - 1]) && !usedIndices.has(i)) {
        allocations.push({
          service: lines[i - 1],
          amount: val,
          vat: 0,
          total: val,
        });
        usedIndices.add(i);
      }
    }
  }

  if (allocations.length === 0 && tenderAmount > 0) {
    allocations.push({
      service: 'Consumer Services',
      amount: tenderAmount - vatAmount,
      vat: vatAmount,
      total: tenderAmount,
    });
  }

  return allocations;
}


export function stripHtml(text: string): string {
  if (!text) return text;
  if (/<[^>]+>/.test(text)) {
    const cleaned = text
      .replace(/<title[^>]*>(.*?)<\/title>/gi, '$1 — ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.substring(0, 300) || 'Server returned an HTML error page';
  }
  return text.substring(0, 500);
}

export function handlePlatinumResult(res: any, data: any) {
  if (data && data._error) {
    return res.status(data.status || 502).json({ message: data.statusText || "Platinum API error", detail: stripHtml(data.detail) || null });
  }
  if (data && data.isSuccess === false) {
    console.warn(`[handlePlatinumResult] API returned isSuccess=false:`, JSON.stringify(data).substring(0, 2000));
  }
  res.json(data);
}

export const DEBT_PERMISSIONS = {
  PROCESS_SECTION129: 'PROCESS_SECTION129',
  AUTHORISE_SECTION129: 'AUTHORISE_SECTION129',
  HANDOVER_PROCESS: 'HANDOVER_PROCESS',
  AUTHORISE_HANDOVER: 'AUTHORISE_HANDOVER',
  SECTION129_REPORT: 'SECTION129_REPORT',
  HANDOVER_REPORT: 'HANDOVER_REPORT',
  SMS_LOG_REPORT: 'SMS_LOG_REPORT',
};

export function requireDebtPermission(session: UserSession, permission: string, res: any): boolean {
  const userPermissions: string[] = session.userData?.permissions || session.userData?.roles || [];
  if (userPermissions.length > 0 && !userPermissions.includes(permission) && !userPermissions.includes('ADMIN') && !userPermissions.includes('admin')) {
    res.status(403).json({ message: `Insufficient permissions: ${permission} required` });
    return false;
  }
  return true;
}

export function injectAuditFields(session: UserSession, body: any, options?: { isReview?: boolean; isTermination?: boolean }): any {
  const now = new Date().toISOString();
  const userId = session.userData?.user_ID || null;
  const augmented = {
    ...body,
    capturerID: userId,
    dateCaptured: now,
    modifierID: userId,
    dateModified: now,
  };
  if (options?.isReview) {
    augmented.reviewerID = userId;
    augmented.reviewDate = now;
  }
  if (options?.isTermination) {
    augmented.statusID = body.statusID ?? null;
    augmented.comment = body.comment ?? '';
  }
  return augmented;
}

export function requireLegalAdmin(session: UserSession, res: any): boolean {
  const userData = session.userData || {};
  const isSuperUser = userData.superUser === true;
  if (isSuperUser) return true;
  const permissions: string[] = userData.permissions || userData.roles || [];
  const hasAdmin = permissions.includes('ADMIN') || permissions.includes('admin') || permissions.includes('LEGAL_ADMIN') || permissions.includes('COMPLIANCE_ADMIN') || permissions.includes('DEBT_ADMIN');
  if (!hasAdmin) {
    res.status(403).json({ message: "Insufficient permissions: Legal/Debt administration access required" });
    return false;
  }
  return true;
}
