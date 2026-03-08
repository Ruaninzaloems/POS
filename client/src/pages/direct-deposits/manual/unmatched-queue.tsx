import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowRight, Filter, FileSpreadsheet, FileText, X, HelpCircle, Loader2, ChevronLeft, ChevronRight, Sparkles, Building2, MapPin, Hash, RefreshCw, ChevronDown, ChevronUp, Calendar, Banknote, RotateCcw, CheckSquare, Zap, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { platinumGetBankReconPosItemList, platinumCheckSelectedItemProcessed, platinumSearchAccountsPayment, platinumDDAccountAutocomplete, platinumDDOldAccountAutocomplete, fetchAccounts, fetchActiveFinYear, fetchBulkAllocationList, fetchBulkProgressJobAccountDetails, submitDDAllocationBatch, pollDDAllocationJob } from '@/lib/external-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePos } from '@/lib/pos-state';
import { useToast } from '@/hooks/use-toast';

interface BankReconPosItem {
  posItem_ID: number;
  dateOfTransaction: string;
  bankReconID: number;
  amount: number;
  reference: string;
  note: string;
  dateCaptured: string;
  capturerID: number;
  dateModified: string | null;
  modifierID: number;
  directDepositTypeID: number | null;
  cashbookTransactionID: number;
  billingAllocated: boolean;
  dateAllocated: string | null;
}

interface SuggestedMatch {
  accountId: number;
  accountNo: string;
  name: string;
  oldAccountCode?: string;
  outstandingAmount?: number;
  matchType: 'account_number' | 'old_account' | 'erf_number' | 'reference' | 'meter_number' | 'history';
  matchDetail: string;
  confidence: number;
  matchReasoning?: string[];
  priorAllocations?: PriorAllocation[];
}

const AREA_ABBREVIATIONS: Record<string, string> = {
  'grg': 'george',
  'oud': 'oudtshoorn',
  'pac': 'pacaltsdorp',
  'her': 'herold',
  'hrl': 'herolds bay',
  'wil': 'wilderness',
  'hoe': 'hoekwil',
  'tou': 'touwsranten',
  'bla': 'blanco',
  'con': 'conville',
  'ros': 'rosemoor',
  'lav': 'lawaaikamp',
  'the': 'thembalethu',
  'bor': 'borchards',
  'uni': 'uniondale',
  'wtr': 'water',
  'mtr': 'meter',
  'pmt': 'payment',
};

interface ParsedClues {
  accountNumbers: string[];
  meterNumbers: string[];
  erfNumbers: { erf: string; area: string }[];
  oldAccountCodes: string[];
  keywords: string[];
  bankingRef: string | null;
  serviceType: string | null;
}

function parseDescriptionForClues(note: string, reference: string): ParsedClues {
  const text = `${note || ''} ${reference || ''}`.toUpperCase();
  const accountNumbers: string[] = [];
  const meterNumbers: string[] = [];
  const erfNumbers: { erf: string; area: string }[] = [];
  const oldAccountCodes: string[] = [];
  const keywords: string[] = [];
  let bankingRef: string | null = null;
  let serviceType: string | null = null;

  const isBankingDesc = /\b(FNB|ABSA|STD|STANDARD|NEDBANK|CAPITEC|FNBO)\b/.test(text) ||
                        /\bOB\s*PMT\b/.test(text) || /\bEFT\b/.test(text) ||
                        /\bINT(?:ERNET)?\s*PMT\b/.test(text);

  if (/\bWTR\b|\bWATER\b/.test(text)) serviceType = 'water';
  else if (/\bELEC\b|\bELECT\b|\bELECTRIC\b/.test(text)) serviceType = 'electricity';
  else if (/\bSEW\b|\bSEWER\b/.test(text)) serviceType = 'sewer';
  else if (/\bREFUSE\b/.test(text)) serviceType = 'refuse';
  else if (/\bRAT\b|\bRATES\b/.test(text)) serviceType = 'rates';

  const isDateLike = (num: string): boolean => {
    if (num.length === 6) {
      const y = parseInt(num.substring(0, 4));
      const m = parseInt(num.substring(4, 6));
      if (y >= 2000 && y <= 2030 && m >= 1 && m <= 12) return true;
      const y2 = parseInt(num.substring(0, 2));
      const m2 = parseInt(num.substring(2, 4));
      const d2 = parseInt(num.substring(4, 6));
      if (y2 >= 20 && y2 <= 30 && m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) return true;
    }
    if (num.length === 8) {
      const y = parseInt(num.substring(0, 4));
      const m = parseInt(num.substring(4, 6));
      const d = parseInt(num.substring(6, 8));
      if (y >= 2000 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return true;
    }
    return false;
  };

  if (isBankingDesc) {
    const mtrMatch = text.match(/MTR\s*(\d{3,})/);
    if (mtrMatch) {
      accountNumbers.push(mtrMatch[1]);
    }

    const trailingNum = text.match(/\b(\d{3,15})\s*$/);
    if (trailingNum) {
      const num = trailingNum[1];
      if (!accountNumbers.includes(num) && !isDateLike(num)) {
        accountNumbers.push(num);
      }
    }

    const slashParts = text.split('/');
    for (const part of slashParts) {
      const trimmed = part.trim();
      if (/^[A-Z]+$/i.test(trimmed)) continue;
      const numMatch = trimmed.match(/(\d{4,15})/);
      if (numMatch) {
        const num = numMatch[1];
        if (!accountNumbers.includes(num) && !isDateLike(num) && num.length >= 4) {
          accountNumbers.push(num);
        }
      }
    }

    const refPart = slashParts.length > 1 ? slashParts.slice(1).join('/') : '';
    if (refPart.trim()) bankingRef = refPart.trim();
  }

  const accPatterns = [
    /USER\s+(\d{4,})/gi,
    /ACC(?:OUNT)?\s*(?:NO\.?|#)?\s*(\d{4,})/gi,
    /(\d{8,})/g,
  ];

  const seenNums = new Set<string>([...accountNumbers, ...meterNumbers]);
  for (const pattern of accPatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const num = match[1];
      if (num && num.length >= 4 && num.length <= 15 && !seenNums.has(num)) {
        const numVal = parseInt(num, 10);
        if (numVal > 100 && numVal < 999999999999) {
          seenNums.add(num);
          accountNumbers.push(num);
        }
      }
    }
  }

  if (!isBankingDesc) {
    const meterPatterns = [
      /M(?:E?T(?:E?R)?)\s*(?:NO\.?|#|:)\s*(\d{3,})/gi,
      /METER\s+(?:NUMBER|NO\.?|#)?\s*:?\s*(\d{3,})/gi,
    ];
    for (const pattern of meterPatterns) {
      let match;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(text)) !== null) {
        const num = match[1];
        if (num && !seenNums.has(num)) {
          seenNums.add(num);
          meterNumbers.push(num);
        }
      }
    }
  }

  const erfPatterns = [
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+(?:\/\d+)?)\s*(?:AREA:?\s*)?(\w+)?/gi,
    /ERF\s*(\d+(?:\/\d+)?)\s+(\w+)/gi,
    /ERF(\d+)/gi,
  ];
  for (const pattern of erfPatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const erfNum = match[1];
      let area = (match[2] || '').toLowerCase().trim();
      if (area && AREA_ABBREVIATIONS[area]) {
        area = AREA_ABBREVIATIONS[area];
      }
      if (erfNum) {
        erfNumbers.push({ erf: erfNum, area: area || 'george' });
      }
    }
  }

  const oldCodePatterns = [
    /SEQ\/?(\w+)/gi,
    /\/(\d{6,})\b/g,
  ];
  for (const pattern of oldCodePatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const code = match[1];
      if (code && code.length >= 3) {
        oldAccountCodes.push(code);
      }
    }
  }

  const areaAbbrsInText = ['GRG', 'OUD', 'PAC', 'BLA', 'CON', 'THE', 'WIL', 'HOE', 'TOU', 'ROS', 'LAV', 'BOR', 'UNI', 'HER', 'HRL'];
  for (const abbr of areaAbbrsInText) {
    if (text.includes(abbr) && AREA_ABBREVIATIONS[abbr.toLowerCase()]) {
      const full = AREA_ABBREVIATIONS[abbr.toLowerCase()];
      if (full !== 'water' && full !== 'meter' && full !== 'payment' && !keywords.includes(full)) {
        keywords.push(full);
      }
    }
  }

  const areaNames = text.match(/\b(GEORGE|WILDERNESS|PACALTSDORP|BLANCO|CONVILLE|THEMBALETHU|OUDTSHOORN|UNIONDALE|HEROLDS?\s*BAY)\b/gi);
  if (areaNames) {
    for (const area of areaNames) {
      const a = area.toLowerCase();
      if (!keywords.includes(a)) keywords.push(a);
    }
  }

  return { accountNumbers, meterNumbers, erfNumbers, oldAccountCodes, keywords, bankingRef, serviceType };
}

interface PriorAllocation {
  jobId: number;
  paymentReference: string;
  dateCaptured: string;
  allocatedAmount: number;
  posItemId: number;
}

interface HistoryEntry {
  descFingerprint: string;
  accountId: number;
  accountNo: string;
  name: string;
  allocCount: number;
  priorAllocations: PriorAllocation[];
}
let historyCachePromise: Promise<HistoryEntry[]> | null = null;

function getDescFingerprint(desc: string): string {
  return desc.toUpperCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

function loadHistoryCache(): Promise<HistoryEntry[]> {
  if (historyCachePromise) return historyCachePromise;
  historyCachePromise = (async () => {
    try {
      const result = await fetchBulkAllocationList({
        financialYear: '',
        billingMonth: null,
        process: 'All',
        orderby: 'dateCaptured',
        page: 1,
        pageSize: 50,
        shortDirection: 'desc',
      });
      const jobs = Array.isArray(result) ? result : result?.value || result?.items || [];
      const completedJobs = jobs.filter((j: any) => j.job_Status === 'Completed').slice(0, 30);

      const entries: HistoryEntry[] = [];
      const seenFingerprints = new Map<string, HistoryEntry>();

      const DETAIL_BATCH = 5;
      for (let i = 0; i < Math.min(completedJobs.length, 15); i += DETAIL_BATCH) {
        const batch = completedJobs.slice(i, i + DETAIL_BATCH);
        const results = await Promise.allSettled(
          batch.map((job: any) => fetchBulkProgressJobAccountDetails(job.directDepositJob_ID).then(details => ({ job, details })))
        );
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          const { job, details } = r.value;
          const accounts = Array.isArray(details) ? details : details?.value || [];
          for (const acc of accounts) {
            const accId = acc.account_ID || acc.accountID;
            const accNo = acc.accountNumber || acc.accountNo || String(accId);
            const name = [acc.initials, acc.lastName].filter(Boolean).join(' ') || acc.name || '';
            const desc = job.paymentReference || '';
            if (!desc || !accId) continue;
            const fp = getDescFingerprint(desc);
            const prior: PriorAllocation = {
              jobId: job.directDepositJob_ID,
              paymentReference: job.paymentReference || '',
              dateCaptured: job.dateCaptured || '',
              allocatedAmount: acc.paidAmount || acc.amount || job.allocatedAmount || 0,
              posItemId: job.posItemID || 0,
            };
            const existing = seenFingerprints.get(`${fp}:${accId}`);
            if (existing) {
              existing.allocCount++;
              existing.priorAllocations.push(prior);
            } else {
              const entry: HistoryEntry = { descFingerprint: fp, accountId: accId, accountNo: accNo, name, allocCount: 1, priorAllocations: [prior] };
              seenFingerprints.set(`${fp}:${accId}`, entry);
              entries.push(entry);
            }
          }
        }
      }

      console.log(`[HistoryCache] Loaded ${entries.length} history patterns from ${completedJobs.length} jobs`);
      return entries;
    } catch (err) {
      console.error('[HistoryCache] Failed to load allocation history:', err);
      return [];
    }
  })();
  return historyCachePromise;
}

async function searchForSuggestions(note: string, reference: string): Promise<SuggestedMatch[]> {
  const clues = parseDescriptionForClues(note, reference);
  const suggestions: SuggestedMatch[] = [];
  const seenIds = new Set<number>();

  const addResult = (item: any, matchType: SuggestedMatch['matchType'], matchDetail: string, confidence: number, reasoning: string[]) => {
    const accId = item.account_ID || item.accountID || item.id;
    if (!accId || seenIds.has(accId)) return;
    seenIds.add(accId);
    suggestions.push({
      accountId: accId,
      accountNo: item.accountNumber || item.accountNo || String(accId),
      name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown',
      oldAccountCode: item.oldAccountCode,
      outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
      matchType,
      matchDetail,
      confidence: Math.min(confidence, 99),
      matchReasoning: reasoning,
    });
  };

  const safe = (fn: () => Promise<any>) => fn().catch((err) => { console.error('[AutoMatch]', err); return []; });
  const unwrap = (rawData: any) => Array.isArray(rawData) ? rawData : rawData?.value || rawData?.results || [];

  const searchPromises: Promise<void>[] = [];

  const descFp = getDescFingerprint(`${note || ''} ${reference || ''}`);
  searchPromises.push(
    loadHistoryCache().then((history) => {
      const matches = history.filter(h => h.descFingerprint === descFp || descFp.includes(h.descFingerprint) || h.descFingerprint.includes(descFp));
      matches.sort((a, b) => b.allocCount - a.allocCount);
      for (const match of matches.slice(0, 3)) {
        const accId = match.accountId;
        if (!seenIds.has(accId)) {
          seenIds.add(accId);
          const conf = Math.min(95, 75 + (match.allocCount * 5));
          const sortedPrior = [...match.priorAllocations].sort((a, b) =>
            new Date(b.dateCaptured).getTime() - new Date(a.dateCaptured).getTime()
          );
          const latestPrior = sortedPrior[0];
          const totalPriorAmount = sortedPrior.reduce((s, p) => s + p.allocatedAmount, 0);
          const reasoning = [
            `Description pattern matches ${match.allocCount} previous allocation(s)`,
          ];
          if (latestPrior) {
            const dateStr = latestPrior.dateCaptured ? new Date(latestPrior.dateCaptured).toLocaleDateString('en-GB') : 'unknown date';
            reasoning.push(`Last allocated on ${dateStr} for R ${latestPrior.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
            if (latestPrior.paymentReference) {
              reasoning.push(`Payment reference: "${latestPrior.paymentReference}"`);
            }
          }
          if (match.allocCount > 1) {
            reasoning.push(`Total in recent history: R ${totalPriorAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} across ${match.allocCount} allocation(s)`);
          }
          reasoning.push(`Based on recent completed jobs — verify account details before allocating`);
          suggestions.push({
            accountId: accId,
            accountNo: match.accountNo,
            name: match.name,
            matchType: 'history',
            matchDetail: `Previously allocated ${match.allocCount}x to this account`,
            confidence: conf,
            matchReasoning: reasoning,
            priorAllocations: sortedPrior,
          });
        }
      }
    })
  );

  for (const mtr of clues.meterNumbers.slice(0, 3)) {
    searchPromises.push(
      safe(() => platinumDDAccountAutocomplete(mtr)).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 3)) {
          const meterStr = String(item.meterNumber || item.physicalMeterNumber || '');
          const exactMeterMatch = meterStr.includes(mtr);
          addResult(item, 'meter_number',
            `Meter ${exactMeterMatch ? 'match' : 'ref'}: "${mtr}"${clues.serviceType ? ` (${clues.serviceType})` : ''}`,
            exactMeterMatch ? 92 : 75,
            [
              `Extracted "${mtr}" as meter number from description`,
              exactMeterMatch ? `Exact meter number match found in Platinum` : `Partial meter reference found`,
              clues.serviceType ? `Service type detected: ${clues.serviceType}` : `No specific service type detected`,
              `Searched via DD account autocomplete API`,
            ]
          );
        }
      })
    );
    searchPromises.push(
      safe(() => fetchAccounts({ physicalMeterNumber: mtr })).then((items: any[]) => {
        for (const item of items.slice(0, 3)) {
          addResult(item, 'meter_number',
            `Meter number match: "${mtr}"${clues.serviceType ? ` (${clues.serviceType})` : ''}`,
            90,
            [
              `Extracted "${mtr}" as meter number from description`,
              `Exact physical meter number match in billing system`,
              clues.serviceType ? `Service type: ${clues.serviceType}` : '',
              `Searched via billing enquiry meter search`,
            ].filter(Boolean)
          );
        }
      })
    );
  }

  for (const accNum of clues.accountNumbers.slice(0, 3)) {
    searchPromises.push(
      safe(() => platinumDDAccountAutocomplete(accNum)).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 3)) {
          const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
          const exactMatch = accountNo === accNum || accountNo.endsWith(accNum) || accNum.endsWith(accountNo);
          addResult(item, 'account_number',
            `Account ${exactMatch ? 'match' : 'ref'}: "${accNum}"`,
            exactMatch ? 90 : (accountNo.includes(accNum) ? 80 : 65),
            [
              `Found "${accNum}" in description text`,
              exactMatch ? `Exact account number match` : `Partial account number match (${accountNo})`,
              `Searched via DD autocomplete API`,
            ]
          );
        }
      })
    );
    searchPromises.push(
      safe(() => platinumSearchAccountsPayment({ accountNo: accNum })).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 3)) {
          const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
          const nameMatch = accountNo.includes(accNum) || String(item.account_ID).includes(accNum);
          addResult(item, 'account_number',
            `Account number contains "${accNum}"`,
            nameMatch ? 88 : 60,
            [
              `Extracted "${accNum}" from description`,
              nameMatch ? `Account number ${accountNo} contains "${accNum}"` : `Loose match against "${accNum}"`,
              `Searched via billing payment search`,
            ]
          );
        }
      })
    );
  }

  for (const oldCode of clues.oldAccountCodes.slice(0, 3)) {
    searchPromises.push(
      safe(() => platinumDDOldAccountAutocomplete(oldCode)).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 3)) {
          addResult(item, 'old_account',
            `Old account code: "${oldCode}"`,
            78,
            [
              `Found "${oldCode}" matching old account code pattern in description`,
              `Matched via DD old account autocomplete`,
              `Old account codes are legacy references that map to current accounts`,
            ]
          );
        }
      })
    );
  }

  for (const accNum of clues.accountNumbers.slice(0, 2)) {
    searchPromises.push(
      safe(() => platinumDDOldAccountAutocomplete(accNum)).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 2)) {
          addResult(item, 'old_account',
            `Old account code matches "${accNum}"`,
            75,
            [
              `Number "${accNum}" found in description`,
              `Matches an old/legacy account code in the system`,
              `This maps to a current active account`,
            ]
          );
        }
      })
    );
    searchPromises.push(
      safe(() => platinumSearchAccountsPayment({ oldAccountCode: accNum })).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 2)) {
          addResult(item, 'old_account', `Old account code matches "${accNum}"`, 75,
            [
              `Number "${accNum}" from description matches old account code`,
              `Searched via payment account search`,
            ]
          );
        }
      })
    );
  }

  for (const erf of clues.erfNumbers.slice(0, 2)) {
    searchPromises.push(
      safe(() => fetchAccounts({
        erfNumber: erf.erf,
        ...(erf.area && erf.area !== 'george' ? { allotmentArea: erf.area } : {}),
      })).then((items: any[]) => {
        for (const item of items.slice(0, 3)) {
          const hasAreaMatch = erf.area && (
            (item.allotmentArea || '').toLowerCase().includes(erf.area) ||
            (item.name || '').toLowerCase().includes(erf.area) ||
            (item.address || item.locationAddress || '').toLowerCase().includes(erf.area)
          );
          addResult(item, 'erf_number',
            `ERF ${erf.erf}${erf.area ? ` in ${erf.area}` : ''}${hasAreaMatch ? ' (area confirmed)' : ''}`,
            hasAreaMatch ? 88 : 75,
            [
              `Found ERF number "${erf.erf}" in description`,
              erf.area ? `Area "${erf.area}" specified in description` : `No specific area mentioned`,
              hasAreaMatch ? `Area confirmed — allotment matches` : `Area not verified — check manually`,
              `Searched via billing enquiry with ERF number${erf.area ? ' + allotment area' : ''}`,
            ]
          );
        }
      })
    );

    const erfSearches = [`erf ${erf.erf}`];
    if (erf.area) erfSearches.push(`erf ${erf.erf} ${erf.area}`);

    for (const erfSearch of erfSearches) {
      searchPromises.push(
        safe(() => platinumSearchAccountsPayment({ name: erfSearch })).then((rawData: any) => {
          const items = unwrap(rawData);
          for (const item of items.slice(0, 3)) {
            const hasAreaMatch = erf.area && (
              (item.name || '').toLowerCase().includes(erf.area) ||
              (item.address || '').toLowerCase().includes(erf.area)
            );
            addResult(item, 'erf_number',
              `Property: ERF ${erf.erf}${erf.area ? ` ${erf.area}` : ''}${hasAreaMatch ? ' (area confirmed)' : ''}`,
              hasAreaMatch ? 82 : 70,
              [
                `ERF "${erf.erf}" extracted from description`,
                `Searched via payment search: "${erfSearch}"`,
                hasAreaMatch ? `Area/name match confirmed` : `Area not confirmed in results`,
              ]
            );
          }
        })
      );
    }
  }

  if (clues.keywords.length > 0 && clues.erfNumbers.length === 0 && clues.accountNumbers.length === 0 && clues.meterNumbers.length === 0) {
    for (const keyword of clues.keywords.slice(0, 2)) {
      searchPromises.push(
        safe(() => platinumSearchAccountsPayment({ name: keyword })).then((rawData: any) => {
          const items = unwrap(rawData);
          for (const item of items.slice(0, 2)) {
            addResult(item, 'reference', `Area/keyword match: "${keyword}"`, 40,
              [
                `No specific account/meter/ERF numbers found in description`,
                `Matched on area keyword: "${keyword}"`,
                `Low confidence — manual verification recommended`,
              ]
            );
          }
        })
      );
    }
  }

  await Promise.all(searchPromises);

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 5);
}

export default function UnmatchedQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLocation] = useLocation();
  const { currentUser } = usePos();
  const { toast } = useToast();
  const [items, setItems] = useState<BankReconPosItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingItemId, setCheckingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [showHelp, setShowHelp] = useState(false);

  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();

  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, SuggestedMatch[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<number>>(new Set());

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [autoMatchRunning, setAutoMatchRunning] = useState(false);
  const [autoMatchProgress, setAutoMatchProgress] = useState({ done: 0, total: 0 });
  const autoMatchAbort = useRef(false);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchTerm, txnDateFrom, txnDateTo]);

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await platinumGetBankReconPosItemList({
        page: pageNum,
        pageSize,
        orderby: 'dateOfTransaction',
        shortDirection: 'desc',
      });
      const data = result as any;
      const fetchedItems: BankReconPosItem[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(fetchedItems);
      setTotalCount(data?.totalCount ?? fetchedItems.length);
    } catch (e: any) {
      console.error("Failed to load bank recon POS items", e);
      setError(e.message || "Failed to load data from Platinum API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  const filtered = items.filter(item => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (item.note || '').toLowerCase().includes(term) ||
        (item.reference || '').toLowerCase().includes(term) ||
        item.amount.toString().includes(searchTerm) ||
        item.posItem_ID.toString().includes(searchTerm);
      if (!matchesSearch) return false;
    }
    if (txnDateFrom && txnDateTo) {
      const date = new Date(item.dateOfTransaction);
      if (isValid(date)) {
        if (!isWithinInterval(date, {
          start: startOfDay(txnDateFrom),
          end: endOfDay(txnDateTo)
        })) return false;
      }
    }
    return true;
  });

  const unmatchedFiltered = useMemo(() => filtered.filter(i => !i.billingAllocated), [filtered]);
  const allUnmatchedSelected = unmatchedFiltered.length > 0 && unmatchedFiltered.every(i => selectedIds.has(i.posItem_ID));

  const toggleSelectAll = () => {
    if (allUnmatchedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unmatchedFiltered.map(i => i.posItem_ID)));
    }
  };

  const toggleSelect = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedItems = useMemo(() => filtered.filter(i => selectedIds.has(i.posItem_ID)), [filtered, selectedIds]);
  const selectedTotal = selectedItems.reduce((s, i) => s + (i.amount || 0), 0);
  const selectedWithMatch = selectedItems.filter(i => {
    const s = suggestions[i.posItem_ID];
    return s && s.length > 0 && s[0].confidence >= 70;
  });

  const [autoMatchStats, setAutoMatchStats] = useState({ matched: 0, noMatch: 0 });

  const runAutoMatchBatch = async (targets: BankReconPosItem[], showToast: boolean) => {
    if (targets.length === 0) {
      if (showToast) toast({ title: 'Already Analyzed', description: `All items on this page have already been analyzed.` });
      return;
    }
    setAutoMatchRunning(true);
    autoMatchAbort.current = false;
    setAutoMatchProgress({ done: 0, total: targets.length });
    const stats = { matched: 0, noMatch: 0 };

    const BATCH_SIZE = 3;
    let doneCount = 0;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      if (autoMatchAbort.current) break;
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        try {
          const results = await searchForSuggestions(item.note, item.reference);
          setSuggestions(prev => ({ ...prev, [item.posItem_ID]: results }));
          if (results.length > 0 && results[0].confidence >= 60) stats.matched++;
          else stats.noMatch++;
        } catch (err) {
          console.error(`[AutoMatch] Failed for POS item ${item.posItem_ID}:`, err);
          setSuggestions(prev => ({ ...prev, [item.posItem_ID]: [] }));
          stats.noMatch++;
        }
        doneCount++;
        setAutoMatchProgress({ done: doneCount, total: targets.length });
      }));
    }

    setAutoMatchStats(stats);
    setAutoMatchRunning(false);
    if (!autoMatchAbort.current && showToast) {
      const highConf = stats.matched;
      toast({
        title: 'Auto-Match Complete',
        description: `Analyzed ${targets.length} items: ${highConf} matched, ${stats.noMatch} no match found.`,
      });
    }
  };

  const runAutoMatchAll = () => {
    const targets = unmatchedFiltered.filter(i => !suggestions[i.posItem_ID]);
    return runAutoMatchBatch(targets, true);
  };

  const runAutoMatchSelected = () => {
    const targets = selectedItems.filter(i => !i.billingAllocated);
    return runAutoMatchBatch(targets, false);
  };

  const getBestMatch = (posItemId: number): SuggestedMatch | null => {
    const s = suggestions[posItemId];
    if (!s || s.length === 0) return null;
    return s[0];
  };

  const getMatchIndicator = (posItemId: number): 'high' | 'medium' | 'low' | 'none' | 'loading' => {
    if (loadingSuggestions.has(posItemId)) return 'loading';
    const best = getBestMatch(posItemId);
    if (!best) return 'none';
    if (best.confidence >= 80) return 'high';
    if (best.confidence >= 60) return 'medium';
    return 'low';
  };

  const activeFiltersCount = [txnDateFrom].filter(Boolean).length;

  const clearFilters = () => {
    setTxnDateFrom(undefined);
    setTxnDateTo(undefined);
    setSearchTerm('');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleAllocateClick = async (posItemId: number, e?: React.MouseEvent, preselectedAccount?: SuggestedMatch) => {
    if (e) e.stopPropagation();
    setCheckingItemId(posItemId);
    try {
      let finYear: string;
      try {
        finYear = await fetchActiveFinYear();
      } catch (e: any) {
        toast({ title: 'Financial Year Error', description: `Could not fetch active financial year from API: ${e?.message || 'Unknown error'}.`, variant: 'destructive' });
        setCheckingItemId(null);
        return;
      }

      const checkUserId = currentUser?.id ? Number(currentUser.id) : -1;
      const result = await platinumCheckSelectedItemProcessed(
        checkUserId,
        finYear,
        posItemId
      );

      const msg = (result?.message || '').toLowerCase();
      const isCashierError = msg.includes('active cashier') || msg.includes('cashier count');
      if (result && result.success === false && !isCashierError) {
        toast({
          title: 'Item Already Processed',
          description: result.message || 'This POS item has already been processed and cannot be allocated.',
          variant: 'destructive',
        });
        return;
      }
      let url = `/direct-deposits/manual/allocate/${posItemId}`;
      if (preselectedAccount) {
        const params = new URLSearchParams();
        params.set('accountId', String(preselectedAccount.accountId));
        params.set('accountNo', preselectedAccount.accountNo);
        params.set('name', preselectedAccount.name);
        const txItem = items.find(i => i.posItem_ID === posItemId);
        if (txItem?.amount) params.set('amount', String(txItem.amount));
        url += `?${params.toString()}`;
      }
      setLocation(url);
    } catch (e: any) {
      console.error("Failed to check item processed status", e);
      let url = `/direct-deposits/manual/allocate/${posItemId}`;
      if (preselectedAccount) {
        const params = new URLSearchParams();
        params.set('accountId', String(preselectedAccount.accountId));
        params.set('accountNo', preselectedAccount.accountNo);
        params.set('name', preselectedAccount.name);
        const txItem = items.find(i => i.posItem_ID === posItemId);
        if (txItem?.amount) params.set('amount', String(txItem.amount));
        url += `?${params.toString()}`;
      }
      setLocation(url);
    } finally {
      setCheckingItemId(null);
    }
  };

  interface BulkAllocItem {
    posItemId: number;
    reconId: number;
    note: string;
    reference: string;
    amount: number;
    dateOfTransaction: string;
    match: SuggestedMatch;
    alternativeMatches: SuggestedMatch[];
    status: 'pending' | 'submitting' | 'polling' | 'success' | 'failed';
    error?: string;
    jobId?: string;
    amended?: boolean;
  }

  const [bulkAllocOpen, setBulkAllocOpen] = useState(false);
  const [bulkAllocItems, setBulkAllocItems] = useState<BulkAllocItem[]>([]);
  const [bulkAllocRunning, setBulkAllocRunning] = useState(false);
  const [bulkAllocDone, setBulkAllocDone] = useState(0);
  const bulkAllocAbort = useRef(false);
  const [bulkExpandedItem, setBulkExpandedItem] = useState<number | null>(null);
  const [bulkSearching, setBulkSearching] = useState<number | null>(null);
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');
  const [bulkSearchResults, setBulkSearchResults] = useState<SuggestedMatch[]>([]);

  const openBulkAllocate = () => {
    const itemsToAllocate: BulkAllocItem[] = selectedWithMatch.map(tx => {
      const match = getBestMatch(tx.posItem_ID)!;
      const allSuggestions = suggestions[tx.posItem_ID] || [];
      return {
        posItemId: tx.posItem_ID,
        reconId: tx.bankReconID,
        note: tx.note,
        reference: tx.reference,
        amount: tx.amount,
        dateOfTransaction: tx.dateOfTransaction,
        match,
        alternativeMatches: allSuggestions.filter(s => s.accountId !== match.accountId),
        status: 'pending' as const,
      };
    });
    setBulkAllocItems(itemsToAllocate);
    setBulkAllocDone(0);
    setBulkAllocRunning(false);
    bulkAllocAbort.current = false;
    setBulkExpandedItem(null);
    setBulkSearching(null);
    setBulkSearchTerm('');
    setBulkSearchResults([]);
    setBulkAllocOpen(true);
  };

  const removeBulkItem = (posItemId: number) => {
    setBulkAllocItems(prev => prev.filter(i => i.posItemId !== posItemId));
    if (bulkExpandedItem === posItemId) setBulkExpandedItem(null);
  };

  const changeBulkItemMatch = (posItemId: number, newMatch: SuggestedMatch) => {
    setBulkAllocItems(prev => prev.map(p => {
      if (p.posItemId !== posItemId) return p;
      return { ...p, match: newMatch, amended: true, alternativeMatches: [p.match, ...p.alternativeMatches.filter(a => a.accountId !== newMatch.accountId)] };
    }));
    setBulkSearching(null);
    setBulkSearchTerm('');
    setBulkSearchResults([]);
  };

  const startBulkAccountSearch = async (posItemId: number) => {
    setBulkSearching(posItemId);
    setBulkSearchTerm('');
    setBulkSearchResults([]);
    setBulkExpandedItem(posItemId);
  };

  const bulkSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulkSearchRequestId = useRef(0);

  const doBulkAccountSearch = useCallback((term: string) => {
    setBulkSearchTerm(term);
    if (bulkSearchDebounce.current) clearTimeout(bulkSearchDebounce.current);
    if (term.length < 3) { setBulkSearchResults([]); return; }
    bulkSearchDebounce.current = setTimeout(async () => {
      const reqId = ++bulkSearchRequestId.current;
      try {
        const results = await platinumDDAccountAutocomplete(term);
        if (bulkSearchRequestId.current !== reqId) return;
        const items = Array.isArray(results) ? results : (results as any)?.value || [];
        setBulkSearchResults(items.slice(0, 8).map((item: any) => ({
          accountId: item.account_ID || item.accountID || item.id,
          accountNo: item.accountNumber || item.accountNo || String(item.account_ID),
          name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || '',
          matchType: 'reference' as const,
          matchDetail: 'Manual search',
          confidence: 100,
          outstandingAmount: item.outstandingAmount || item.balance,
        })));
      } catch {
        if (bulkSearchRequestId.current === reqId) setBulkSearchResults([]);
      }
    }, 350);
  }, []);

  const executeBulkAllocate = async () => {
    if (bulkAllocItems.length === 0) return;
    setBulkAllocRunning(true);
    setBulkAllocDone(0);
    bulkAllocAbort.current = false;
    setBulkExpandedItem(null);
    setBulkSearching(null);

    let finYear: string;
    try {
      finYear = await fetchActiveFinYear();
    } catch (e: any) {
      toast({ title: 'Financial Year Error', description: `Could not fetch financial year: ${e?.message}`, variant: 'destructive' });
      setBulkAllocRunning(false);
      return;
    }

    const now = new Date();
    const saFormatter = new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const saParts = saFormatter.formatToParts(now);
    const getPart = (type: string) => saParts.find(p => p.type === type)?.value || '';
    const receiptDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

    let doneCount = 0;
    for (let i = 0; i < bulkAllocItems.length; i++) {
      if (bulkAllocAbort.current) break;
      const item = bulkAllocItems[i];

      const pid = item.posItemId;
      setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'submitting' } : p));

      try {
        const batchPayload = {
          posItemId: item.posItemId,
          reconId: item.reconId,
          financialYear: finYear,
          transactionDate: item.dateOfTransaction || receiptDate,
          transactionNote: item.note || item.reference || '',
          lines: [{
            accountNo: item.match.accountNo,
            accountId: item.match.accountId,
            amount: item.amount,
            allocationType: 'ACCOUNT',
            description: item.note || item.reference || '',
          }],
        };

        const result = await submitDDAllocationBatch(batchPayload);

        setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'polling', jobId: result.jobId } : p));

        let pollAttempts = 0;
        const maxPolls = 30;
        let jobComplete = false;
        while (pollAttempts < maxPolls && !jobComplete) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            const jobStatus = await pollDDAllocationJob(result.jobId);
            if (jobStatus.status === 'COMPLETED') {
              setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'success' } : p));
              jobComplete = true;
            } else if (jobStatus.status === 'FAILED' || jobStatus.status === 'PARTIAL_FAILURE') {
              const errMsg = jobStatus.errors?.join(', ') || 'Allocation failed';
              setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'failed', error: errMsg } : p));
              jobComplete = true;
            }
          } catch (pollErr: any) {
            console.warn(`[BulkAllocate] Poll error for job ${result.jobId}:`, pollErr?.message);
          }
          pollAttempts++;
        }
        if (!jobComplete) {
          setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'failed', error: 'Timeout waiting for allocation to complete' } : p));
        }
      } catch (e: any) {
        setBulkAllocItems(prev => prev.map(p => p.posItemId === pid ? { ...p, status: 'failed', error: e?.message || 'Submission failed' } : p));
      }
      doneCount++;
      setBulkAllocDone(doneCount);
    }

    setBulkAllocRunning(false);
    loadData(page);
  };

  const bulkAllocSuccessCount = bulkAllocItems.filter(i => i.status === 'success').length;
  const bulkAllocFailCount = bulkAllocItems.filter(i => i.status === 'failed').length;
  const bulkAllocPendingCount = bulkAllocItems.filter(i => i.status === 'pending').length;
  const bulkAllocTotalAmount = bulkAllocItems.reduce((s, i) => s + i.amount, 0);
  const bulkHighConfCount = bulkAllocItems.filter(i => i.match.confidence >= 80).length;
  const bulkMedConfCount = bulkAllocItems.filter(i => i.match.confidence >= 60 && i.match.confidence < 80).length;
  const bulkLowConfCount = bulkAllocItems.filter(i => i.match.confidence < 60).length;
  const bulkAmendedCount = bulkAllocItems.filter(i => i.amended).length;

  const toggleSuggestion = async (posItemId: number, note: string, reference: string) => {
    if (expandedSuggestion === posItemId) {
      setExpandedSuggestion(null);
      return;
    }
    setExpandedSuggestion(posItemId);
    if (suggestions[posItemId]) return;

    setLoadingSuggestions(prev => new Set(prev).add(posItemId));
    try {
      const results = await searchForSuggestions(note, reference);
      setSuggestions(prev => ({ ...prev, [posItemId]: results }));
    } catch (err) {
      console.error("Failed to get suggestions:", err);
      setSuggestions(prev => ({ ...prev, [posItemId]: [] }));
    } finally {
      setLoadingSuggestions(prev => {
        const next = new Set(prev);
        next.delete(posItemId);
        return next;
      });
    }
  };

  const handleDownload = (fmt: 'excel' | 'pdf') => {
    const element = document.createElement("a");
    const fileContent = "Date,Description,Reference,Amount,Allocated,POS Item ID\n" +
      filtered.map(t => `${t.dateOfTransaction},"${t.note}",${t.reference},${t.amount},${t.billingAllocated},${t.posItem_ID}`).join("\n");
    const fileBlob = new Blob([fileContent], { type: fmt === 'excel' ? "text/csv" : "text/plain" });
    element.href = URL.createObjectURL(fileBlob);
    element.download = `bank_recon_positems.${fmt === 'excel' ? 'csv' : 'txt'}`;
    element.style.display = 'none';
    (document.body || document.documentElement).appendChild(element);
    element.click();
    element.remove();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (confidence >= 60) return 'bg-[var(--pos-accent-tint)] text-[#6B6B6B] border-[#D6D6D6]';
    return 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]';
  };

  const getMatchIcon = (matchType: SuggestedMatch['matchType']) => {
    switch (matchType) {
      case 'meter_number': return <Zap className="w-3 h-3" />;
      case 'account_number': return <Hash className="w-3 h-3" />;
      case 'old_account': return <RotateCcw className="w-3 h-3" />;
      case 'erf_number': return <MapPin className="w-3 h-3" />;
      case 'history': return <Calendar className="w-3 h-3" />;
      case 'reference': return <Building2 className="w-3 h-3" />;
    }
  };

  const getMatchTypeLabel = (matchType: SuggestedMatch['matchType']) => {
    switch (matchType) {
      case 'meter_number': return 'Meter';
      case 'account_number': return 'Account';
      case 'old_account': return 'Old Acc';
      case 'erf_number': return 'ERF';
      case 'history': return 'History';
      case 'reference': return 'Ref';
    }
  };

  const pageUnmatchedCount = filtered.filter(i => !i.billingAllocated).length;
  const pageAllocatedCount = filtered.filter(i => i.billingAllocated).length;
  const pageTotalAmount = filtered.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <>
    <PosLayout>
      <div className="flex flex-col flex-1 min-h-0 overflow-auto sm:overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E]" data-testid="text-page-title">Direct Deposits: Manual Allocation <HelpTip text="Unallocated EFT and direct deposits awaiting manual allocation to consumer accounts." side="right" /></h1>
                <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Bank Recon POS Items <span className="font-mono font-medium">({totalCount.toLocaleString()} total)</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 gap-1.5 h-11 sm:h-9" onClick={() => setShowHelp(!showHelp)}>
                    <HelpCircle className="w-3.5 h-3.5" /> Help
                </Button>
                <Link href="/direct-deposits/manual/history">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-11 sm:h-9" data-testid="button-allocation-history">
                        <HistoryIcon className="w-3.5 h-3.5" /> History
                    </Button>
                </Link>
            </div>
          </div>

          {showHelp && (
            <div className="mb-4 p-4 bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-slate-600">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Review Items</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Review bank deposits from Platinum. Click the suggestion icon to see smart account matches.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Search & Filter</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Search by amount, reference, or description. Use date filters to narrow results.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pos-accent)] text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>
                    <h4 className="font-medium text-slate-800 text-sm">Allocate Funds</h4>
                    <p className="text-xs mt-0.5 text-slate-500">Click <strong>Allocate</strong> to assign funds to the correct municipal account(s).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
             <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search description, ref, amount..."
                  className="pl-10 h-10 bg-[#F7F7F7] border-[#D6D6D6] rounded-lg focus:bg-white transition-colors text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
                <HelpTip text="Search by reference, amount, or depositor name to find the deposit to allocate." side="bottom" className="absolute right-10 top-1/2 -translate-y-1/2" />
                {searchTerm && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearchTerm('')}>
                    <X className="w-4 h-4" />
                  </button>
                )}
             </div>

             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`gap-1.5 h-10 px-3 ${activeFiltersCount > 0 ? 'bg-[var(--pos-accent-tint)] border-[var(--pos-accent)] text-[var(--pos-accent)]' : 'border-[#D6D6D6]'}`} data-testid="button-filter">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="text-xs">{activeFiltersCount > 0 ? `${activeFiltersCount} Filter` : 'Filter'}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 sm:w-96 p-4" align="start">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-medium text-sm">Filter Options</h4>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-red-600 hover:text-red-700" onClick={clearFilters}>
                                    Clear all
                                </Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Transaction Date Range <HelpTip text="Filter deposits by date range to find specific transactions." side="right" /></Label>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1"><DatePicker date={txnDateFrom} setDate={setTxnDateFrom} placeholder="From" className="h-9 text-xs" /></div>
                                <span className="text-muted-foreground text-xs">to</span>
                                <div className="flex-1"><DatePicker date={txnDateTo} setDate={setTxnDateTo} placeholder="To" className="h-9 text-xs" /></div>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
             </Popover>

             <Button variant="outline" size="sm" className="h-11 sm:h-10 px-3 gap-1.5 border-[#D6D6D6]" onClick={() => loadData(page)} disabled={loading} data-testid="button-refresh">
                 <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                 <span className="text-xs hidden sm:inline">Refresh</span>
             </Button>

             <div className="hidden sm:block h-8 w-px bg-[#D6D6D6]" />

             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9 text-slate-400 hover:text-emerald-600" title="Export CSV" onClick={() => handleDownload('excel')} data-testid="button-export-excel">
                  <FileSpreadsheet className="w-4 h-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9 text-slate-400 hover:text-red-600" title="Export PDF" onClick={() => handleDownload('pdf')} data-testid="button-export-pdf">
                  <FileText className="w-4 h-4" />
               </Button>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{pageUnmatchedCount} unmatched</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{pageAllocatedCount} allocated</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-slate-400">on this page ({filtered.length} of {totalCount.toLocaleString()})</span>
            </div>
            {!autoMatchRunning && pageUnmatchedCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2" onClick={runAutoMatchAll} data-testid="button-auto-match-page">
                <Zap className="w-3 h-3" /> Auto-Match Page
              </Button>
            )}
            {autoMatchRunning && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 flex-shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-[140px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-amber-800">Analyzing descriptions...</span>
                    <span className="text-amber-600 font-mono">{autoMatchProgress.done}/{autoMatchProgress.total}</span>
                  </div>
                  <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${autoMatchProgress.total > 0 ? Math.round((autoMatchProgress.done / autoMatchProgress.total) * 100) : 0}%`,
                        backgroundColor: 'var(--pos-accent)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-amber-600">
                    {autoMatchProgress.total > 0 ? `${Math.round((autoMatchProgress.done / autoMatchProgress.total) * 100)}%` : '0%'}
                    {' · '}Searching meters, accounts & references
                  </span>
                </div>
                <button
                  className="text-[10px] font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors flex-shrink-0"
                  onClick={() => { autoMatchAbort.current = true; }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Banknote className="w-3 h-3" />
              <span className="hidden sm:inline">Page total: </span>
              <span className="font-mono font-medium text-slate-700">R {pageTotalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="sm:flex-1 sm:overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
          {error && (
            <Alert variant="destructive" className="mb-3 rounded-xl">
              <AlertTitle>Error loading data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="h-full flex flex-col">
            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)] mb-2" />
                  <span className="text-xs text-muted-foreground">Loading deposits...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16" data-testid="text-empty-state-mobile">
                  <div className="w-14 h-14 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mx-auto mb-3">
                    <Banknote className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No bank deposits found.' : 'No items match your search.'}</p>
                </div>
              ) : filtered.map(tx => {
                const bestMatch = !tx.billingAllocated ? getBestMatch(tx.posItem_ID) : null;
                const matchInd = !tx.billingAllocated ? getMatchIndicator(tx.posItem_ID) : 'none';
                const isSelected = selectedIds.has(tx.posItem_ID);
                return (
                <div key={tx.posItem_ID} data-testid={`card-positem-${tx.posItem_ID}`} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${isSelected ? 'ring-2 ring-[var(--pos-accent)]/30 border-[var(--pos-accent)]/40' : ''}`}>
                  <div className="p-3.5">
                    <div className="flex items-start gap-2.5 mb-2">
                      {!tx.billingAllocated && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(tx.posItem_ID)}
                          className="mt-0.5 data-[state=checked]:bg-[var(--pos-accent)] data-[state=checked]:border-[var(--pos-accent)]"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-800 break-words">{tx.note || '-'}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          #{tx.posItem_ID} | {tx.dateOfTransaction ? new Date(tx.dateOfTransaction).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </div>
                      </div>
                      {tx.billingAllocated ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] shrink-0">Allocated</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0">Unmatched</Badge>
                      )}
                    </div>
                    {!tx.billingAllocated && bestMatch && (
                      <button
                        className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border mb-2 text-left transition-colors ${
                          matchInd === 'high' ? 'bg-emerald-50/60 border-emerald-200' :
                          matchInd === 'medium' ? 'bg-amber-50/60 border-amber-200' :
                          'bg-slate-50/60 border-slate-200'
                        }`}
                        onClick={() => handleAllocateClick(tx.posItem_ID, undefined, bestMatch)}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${matchInd === 'high' ? 'bg-emerald-500' : matchInd === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-slate-700">{bestMatch.accountNo}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">{bestMatch.name}</span>
                          <div className="text-[9px] text-slate-400">{getMatchTypeLabel(bestMatch.matchType)} match · {bestMatch.matchDetail}</div>
                          {bestMatch.priorAllocations && bestMatch.priorAllocations.length > 0 && (() => {
                            const latest = bestMatch.priorAllocations[0];
                            const dateStr = latest.dateCaptured ? new Date(latest.dateCaptured).toLocaleDateString('en-GB') : '—';
                            return (
                              <div className="text-[9px] text-blue-500 flex items-center gap-1 mt-0.5">
                                <HistoryIcon className="w-2.5 h-2.5" />
                                Last: {dateStr} · R {latest.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </div>
                            );
                          })()}
                        </div>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${matchInd === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{bestMatch.confidence}%</Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      </button>
                    )}
                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="font-mono text-[10px]">{tx.reference || '-'}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-800">R {(tx.amount || 0).toFixed(2)}</span>
                        {!tx.billingAllocated && (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-amber-500" onClick={(e) => { e.stopPropagation(); toggleSuggestion(tx.posItem_ID, tx.note, tx.reference); }}>
                              <Sparkles className="w-4 h-4" />
                            </Button>
                            <Button size="sm" className="h-11 text-xs bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] px-3" disabled={checkingItemId === tx.posItem_ID} onClick={(e) => handleAllocateClick(tx.posItem_ID, e)} data-testid={`button-allocate-mobile-${tx.posItem_ID}`}>
                              {checkingItemId === tx.posItem_ID ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Allocate <ArrowRight className="ml-1 w-3.5 h-3.5" /></>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedSuggestion === tx.posItem_ID && (
                    <SuggestionPanel
                      posItemId={tx.posItem_ID}
                      suggestions={suggestions[tx.posItem_ID]}
                      loading={loadingSuggestions.has(tx.posItem_ID)}
                      getConfidenceColor={getConfidenceColor}
                      getMatchIcon={getMatchIcon}
                      onAllocate={(posId, account) => handleAllocateClick(posId, undefined, account)}
                    />
                  )}
                </div>
              );})}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:flex sm:flex-col flex-1 min-h-0 rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b bg-[#F7F7F7]">
                    <th className="text-center px-2 py-2.5 w-10">
                      <Checkbox
                        checked={allUnmatchedSelected ? true : (unmatchedFiltered.some(i => selectedIds.has(i.posItem_ID)) ? 'indeterminate' : false)}
                        onCheckedChange={toggleSelectAll}
                        className="data-[state=checked]:bg-[var(--pos-accent)] data-[state=checked]:border-[var(--pos-accent)]"
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-14">ID</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-24">Date</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Description</th>
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-44">Match</th>
                    <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-28">Amount</th>
                    <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-24">Status</th>
                    <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--pos-accent)] mb-2" />
                        <span className="text-xs text-muted-foreground">Loading deposits...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center" data-testid="text-empty-state">
                        <div className="w-14 h-14 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mx-auto mb-3">
                          <Banknote className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">{items.length === 0 ? 'No bank deposits found.' : 'No items match your search.'}</p>
                      </td>
                    </tr>
                  ) : filtered.map(tx => {
                    const matchIndicator = !tx.billingAllocated ? getMatchIndicator(tx.posItem_ID) : 'none';
                    const bestMatch = !tx.billingAllocated ? getBestMatch(tx.posItem_ID) : null;
                    const isSelected = selectedIds.has(tx.posItem_ID);
                    return (
                    <React.Fragment key={tx.posItem_ID}>
                      <tr
                        data-testid={`row-positem-${tx.posItem_ID}`}
                        className={`transition-colors ${!tx.billingAllocated ? 'cursor-pointer hover:bg-[#F7F7F7]' : ''} ${expandedSuggestion === tx.posItem_ID ? 'bg-amber-50/30' : ''} ${isSelected ? 'bg-blue-50/40' : ''}`}
                        onClick={() => !tx.billingAllocated && checkingItemId === null && handleAllocateClick(tx.posItem_ID)}
                      >
                        <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {!tx.billingAllocated && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(tx.posItem_ID)}
                              className="data-[state=checked]:bg-[var(--pos-accent)] data-[state=checked]:border-[var(--pos-accent)]"
                              data-testid={`checkbox-${tx.posItem_ID}`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{tx.posItem_ID}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">
                          <span className="font-mono">{tx.dateOfTransaction ? new Date(tx.dateOfTransaction).toLocaleDateString('en-GB', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs text-slate-700 truncate max-w-[350px]" title={tx.note}>{tx.note || '-'}</div>
                          {tx.reference && <div className="font-mono text-[10px] text-slate-400 mt-0.5">{tx.reference}</div>}
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {!tx.billingAllocated && bestMatch ? (
                            <button
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-left w-full transition-colors hover:border-[var(--pos-accent)] ${
                                matchIndicator === 'high' ? 'bg-emerald-50/60 border-emerald-200' :
                                matchIndicator === 'medium' ? 'bg-amber-50/60 border-amber-200' :
                                'bg-slate-50/60 border-slate-200'
                              }`}
                              onClick={() => handleAllocateClick(tx.posItem_ID, undefined, bestMatch)}
                              title={`${bestMatch.matchDetail} — Click to allocate`}
                            >
                              <div className={`w-2 h-2 rounded-full shrink-0 ${
                                matchIndicator === 'high' ? 'bg-emerald-500' :
                                matchIndicator === 'medium' ? 'bg-amber-500' :
                                'bg-slate-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-[10px] text-slate-700 truncate">{bestMatch.accountNo}</div>
                                <div className="text-[9px] text-slate-500 truncate">{bestMatch.name}</div>
                                <div className="text-[8px] text-slate-400 truncate">{getMatchTypeLabel(bestMatch.matchType)} match · {bestMatch.matchDetail}</div>
                                {bestMatch.priorAllocations && bestMatch.priorAllocations.length > 0 && (() => {
                                  const latest = bestMatch.priorAllocations[0];
                                  const dateStr = latest.dateCaptured ? new Date(latest.dateCaptured).toLocaleDateString('en-GB') : '—';
                                  return (
                                    <div className="text-[8px] text-blue-500 flex items-center gap-1 mt-0.5">
                                      <HistoryIcon className="w-2.5 h-2.5" />
                                      Last: {dateStr} · R {latest.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                    </div>
                                  );
                                })()}
                              </div>
                              <Badge variant="outline" className={`text-[8px] px-1 py-0 shrink-0 ${
                                matchIndicator === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                matchIndicator === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>{bestMatch.confidence}%</Badge>
                            </button>
                          ) : !tx.billingAllocated && suggestions[tx.posItem_ID] !== undefined ? (
                            <span className="text-[10px] text-slate-400 italic">No match</span>
                          ) : !tx.billingAllocated ? (
                            <span className="text-[10px] text-slate-300">—</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-xs font-semibold text-slate-800">R {(tx.amount || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {tx.billingAllocated ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Allocated</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Unmatched</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {!tx.billingAllocated && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 ${expandedSuggestion === tx.posItem_ID ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600'}`}
                                title="Smart suggestions"
                                onClick={(e) => { e.stopPropagation(); toggleSuggestion(tx.posItem_ID, tx.note, tx.reference); }}
                                data-testid={`button-suggest-${tx.posItem_ID}`}
                              >
                                {loadingSuggestions.has(tx.posItem_ID) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-xs gap-1 px-3"
                                disabled={checkingItemId === tx.posItem_ID}
                                onClick={(e) => handleAllocateClick(tx.posItem_ID, e)}
                                data-testid={`button-allocate-${tx.posItem_ID}`}
                              >
                                {checkingItemId === tx.posItem_ID ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : null}
                                Allocate <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedSuggestion === tx.posItem_ID && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <SuggestionPanel
                              posItemId={tx.posItem_ID}
                              suggestions={suggestions[tx.posItem_ID]}
                              loading={loadingSuggestions.has(tx.posItem_ID)}
                              getConfidenceColor={getConfidenceColor}
                              getMatchIcon={getMatchIcon}
                              onAllocate={(posId, account) => handleAllocateClick(posId, undefined, account)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );})}
                </tbody>
              </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t bg-[#F7F7F7]/50">
                  <p className="text-xs text-muted-foreground">
                    Page <span className="font-medium text-slate-700">{page}</span> of <span className="font-medium text-slate-700">{totalPages}</span> <span className="text-slate-400">({totalCount.toLocaleString()} items)</span>
                  </p>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-[#D6D6D6]" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-[#D6D6D6]" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile pagination */}
            {totalPages > 1 && (
              <div className="sm:hidden flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">Page {page}/{totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-11 text-xs px-3" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page-mobile">
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-11 text-xs px-3" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} data-testid="button-next-page-mobile">
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center gap-3 bg-[#1a1a2e] text-white rounded-2xl shadow-2xl px-4 sm:px-5 py-3 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--pos-accent)] flex items-center justify-center">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{selectedItems.length} selected</div>
                    <div className="text-[10px] text-white/60 font-mono">R {selectedTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-xs text-white hover:bg-white/10 gap-1.5 px-3"
                  onClick={runAutoMatchSelected}
                  disabled={autoMatchRunning}
                  data-testid="button-auto-match-selected"
                >
                  {autoMatchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  Auto-Match
                </Button>
                {selectedWithMatch.length > 0 && (
                  <Button
                    size="sm"
                    className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1.5 px-3"
                    onClick={openBulkAllocate}
                    data-testid="button-allocate-matched"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Auto-Allocate {selectedWithMatch.length} Matched
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setSelectedIds(new Set())}
                  data-testid="button-clear-selection"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PosLayout>

    <Dialog open={bulkAllocOpen} onOpenChange={(open) => { if (!bulkAllocRunning) setBulkAllocOpen(open); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-700/50 text-white overflow-hidden" style={{ borderRadius: '16px' }}>
        <div className="shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-slate-700/40" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.06) 100%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--pos-accent, #10b981)' }}>
                  <Zap className="w-4.5 h-4.5 text-white" />
                </div>
                Batch Allocation Review
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Review all {bulkAllocItems.length} items below. Change accounts or remove items before processing.
              </DialogDescription>
            </div>
            {!bulkAllocRunning && bulkAllocDone === 0 && (
              <button onClick={() => setBulkAllocOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/40">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Items</div>
              <div className="text-lg font-bold text-white" data-testid="bulk-summary-count">{bulkAllocItems.length}</div>
            </div>
            <div className="bg-slate-800/60 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/40">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Total Amount</div>
              <div className="text-lg font-bold text-white" data-testid="bulk-summary-amount">R {bulkAllocTotalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-800/60 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/40">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Confidence</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {bulkHighConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{bulkHighConfCount} high</Badge>}
                {bulkMedConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">{bulkMedConfCount} med</Badge>}
                {bulkLowConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-red-500/20 text-red-400 border-red-500/30">{bulkLowConfCount} low</Badge>}
              </div>
            </div>
            <div className="bg-slate-800/60 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/40">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Status</div>
              <div className="text-sm font-semibold mt-0.5">
                {bulkAllocRunning ? (
                  <span className="text-amber-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing {bulkAllocDone}/{bulkAllocItems.length}</span>
                ) : bulkAllocDone > 0 ? (
                  <span className="flex items-center gap-1.5">
                    {bulkAllocSuccessCount > 0 && <span className="text-emerald-400">{bulkAllocSuccessCount} done</span>}
                    {bulkAllocFailCount > 0 && <span className="text-red-400">{bulkAllocFailCount} failed</span>}
                  </span>
                ) : bulkAmendedCount > 0 ? (
                  <span className="text-blue-400">{bulkAmendedCount} amended</span>
                ) : (
                  <span className="text-slate-400">Ready to process</span>
                )}
              </div>
            </div>
          </div>

          {bulkAllocRunning && (
            <div className="mt-3">
              <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${bulkAllocItems.length > 0 ? (bulkAllocDone / bulkAllocItems.length) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--pos-accent, #10b981), #3b82f6)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-5 py-3 space-y-2">
          {bulkAllocItems.map((item, idx) => {
            const isExpanded = bulkExpandedItem === item.posItemId;
            const isSearching = bulkSearching === item.posItemId;
            const confColor = item.match.confidence >= 80 ? 'emerald' : item.match.confidence >= 60 ? 'amber' : 'red';
            const statusBorder = item.status === 'success' ? 'border-emerald-500/40' : item.status === 'failed' ? 'border-red-500/40' : item.status === 'submitting' || item.status === 'polling' ? 'border-amber-500/40' : item.amended ? 'border-blue-500/40' : 'border-slate-700/50';
            const statusBg = item.status === 'success' ? 'bg-emerald-500/5' : item.status === 'failed' ? 'bg-red-500/5' : item.status === 'submitting' || item.status === 'polling' ? 'bg-amber-500/5' : 'bg-slate-800/40';

            return (
              <div key={item.posItemId} data-testid={`bulk-alloc-row-${item.posItemId}`} className={`rounded-xl border transition-all duration-200 ${statusBorder} ${statusBg} overflow-hidden`}>
                <div role="button" tabIndex={0} aria-expanded={isExpanded} className="w-full text-left px-3.5 sm:px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 rounded-t-xl" onClick={() => { if (!bulkAllocRunning) setBulkExpandedItem(isExpanded ? null : item.posItemId); }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !bulkAllocRunning) { e.preventDefault(); setBulkExpandedItem(isExpanded ? null : item.posItemId); } }} data-testid={`bulk-expand-${item.posItemId}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: item.status === 'success' ? '#10b981' : item.status === 'failed' ? '#ef4444' : item.status === 'submitting' || item.status === 'polling' ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: item.status === 'pending' ? '#94a3b8' : '#fff' }}>
                      {item.status === 'submitting' || item.status === 'polling' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : item.status === 'success' ? <CheckSquare className="w-3.5 h-3.5" /> : item.status === 'failed' ? <X className="w-3.5 h-3.5" /> : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[180px] sm:max-w-[280px]" title={item.note || item.reference}>
                          {item.note || item.reference || `POS Item ${item.posItemId}`}
                        </span>
                        <span className="text-sm font-bold text-white shrink-0">R {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className={`font-mono text-xs ${item.amended ? 'text-blue-300' : 'text-emerald-300'}`}>{item.match.accountNo}</span>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">—</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px] sm:max-w-[220px] hidden sm:inline">{item.match.name}</span>
                        <Badge className={`text-[8px] px-1.5 py-0 shrink-0 border bg-${confColor}-500/15 text-${confColor}-400 border-${confColor}-500/30`} style={{ backgroundColor: confColor === 'emerald' ? 'rgba(16,185,129,0.15)' : confColor === 'amber' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: confColor === 'emerald' ? '#34d399' : confColor === 'amber' ? '#fbbf24' : '#f87171', borderColor: confColor === 'emerald' ? 'rgba(16,185,129,0.3)' : confColor === 'amber' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)' }}>{item.match.confidence}%</Badge>
                        {item.amended && <Badge className="text-[8px] px-1.5 py-0 bg-blue-500/15 text-blue-400 border-blue-500/30">Amended</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'pending' && !bulkAllocRunning && (
                        <button onClick={(e) => { e.stopPropagation(); removeBulkItem(item.posItemId); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" title="Remove" data-testid={`bulk-remove-${item.posItemId}`}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.status === 'failed' && <span className="text-[10px] text-red-400 max-w-[100px] truncate hidden sm:inline" title={item.error}>{item.error}</span>}
                      {!bulkAllocRunning && item.status === 'pending' && (
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && !bulkAllocRunning && item.status === 'pending' && (
                  <div className="border-t border-slate-700/30 px-3.5 sm:px-4 py-3 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">Transaction Details</div>
                        <div className="bg-slate-800/50 rounded-lg p-2.5 space-y-1.5 text-xs border border-slate-700/30">
                          <div className="flex justify-between"><span className="text-slate-500">Description</span><span className="text-slate-300 text-right max-w-[200px] truncate" title={item.note}>{item.note || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-slate-300">{item.reference || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="text-slate-300">{item.dateOfTransaction ? new Date(item.dateOfTransaction).toLocaleDateString('en-GB') : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-white">R {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">POS Item</span><span className="font-mono text-slate-400">{item.posItemId}</span></div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">Target Account</div>
                        <div className={`rounded-lg p-2.5 space-y-1.5 text-xs border ${item.amended ? 'bg-blue-500/5 border-blue-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                          <div className="flex justify-between"><span className="text-slate-500">Account No</span><span className={`font-mono font-bold ${item.amended ? 'text-blue-300' : 'text-emerald-300'}`}>{item.match.accountNo}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="text-slate-300 text-right max-w-[160px] truncate">{item.match.name || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Match Type</span><span className="text-slate-300">{getMatchTypeLabel(item.match.matchType)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Confidence</span><Badge className="text-[9px] px-1.5 py-0" style={{ backgroundColor: confColor === 'emerald' ? 'rgba(16,185,129,0.15)' : confColor === 'amber' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: confColor === 'emerald' ? '#34d399' : confColor === 'amber' ? '#fbbf24' : '#f87171', borderColor: confColor === 'emerald' ? 'rgba(16,185,129,0.3)' : confColor === 'amber' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)' }}>{item.match.confidence}%</Badge></div>
                          {item.match.outstandingAmount != null && <div className="flex justify-between"><span className="text-slate-500">Outstanding</span><span className="font-mono text-slate-300">R {item.match.outstandingAmount.toFixed(2)}</span></div>}
                        </div>
                      </div>
                    </div>

                    {item.match.priorAllocations && item.match.priorAllocations.length > 0 && (
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5">
                          <HistoryIcon className="w-3 h-3 text-blue-400" /> Recent Allocations to this Account
                        </div>
                        <div className="space-y-1">
                          {item.match.priorAllocations.slice(0, 3).map((pa, pi) => (
                            <div key={pi} className="flex items-center gap-3 bg-blue-500/5 rounded-lg px-2.5 py-1.5 border border-blue-500/15 text-xs">
                              <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
                              <span className="text-slate-400 shrink-0">{pa.dateCaptured ? new Date(pa.dateCaptured).toLocaleDateString('en-GB') : '—'}</span>
                              <span className="text-slate-500 truncate flex-1" title={pa.paymentReference}>{pa.paymentReference || 'No reference'}</span>
                              <span className="font-mono font-semibold text-blue-300 shrink-0">R {pa.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.match.matchReasoning && item.match.matchReasoning.length > 0 && (
                      <div className="bg-slate-800/30 rounded-lg px-2.5 py-2 border border-slate-700/30">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-medium mb-1">Match Logic</div>
                        <div className="space-y-0.5">
                          {item.match.matchReasoning.map((r, ri) => (
                            <div key={ri} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                              <span className="text-slate-600 mt-0.5 shrink-0">&#8226;</span><span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-700/30 pt-3">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-medium mb-2">Change Account</div>
                      <div className="flex flex-col gap-2">
                        {!isSearching && item.alternativeMatches.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 mb-1">Alternative suggestions:</div>
                            {item.alternativeMatches.slice(0, 3).map((alt, ai) => (
                              <button key={ai} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-700/40 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left text-xs group" onClick={() => changeBulkItemMatch(item.posItemId, alt)} data-testid={`bulk-alt-${item.posItemId}-${ai}`}>
                                <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-700/50 text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors shrink-0">
                                  {getMatchIcon(alt.matchType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono text-slate-300">{alt.accountNo}</span>
                                  <span className="text-slate-500 ml-1.5">{alt.name}</span>
                                </div>
                                <Badge className="text-[8px] px-1.5 py-0 shrink-0" style={{ backgroundColor: alt.confidence >= 80 ? 'rgba(16,185,129,0.15)' : alt.confidence >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: alt.confidence >= 80 ? '#34d399' : alt.confidence >= 60 ? '#fbbf24' : '#f87171' }}>{alt.confidence}%</Badge>
                              </button>
                            ))}
                          </div>
                        )}

                        {isSearching ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <Input
                                  autoFocus
                                  placeholder="Type account number or name..."
                                  className="h-9 text-xs pl-8 bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500"
                                  value={bulkSearchTerm}
                                  onChange={(e) => { doBulkAccountSearch(e.target.value); }}
                                  data-testid={`bulk-search-input-${item.posItemId}`}
                                />
                              </div>
                              <Button size="sm" variant="ghost" className="h-9 text-slate-400 hover:text-white px-2" onClick={() => { setBulkSearching(null); setBulkSearchTerm(''); setBulkSearchResults([]); }}>
                                Cancel
                              </Button>
                            </div>
                            {bulkSearchResults.length > 0 && (
                              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                                {bulkSearchResults.map((sr, si) => (
                                  <button key={si} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-700/40 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left text-xs" onClick={() => changeBulkItemMatch(item.posItemId, sr)} data-testid={`bulk-search-result-${item.posItemId}-${si}`}>
                                    <Hash className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="font-mono text-emerald-300">{sr.accountNo}</span>
                                    <span className="text-slate-400 flex-1 truncate">{sr.name}</span>
                                    {sr.outstandingAmount != null && <span className="text-[10px] font-mono text-slate-500 shrink-0">R {sr.outstandingAmount.toFixed(2)}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                            {bulkSearchTerm.length >= 3 && bulkSearchResults.length === 0 && (
                              <div className="text-[10px] text-slate-500 text-center py-2">No accounts found</div>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 text-xs border-slate-600 text-slate-400 hover:text-white hover:border-blue-500/40 hover:bg-blue-500/5 gap-1.5 w-full sm:w-auto" onClick={() => startBulkAccountSearch(item.posItemId)} data-testid={`bulk-change-account-${item.posItemId}`}>
                            <Search className="w-3 h-3" /> Search Different Account
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-slate-700/40 px-5 sm:px-7 py-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 hidden sm:block">
              {bulkAllocItems.length} item{bulkAllocItems.length !== 1 ? 's' : ''} · R {bulkAllocTotalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} total
              {bulkAmendedCount > 0 && <span className="text-blue-400 ml-2">· {bulkAmendedCount} amended</span>}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!bulkAllocRunning && bulkAllocDone === 0 && (
                <>
                  <Button variant="ghost" className="text-slate-400 hover:text-white flex-1 sm:flex-none" onClick={() => setBulkAllocOpen(false)} data-testid="bulk-alloc-cancel">
                    Cancel
                  </Button>
                  <Button className="gap-2 flex-1 sm:flex-none h-10 px-6 font-semibold text-sm" style={{ background: 'linear-gradient(135deg, var(--pos-accent, #10b981), #3b82f6)', boxShadow: '0 4px 14px rgba(16,185,129,0.25)' }} onClick={executeBulkAllocate} disabled={bulkAllocItems.length === 0} data-testid="bulk-alloc-confirm">
                    <Zap className="w-4 h-4" />
                    Process {bulkAllocItems.length} Allocation{bulkAllocItems.length !== 1 ? 's' : ''}
                  </Button>
                </>
              )}
              {bulkAllocRunning && (
                <Button variant="destructive" className="gap-1.5 flex-1 sm:flex-none" onClick={() => { bulkAllocAbort.current = true; }} data-testid="bulk-alloc-stop">
                  <X className="w-4 h-4" /> Stop After Current
                </Button>
              )}
              {!bulkAllocRunning && bulkAllocDone > 0 && (
                <Button className="gap-2 flex-1 sm:flex-none h-10 px-6 font-semibold text-sm" style={{ background: bulkAllocFailCount > 0 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, var(--pos-accent, #10b981), #3b82f6)', boxShadow: '0 4px 14px rgba(16,185,129,0.25)' }} onClick={() => { setBulkAllocOpen(false); setSelectedIds(new Set()); loadData(page); }} data-testid="bulk-alloc-done">
                  <CheckSquare className="w-4 h-4" />
                  {bulkAllocFailCount > 0 ? `Done — ${bulkAllocSuccessCount} Allocated, ${bulkAllocFailCount} Failed` : `Done — ${bulkAllocSuccessCount} Allocated`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function SuggestionPanel({ posItemId, suggestions, loading, getConfidenceColor, getMatchIcon, onAllocate }: {
  posItemId: number;
  suggestions?: SuggestedMatch[];
  loading: boolean;
  getConfidenceColor: (c: number) => string;
  getMatchIcon: (t: SuggestedMatch['matchType']) => React.ReactNode;
  onAllocate: (posId: number, account?: SuggestedMatch) => void;
}) {
  return (
    <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 border-t border-amber-100 px-3 sm:px-5 py-3 sm:py-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-800">Smart Suggestions</span>
        <span className="text-[10px] text-amber-600/70 hidden sm:inline">Based on description analysis</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span className="text-xs text-amber-700">Analyzing description and searching accounts...</span>
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="py-2 text-xs text-amber-700/70 flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          No automatic matches found. Use the Allocate button to search manually.
        </div>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s, idx) => (
            <div key={`${s.accountId}-${idx}`} className="bg-white/70 backdrop-blur-sm rounded-lg border border-amber-100/60 hover:border-amber-200 transition-colors group overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-bold ${getConfidenceColor(s.confidence)}`}>
                      {s.confidence}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600 shrink-0">
                    {getMatchIcon(s.matchType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-slate-700">{s.accountNo}</span>
                      <span className="text-xs text-slate-500 break-words sm:truncate">{s.name}</span>
                    </div>
                    <div className="text-[10px] text-amber-600/80 break-words sm:truncate">{s.matchDetail}</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {s.outstandingAmount != null && s.outstandingAmount !== 0 && (
                    <span className="text-[10px] font-mono text-slate-500 bg-[#F7F7F7] px-1.5 py-0.5 rounded shrink-0">
                      R {s.outstandingAmount.toFixed(2)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    className="h-9 sm:h-7 text-xs sm:text-[10px] bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white shrink-0 px-3 sm:px-2.5 gap-1"
                    onClick={(e) => { e.stopPropagation(); onAllocate(posItemId, s); }}
                  >
                    Allocate <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {s.matchReasoning && s.matchReasoning.length > 0 && (
                <div className="px-3 pb-2 pt-0">
                  <div className="bg-amber-50/70 rounded-md px-2.5 py-1.5 border border-amber-100/50">
                    <div className="text-[9px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Match Logic</div>
                    <ul className="space-y-0">
                      {s.matchReasoning.map((r, ri) => (
                        <li key={ri} className="text-[10px] text-amber-800/80 flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5 shrink-0">&#8226;</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {s.priorAllocations && s.priorAllocations.length > 0 && (
                <div className="px-3 pb-2.5 pt-0">
                  <div className="bg-blue-50/70 rounded-md px-2.5 py-2 border border-blue-100/60">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <HistoryIcon className="w-3 h-3 text-blue-600" />
                      <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wider">
                        Recent Allocations ({s.priorAllocations.length})
                      </span>
                      <span className="text-[8px] text-blue-400 ml-auto">from recent completed jobs</span>
                    </div>
                    <div className="space-y-1">
                      {s.priorAllocations.slice(0, 5).map((pa, pi) => {
                        const dateStr = pa.dateCaptured
                          ? new Date(pa.dateCaptured).toLocaleDateString('en-GB')
                          : '—';
                        return (
                          <div key={pi} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-white/60 rounded px-2 py-1.5 border border-blue-100/40" data-testid={`prior-alloc-${pi}`}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
                              <span className="text-[10px] text-slate-600 font-medium shrink-0">{dateStr}</span>
                              <span className="text-[10px] text-slate-400 truncate" title={pa.paymentReference}>
                                {pa.paymentReference || 'No reference'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-mono font-semibold text-blue-700">
                                R {pa.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </span>
                              <Badge variant="outline" className="text-[8px] border-blue-200 text-blue-500 px-1 py-0">
                                Job #{pa.jobId}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                      {s.priorAllocations.length > 5 && (
                        <div className="text-[10px] text-blue-500 text-center pt-0.5">
                          + {s.priorAllocations.length - 5} more previous allocation(s)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function HistoryIcon(props: any) {
    return (
        <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
    )
}
