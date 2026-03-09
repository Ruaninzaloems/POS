import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowRight, Filter, FileSpreadsheet, FileText, X, HelpCircle, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, Building2, MapPin, Hash, RefreshCw, ChevronDown, ChevronUp, Calendar, Banknote, RotateCcw, CheckSquare, Zap, Users, Check, Info, Clock, Landmark, Shield } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { platinumGetBankReconPosItemList, platinumCheckSelectedItemProcessed, platinumSearchAccountsPayment, platinumDDAccountAutocomplete, platinumDDOldAccountAutocomplete, fetchAccounts, fetchActiveFinYear, fetchBulkAllocationList, fetchBulkProgressJobAccountDetails, submitDDAllocationBatch, pollDDAllocationJob, searchByBankStatementNote, fetchMiscPaymentGroups, fetchInstitutions, platinumDDClearanceAutocomplete, platinumGetClearanceData } from '@/lib/external-api';
import { autocomplete as billingAutocomplete, searchAccounts as billingEnquirySearch, getAccountBalance } from '@/lib/enquiries-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePos } from '@/lib/pos-state';
import { useToast } from '@/hooks/use-toast';
import AllocateTransaction from './allocate-transaction';

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
  matchType: 'account_number' | 'old_account' | 'erf_number' | 'reference' | 'meter_number' | 'history' | 'name' | 'direct_income' | 'institution' | 'clearance';
  matchDetail: string;
  confidence: number;
  matchReasoning?: string[];
  priorAllocations?: PriorAllocation[];
  statusDesc?: string;
  typeOfUseDesc?: string;
  accountDesc?: string;
  address?: string;
  town?: string;
  activeServices?: number;
  erfNumber?: string;
  sgNumber?: string;
  suburb?: string;
  portion?: string;
  allotment?: string;
  matchSources?: string[];
  bankStatementPrior?: { receiptNo: string; paidAmount: number; date: string; status: string; description?: string; cashierName?: string; dateCaptured?: string }[];
  miscPaymentGroupId?: number;
  miscPaymentGroupName?: string;
  institutionId?: number;
  institutionName?: string;
  clearanceId?: string;
  costScheduleId?: number;
  clearanceTotalDue?: number;
  clearanceStatus?: string;
  clearanceSgNumber?: string;
  clearanceAccountName?: string;
}

function parseSgNumber(sg: string | undefined | null): { erf?: string; portion?: string; allotment?: string } {
  if (!sg) return {};
  const parts = sg.split('/');
  return {
    erf: parts.length >= 3 ? parts[2] : undefined,
    portion: parts.length >= 4 ? parts[3] : undefined,
    allotment: parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined,
  };
}

const GENERIC_WORDS = new Set([
  'dep', 'deposit', 'payment', 'pmt', 'water', 'meter', 'mtr', 'wtr',
  'acc', 'account', 'no', 'nr', 'number', 'ref', 'the', 'and', 'for',
  'of', 'to', 'in', 'at', 'ob', 'eft', 'fnb', 'absa', 'std', 'nedbank',
  'capitec', 'investec', 'credit', 'debit', 'int', 'dom', 'internet',
  'general', 'magtape', 'bank', 'transfer', 'municipality',
  'municipal', 'seq', 'inv', 'user',
]);

const NON_AREA_DESCRIPTORS = new Set([
  'building', 'plan', 'plans', 'rezoning', 'subdivision', 'consolidation',
  'lease', 'rental', 'tender', 'deposit', 'fee', 'fees', 'fine', 'fines',
  'penalty', 'licence', 'license', 'permit', 'certificate', 'valuation',
  'rates', 'assessment', 'clearance', 'housing', 'land', 'sale', 'purchase',
  'rent', 'application', 'approval', 'connection', 'reconnection',
  'disconnection', 'advertising', 'sign', 'encroachment', 'wayleave',
  'cemetery', 'burial', 'cremation', 'pool', 'hall', 'venue',
  'inspection', 'compliance', 'occupancy', 'business', 'trading',
]);

interface ParsedErf {
  erf: string;
  portion: string | null;
  area: string;
  qualifier: string | null;
}

interface ParsedClues {
  accountNumbers: string[];
  meterNumbers: string[];
  erfNumbers: ParsedErf[];
  oldAccountCodes: string[];
  keywords: string[];
  bankingRef: string | null;
  serviceType: string | null;
  nameSearchTerms: string[];
}

function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseDescriptionForClues(note: string, reference: string): ParsedClues {
  const decodedNote = decodeHtmlEntities(note || '');
  const decodedRef = decodeHtmlEntities(reference || '');
  const text = `${decodedNote} ${decodedRef}`.toUpperCase();
  const accountNumbers: string[] = [];
  const meterNumbers: string[] = [];
  const erfNumbers: ParsedErf[] = [];
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
    /ACC(?:OUNT)?\s*(?:NO\.?\s*-?\s*|#)?\s*(\d{4,})/gi,
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
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s*\/\s*(\d+)\s+(\w+)(?:\s+(\w+))?/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s*\/\s*(\d+)/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s*(?:PTN|PORTION)\s*(\d+)\s*(\w+)/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s*(?:PTN|PORTION)\s*(\d+)/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s+UNIT\s+\d+\s+(\w+)(?:\s+(\w+))?/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s+[-–]\s+(\w+)(?:\s+(\w+))?/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)\s+(\w+)(?:\s+(\w+))?/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)([A-Z]{2,})/gi,
    /ERF\s*(?:NUMBER|NR|NO\.?)?\s*:?\s*(\d+)/gi,
  ];

  const AREA_NAMES = new Set([
    'george', 'blanco', 'pacaltsdorp', 'pacalts', 'wilderness', 'uniondale',
    'haarlem', 'hoekwil', 'friemersheim', 'kleinkrantz', 'heather', 'herold',
    'herolds', 'heroldsbaai', 'herholdsbaai', 'heroldsbay', 'touwsranten',
    'slowveld', 'tyolora', 'delplan', 'conville',
    'le', 'grand', 'estate', 'outeniqua',
  ]);

  for (const pattern of erfPatterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      let erfNum: string | null = null;
      let portion: string | null = null;
      let area = '';
      let qualifier: string | null = null;

      const src = pattern.source;
      const isPtnPattern = src.includes('PTN|PORTION');
      const isUnitPattern = src.includes('UNIT');
      const isGluedAreaPattern = src.includes('([A-Z]{2,})');

      if (src.includes('\\/')) {
        erfNum = match[1];
        portion = match[2];
        area = (match[3] || '').toLowerCase().trim();
        qualifier = (match[4] || '').toLowerCase().trim() || null;
      } else if (isPtnPattern) {
        erfNum = match[1];
        portion = match[2];
        area = (match[3] || '').toLowerCase().trim();
      } else if (isUnitPattern) {
        erfNum = match[1];
        area = (match[2] || '').toLowerCase().trim();
        qualifier = (match[3] || '').toLowerCase().trim() || null;
      } else if (isGluedAreaPattern) {
        erfNum = match[1];
        area = (match[2] || '').toLowerCase().trim();
      } else if (match[2] && /^[A-Za-z]/.test(match[2])) {
        erfNum = match[1];
        area = match[2].toLowerCase().trim();
        qualifier = (match[3] || '').toLowerCase().trim() || null;
      } else {
        erfNum = match[1];
      }

      if (erfNum && erfNum.length > 8) continue;

      if (isPtnPattern && match[2]) {
        portion = match[2];
      }

      const afterMatch = text.substring(match.index + match[0].length);
      if (!area && !isPtnPattern) {
        const ptnAfter = afterMatch.match(/^\s*(?:PTN|PORTION)\s*(\d+)(?:\s+([A-Z]{3,}))?/i);
        if (ptnAfter) {
          portion = ptnAfter[1];
          if (ptnAfter[2]) area = ptnAfter[2].toLowerCase();
        }
      }

      if (area && /^ptn\d*/i.test(area)) area = '';
      if (area === 'portion' || area === 'ptn') area = '';

      if (area === 'le' || area === 'grand' || area === 'estate') {
        const leGrandMatch = text.substring(match.index).match(/LE\s+GRAND(?:\s+ESTATE)?/i);
        if (leGrandMatch) area = 'le grand estate';
        else area = '';
      }

      if (area === 'herold') {
        const heroldBayMatch = text.substring(match.index).match(/HEROLD\s*(?:S\s*)?BAY/i);
        if (heroldBayMatch) area = 'herold bay';
      }

      if (area && (GENERIC_WORDS.has(area) || NON_AREA_DESCRIPTORS.has(area))) {
        area = '';
      }
      if (area && area.length <= 2) {
        if (area === 'hb') area = 'herold bay';
        else if (area === 'ha') area = 'haarlem';
        else if (area === 'ge') area = 'george';
        else area = '';
      }

      area = area
        .replace(/deposit$/i, '')
        .replace(/depo(?:sit)?$/i, '')
        .replace(/water$/i, '')
        .replace(/conn(?:ection|ectio)?$/i, '')
        .replace(/dep$/i, '')
        .trim();

      if (area === 'georg' || area === 'grg') area = 'george';
      if (area === 'pacalts') area = 'pacaltsdorp';
      if (area === 'blanc') area = 'blanco';
      if (area === 'hb' || area === 'heroldsbay') area = 'herold bay';
      if (area === 'herholdsbaai' || area === 'heroldsbaai') area = 'herold bay';

      if (qualifier === 'ru' || qualifier === 'rural') {
        qualifier = 'rural';
      }
      if (erfNum && !erfNumbers.some(e => e.erf === erfNum && e.portion === portion)) {
        erfNumbers.push({ erf: erfNum, portion, area: area || '', qualifier });
      }
    }
  }

  const areaAccountPattern = /\b([A-Z]{3,})\s+(\d{7,12})\b/gi;
  let areaAccMatch;
  while ((areaAccMatch = areaAccountPattern.exec(text)) !== null) {
    const areaCode = areaAccMatch[1].toLowerCase();
    const accNum = areaAccMatch[2];
    if (GENERIC_WORDS.has(areaCode)) continue;
    if (!accountNumbers.includes(accNum)) {
      accountNumbers.push(accNum);
    }
    if (accNum.length >= 7 && accNum.length <= 10 && !oldAccountCodes.includes(accNum)) {
      oldAccountCodes.push(accNum);
    }
    if (!keywords.includes(areaCode)) {
      keywords.push(areaCode);
    }
  }

  if (erfNumbers.length > 0) {
    const erfNums = new Set(erfNumbers.map(e => e.erf));
    for (let i = accountNumbers.length - 1; i >= 0; i--) {
      if (erfNums.has(accountNumbers[i])) {
        accountNumbers.splice(i, 1);
      }
    }
    for (const erf of erfNumbers) {
      if (erf.erf.length >= 3 && !oldAccountCodes.includes(erf.erf)) {
        oldAccountCodes.push(erf.erf);
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

  for (const num of accountNumbers) {
    if (num.length >= 7 && num.length <= 10 && !oldAccountCodes.includes(num)) {
      oldAccountCodes.push(num);
    }
  }

  const slashSurnames: string[] = [];
  const numSlashNamePattern = /\b(\d{3,12})\s*[\/\\]\s*([A-Z][A-Za-z'-]{2,})\b/gi;
  let nsMatch;
  while ((nsMatch = numSlashNamePattern.exec(text)) !== null) {
    const num = nsMatch[1];
    const surname = nsMatch[2];
    if (!accountNumbers.includes(num)) accountNumbers.push(num);
    if (num.length >= 3 && !oldAccountCodes.includes(num)) oldAccountCodes.push(num);
    if (surname.length >= 3 && !slashSurnames.includes(surname.toLowerCase())) {
      slashSurnames.push(surname.toLowerCase());
    }
  }

  const nameSearchTerms: string[] = [...slashSurnames];
  const NOISE_WORDS = new Set(['FNB', 'OB', 'PMT', 'ABSA', 'STD', 'STANDARD', 'NEDBANK', 'CAPITEC', 'EFT', 'INT', 'CREDIT',
    'DEBIT', 'REF', 'INV', 'USER', 'MAGTAPE', 'GENERAL', 'DOM', 'INTERNET', 'PAYMENT', 'DEPOSIT',
    'ONTEC', 'FIXES', 'ACC', 'ACCOUNT', 'MTR', 'METER', 'ERF', 'SEQ', 'NO', 'NR', 'THE', 'AND', 'OF',
    'FOR', 'TO', 'IN', 'AT', 'MR', 'MRS', 'MS', 'DR', 'PROF', 'MUNICIPALITY', 'MUNICIPAL', 'GEORGE',
    'INVESTEC', 'CASHFOCUS', 'PROJECTS', 'PROJECT', 'BANK', 'TRANSFER']);
  const cleanNote = decodedNote.trim();
  if (cleanNote.length >= 3 && !isBankingDesc && accountNumbers.length === 0 && meterNumbers.length === 0 && erfNumbers.length === 0) {
    const strippedNote = cleanNote.replace(/\b[A-Z]{0,3}\d{4,}\b/gi, '').replace(/[-–—]/g, ' ').trim();
    const words = strippedNote.split(/[\s,&]+/).map(w => w.replace(/[^A-Za-z'-]/g, '')).filter(w => w.length >= 2);
    const alphaWords = words.filter(w => /^[A-Za-z'-]+$/.test(w) && !NOISE_WORDS.has(w.toUpperCase()));
    if (alphaWords.length >= 2 && alphaWords.length <= 8) {
      nameSearchTerms.push(alphaWords.join(' '));
      const longWords = alphaWords.filter(w => w.length >= 4);
      for (const word of longWords.slice(0, 2)) {
        if (!nameSearchTerms.includes(word)) {
          nameSearchTerms.push(word);
        }
      }
    }
  }

  const BANKING_NOISE = new Set(['FNB', 'OB', 'PMT', 'ABSA', 'STD', 'STANDARD', 'NEDBANK', 'CAPITEC', 'EFT', 'INT', 'CREDIT',
    'DEBIT', 'REF', 'INV', 'USER', 'MAGTAPE', 'GENERAL', 'DOM', 'INTERNET', 'PAYMENT', 'DEPOSIT',
    'ONTEC', 'ACC', 'ACCOUNT', 'MTR', 'METER', 'ERF', 'SEQ', 'NO', 'NR', 'THE', 'AND', 'OF',
    'FOR', 'TO', 'IN', 'AT', 'BANK', 'TRANSFER', 'FNBO', 'INVESTEC', 'CASHFOCUS', 'GEORGE', 'MUNICIPALITY', 'MUNICIPAL']);
  if (isBankingDesc && cleanNote.length >= 5) {
    const stripped = cleanNote.replace(/\b(FNB|ABSA|STD|STANDARD|NEDBANK|CAPITEC|FNBO|OB|PMT|EFT|INT|INTERNET|PAYMENT|DOM|MAGTAPE|CREDIT|DEBIT|REF)\b/gi, '')
      .replace(/\d{4,}/g, '').replace(/[\/\\]/g, ' ').trim();
    const nameWords = stripped.split(/[\s,&]+/).map(w => w.replace(/[^A-Za-z'-]/g, '')).filter(w => w.length >= 3 && !BANKING_NOISE.has(w.toUpperCase()));
    if (nameWords.length >= 1 && nameWords.length <= 5) {
      const fullName = nameWords.join(' ');
      if (!nameSearchTerms.includes(fullName)) nameSearchTerms.push(fullName);
      const longestWord = nameWords.reduce((a, b) => a.length >= b.length ? a : b);
      if (longestWord.length >= 4 && !nameSearchTerms.includes(longestWord)) nameSearchTerms.push(longestWord);
    }
  }

  if (cleanNote.length >= 3 && accountNumbers.length === 0 && meterNumbers.length === 0 && erfNumbers.length === 0) {
    const ampersandMatch = cleanNote.match(/^([A-Za-z\s]+)\s*&\s*([A-Za-z\s]+?)(?:\s+(\d+))?$/);
    if (ampersandMatch) {
      const part1Words = ampersandMatch[1].trim().split(/\s+/).filter((w: string) => w.length >= 2 && !NOISE_WORDS.has(w.toUpperCase()));
      const part2Words = ampersandMatch[2].trim().split(/\s+/).filter((w: string) => w.length >= 2 && !NOISE_WORDS.has(w.toUpperCase()));
      if (part1Words.length >= 1 && part2Words.length >= 1) {
        const lastName1 = part1Words[part1Words.length - 1];
        const lastName2 = part2Words[part2Words.length - 1];
        if (!nameSearchTerms.includes(lastName2)) nameSearchTerms.push(lastName2);
        if (lastName1 !== lastName2 && !nameSearchTerms.includes(lastName1)) nameSearchTerms.push(lastName1);
        const fullPhrase = cleanNote.replace(/\s*\d+\s*$/, '').trim();
        if (!nameSearchTerms.includes(fullPhrase)) nameSearchTerms.unshift(fullPhrase);
      }
    }
  }

  return { accountNumbers, meterNumbers, erfNumbers, oldAccountCodes, keywords, bankingRef, serviceType, nameSearchTerms };
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

let miscGroupsCachePromise: Promise<{ id: number; name: string }[]> | null = null;
function loadMiscGroupsCache(): Promise<{ id: number; name: string }[]> {
  if (miscGroupsCachePromise) return miscGroupsCachePromise;
  miscGroupsCachePromise = fetchMiscPaymentGroups().catch((err) => {
    console.error('[MiscGroups] Failed to load:', err);
    miscGroupsCachePromise = null;
    return [];
  });
  return miscGroupsCachePromise;
}

let institutionsCachePromise: Promise<{ id: number; name: string }[]> | null = null;
function loadInstitutionsCache(): Promise<{ id: number; name: string }[]> {
  if (institutionsCachePromise) return institutionsCachePromise;
  institutionsCachePromise = fetchInstitutions().then((items: any[]) =>
    items.map(i => ({ id: i.institutionId || i.Id || i.id, name: i.institutionName || i.Description || i.name || '' }))
      .filter(i => i.id && i.name)
  ).catch((err) => {
    console.error('[Institutions] Failed to load:', err);
    institutionsCachePromise = null;
    return [];
  });
  return institutionsCachePromise;
}

async function searchForSuggestions(note: string, reference: string, transactionAmount?: number): Promise<SuggestedMatch[]> {
  const clues = parseDescriptionForClues(note, reference);
  const suggestions: SuggestedMatch[] = [];
  const seenIds = new Set<number>();

  const sourceLabel = (mt: SuggestedMatch['matchType']): string => {
    switch (mt) {
      case 'history': return 'Prior DD Allocation';
      case 'account_number': return 'Account Number';
      case 'erf_number': return 'ERF Number';
      case 'meter_number': return 'Meter Number';
      case 'old_account': return 'Old Account Code';
      case 'name': return 'Name/Company';
      case 'reference': return 'Reference/Keyword';
      case 'direct_income': return 'Direct Income';
      case 'institution': return 'Institution/Group';
      case 'clearance': return 'Clearance';
      default: return mt;
    }
  };

  const addResult = (item: any, matchType: SuggestedMatch['matchType'], matchDetail: string, confidence: number, reasoning: string[]) => {
    const accId = item.account_ID || item.accountID || item.accountId || item.id;
    if (!accId) return;
    const clampedConf = Math.min(confidence, 99);
    const existing = suggestions.find(s => s.accountId === accId);
    if (existing) {
      const newSource = sourceLabel(matchType);
      if (!existing.matchSources) existing.matchSources = [sourceLabel(existing.matchType)];
      const isStronger = clampedConf > existing.confidence;
      if (!existing.matchSources.includes(newSource)) {
        existing.matchSources.push(newSource);
        const multiSourceBoost = Math.min(8, existing.matchSources.length * 4);
        existing.confidence = Math.min(99, Math.max(existing.confidence, clampedConf) + multiSourceBoost);
        existing.matchReasoning = [
          ...(existing.matchReasoning || []),
          `✓ Also confirmed by: ${newSource}`,
        ];
        if (isStronger) {
          existing.matchDetail = matchDetail;
          existing.matchType = matchType;
        }
      } else if (isStronger) {
        existing.confidence = clampedConf;
        existing.matchDetail = matchDetail;
        existing.matchType = matchType;
      }
      if (!existing.sgNumber && item.sgNumber) {
        const sgP = parseSgNumber(item.sgNumber);
        existing.sgNumber = item.sgNumber;
        if (!existing.erfNumber && sgP.erf) existing.erfNumber = sgP.erf;
        if (!existing.portion && sgP.portion) existing.portion = sgP.portion;
        if (!existing.allotment && sgP.allotment) existing.allotment = sgP.allotment;
      }
      if (!existing.suburb && (item.suburb || item.town)) existing.suburb = item.suburb || item.town || '';
      if (!existing.town && item.town) existing.town = item.town;
      if (!existing.address && (item.deliveryAddress || item.locationAddress || item.address)) {
        const a = item.deliveryAddress || item.locationAddress || item.address || '';
        existing.address = a.split(/[\r\n]+/).filter(Boolean)[0] || '';
      }
      if (!existing.erfNumber && item.erfNumber) existing.erfNumber = item.erfNumber;
      if (!existing.accountNo || existing.accountNo === String(accId)) {
        const betterNo = item.accountNumber || item.accountNo;
        if (betterNo && betterNo !== String(accId)) existing.accountNo = betterNo;
      }
      if (item._bankStatementPrior && !existing.bankStatementPrior) {
        existing.bankStatementPrior = item._bankStatementPrior;
      }
      const itemBal = item.outStandingAmt ?? item.outstandingAmount;
      if (itemBal != null && itemBal !== 0 && (existing.outstandingAmount === 0 || existing.outstandingAmount == null)) {
        existing.outstandingAmount = itemBal;
      }
      return;
    }
    seenIds.add(accId);
    const addr = item.deliveryAddress || item.locationAddress || item.address || '';
    const firstLine = addr ? addr.split(/[\r\n]+/).filter(Boolean)[0] || '' : '';
    const sg = item.sgNumber || '';
    const sgParsed = parseSgNumber(sg);
    suggestions.push({
      accountId: accId,
      accountNo: item.accountNumber || item.accountNo || String(accId),
      name: [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || item.accountDesc || item.typeOfUseDesc || '',
      oldAccountCode: item.oldAccountCode,
      outstandingAmount: item.outStandingAmt || item.outstandingAmount || 0,
      matchType,
      matchDetail,
      confidence: clampedConf,
      matchReasoning: reasoning,
      statusDesc: item.statusDesc,
      typeOfUseDesc: item.typeOfUseDesc,
      accountDesc: item.accountDesc,
      address: firstLine,
      town: item.town || item.suburb || '',
      activeServices: item.activeServices,
      erfNumber: item.erfNumber || sgParsed.erf,
      sgNumber: sg || undefined,
      suburb: item.suburb || '',
      portion: sgParsed.portion,
      allotment: sgParsed.allotment,
      matchSources: [sourceLabel(matchType)],
      bankStatementPrior: item._bankStatementPrior || undefined,
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

  const decodedNote = decodeHtmlEntities(note || '');
  if (decodedNote.length >= 5) {
    searchPromises.push(
      safe(() => searchByBankStatementNote(decodedNote)).then(async (results: any[]) => {
        const allocated = results.filter((r: any) => {
          const hasAccount = r.accountId && r.accountId > 0;
          const isAllocated = r.allocationStatus === 'Account Allocation' || r.billingAllocated === true || r.billingAllocated === 1;
          return hasAccount && isAllocated;
        });
        const byAccount = new Map<number, any[]>();
        for (const r of allocated) {
          const list = byAccount.get(r.accountId) || [];
          list.push(r);
          byAccount.set(r.accountId, list);
        }
        for (const [accId, recs] of byAccount) {
          const priorEntries = recs.map((r: any) => ({
            receiptNo: String(r.receiptNo || ''),
            paidAmount: r.paidAmount || r.bankAmount || 0,
            date: r.billingAllocationDate || r.dateCaptured || r.bankStatementDate || '',
            status: r.allocationStatus || 'Allocated',
            description: r.bankStatementNote || r.cashbookDescription || r.note || '',
            cashierName: r.cashierName || r.userName || r.capturedBy || r.allocatedBy || '',
            dateCaptured: r.dateCaptured || r.billingAllocationDate || '',
          }));
          const totalPaid = priorEntries.reduce((s: number, p: any) => s + p.paidAmount, 0);
          const latestDate = priorEntries.reduce((best: string, p: any) => (!best || p.date > best) ? p.date : best, '');
          const dateStr = latestDate ? new Date(latestDate).toLocaleDateString('en-GB') : 'unknown';
          const conf = Math.min(95, 80 + (recs.length * 5));
          const rawAccountNo = String(recs[0].accountNumber || recs[0].accountNo || '');
          const idStr = String(accId);
          const padded12 = idStr.padStart(12, '0');
          const accountNo = rawAccountNo && rawAccountNo !== '0' ? rawAccountNo : padded12;

          addResult(
            { account_ID: accId, accountNumber: accountNo, name: '', lastName: '', _bankStatementPrior: priorEntries },
            'history',
            `Previously allocated via EFT (${recs.length}x) — account ${accountNo}`,
            conf,
            [
              `Bank statement search found ${recs.length} prior allocation(s) for this description`,
              `Last allocated: ${dateStr} for R ${totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
              latestDate ? `Receipt: ${priorEntries[0].receiptNo}` : '',
              `This is the same API used on the View Receipts → Bank Statement tab`,
              `High confidence — same bank note was previously processed`,
            ].filter(Boolean),
          );

          const enrichTimeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));
          const enrichCandidates = [padded12];
          if (rawAccountNo && rawAccountNo !== '0' && rawAccountNo !== idStr && rawAccountNo !== padded12) {
            enrichCandidates.unshift(rawAccountNo);
          }
          if (idStr !== padded12) enrichCandidates.push(idStr);
          const enrichAttempt = (async () => {
            for (const accNoTry of enrichCandidates) {
              try {
                const items = await billingEnquirySearch({ accountNo: accNoTry });
                if (items && items.length > 0) return items[0];
              } catch {}
            }
            return null;
          })();
          const enrichedItem = await Promise.race([enrichAttempt, enrichTimeout]);
          if (enrichedItem) {
            const existing = suggestions.find(s => s.accountId === accId);
            if (existing) {
              const enrichName = [enrichedItem.initials, enrichedItem.lastName].filter(Boolean).join(' ') || enrichedItem.name || enrichedItem.companyName || '';
              if (enrichName && (!existing.name || existing.name === '')) existing.name = enrichName;
              if (!existing.address && (enrichedItem.deliveryAddress || enrichedItem.locationAddress)) {
                existing.address = (enrichedItem.deliveryAddress || enrichedItem.locationAddress || '').split(/[\r\n]+/).filter(Boolean)[0] || '';
              }
              if (!existing.erfNumber && enrichedItem.erfNumber) existing.erfNumber = enrichedItem.erfNumber;
              if (!existing.sgNumber && enrichedItem.sgNumber) existing.sgNumber = enrichedItem.sgNumber;
              if (!existing.statusDesc && enrichedItem.statusDesc) existing.statusDesc = enrichedItem.statusDesc;
              if (!existing.typeOfUseDesc && enrichedItem.typeOfUseDesc) existing.typeOfUseDesc = enrichedItem.typeOfUseDesc;
              if (!existing.suburb && (enrichedItem.suburb || enrichedItem.town)) existing.suburb = enrichedItem.suburb || enrichedItem.town;
              existing.matchReasoning = [...(existing.matchReasoning || []), 'Account details verified from billing enquiry'];
            }
          }
        }
      })
    );
  }

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
    if (!clues.oldAccountCodes.includes(accNum)) {
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
    }
  }

  const refTrimmed = (reference || '').trim();
  if (/^\d{3,7}$/.test(refTrimmed) && !clues.accountNumbers.some(a => a === refTrimmed || a.endsWith(refTrimmed))) {
    const paddedRef = refTrimmed.padStart(12, '0');
    searchPromises.push(
      safe(() => billingEnquirySearch({ accountNo: paddedRef })).then((items: any[]) => {
        for (const item of items.slice(0, 3)) {
          const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
          const isMatch = accountNo.endsWith(refTrimmed) || accountNo === paddedRef;
          if (isMatch) {
            addResult({ ...item, account_ID: item.account_ID || item.accountID }, 'account_number',
              `Reference "${refTrimmed}" → account ${accountNo}`,
              92,
              [
                `Reference field contains "${refTrimmed}"`,
                `Zero-padded to "${paddedRef}" and searched as account number`,
                `Direct account number match found`,
                `High confidence — reference is a short account number`,
              ]
            );
          }
        }
      })
    );
    searchPromises.push(
      safe(() => platinumDDAccountAutocomplete(refTrimmed)).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 3)) {
          const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
          if (accountNo.endsWith(refTrimmed)) {
            addResult(item, 'account_number',
              `Reference "${refTrimmed}" → account ${accountNo}`,
              90,
              [
                `Reference field "${refTrimmed}" matched as account number via autocomplete`,
                `Account: ${accountNo}`,
              ]
            );
          }
        }
      })
    );
  }

  const normalizeArea = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
  const checkAreaMatch = (item: any, area: string): boolean => {
    if (!area) return false;
    const normArea = normalizeArea(area);
    const fields = [
      item.allotmentArea, item.town, item.name, item.address,
      item.locationAddress, item.deliveryAddress, item.accountDesc,
    ].filter(Boolean).map((f: string) => normalizeArea(f));
    return fields.some(f => f.includes(normArea));
  };

  const buildErfSearchFormats = (erf: ParsedErf): string[] => {
    const formats: string[] = [];
    if (erf.portion) {
      const portionPadded = erf.portion.padStart(5, '0');
      formats.push(`${erf.erf}/${portionPadded}`);
      formats.push(`${erf.erf}/${erf.portion}`);
    }
    formats.push(erf.erf);
    return [...new Set(formats)];
  };

  const buildSgSearchTerms = (erf: ParsedErf): string[] => {
    const erfPadded = erf.erf.padStart(8, '0');
    const terms: string[] = [erfPadded];
    if (erf.portion) {
      const portionPadded = erf.portion.padStart(5, '0');
      terms.push(`${erfPadded}/${portionPadded}`);
    }
    return terms;
  };

  const timedFetchAccounts = (criteria: any, timeoutMs = 10000): Promise<any[]> =>
    Promise.race([
      fetchAccounts(criteria),
      new Promise<any[]>(resolve => setTimeout(() => resolve([]), timeoutMs)),
    ]);

  for (const erf of clues.erfNumbers.slice(0, 2)) {
    const sgSearchTerms = buildSgSearchTerms(erf);
    const erfLabel = erf.portion ? `ERF ${erf.erf}/${erf.portion}` : `ERF ${erf.erf}`;
    const areaLabel = erf.area ? ` ${erf.area}` : '';

    searchPromises.push(
      safe(() => timedFetchAccounts({ erfNumber: erf.erf })).then((items: any[]) => {
        for (const item of items.slice(0, 10)) {
          const hasAreaMatch = checkAreaMatch(item, erf.area);
          const conf = hasAreaMatch ? 93 : (erf.portion ? 85 : 75);
          addResult(item, 'erf_number',
            `${erfLabel}${areaLabel}${hasAreaMatch ? ' (area confirmed)' : ''}`,
            conf,
            [
              `Parsed "${erfLabel}" from description`,
              `Searched billing enquiry with erfNumber="${erf.erf}"`,
              hasAreaMatch ? `Area "${erf.area}" confirmed in result` : `Area not verified`,
            ]
          );
        }
      })
    );

    searchPromises.push(
      safe(() => platinumSearchAccountsPayment({ erfNumber: erf.erf })).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 10)) {
          const hasAreaMatch = checkAreaMatch(item, erf.area);
          addResult(item, 'erf_number',
            `${erfLabel}${areaLabel} — payment accounts${hasAreaMatch ? ' (area confirmed)' : ''}`,
            hasAreaMatch ? 90 : 73,
            [
              `Parsed "${erfLabel}" from description`,
              `Searched payment accounts with erfNumber="${erf.erf}"`,
              hasAreaMatch ? `Area "${erf.area}" confirmed in result` : `Area not verified`,
            ]
          );
        }
      })
    );

    if (erf.area) {
      searchPromises.push(
        safe(() => timedFetchAccounts({ erfNumber: erf.erf, allotmentArea: erf.area })).then((items: any[]) => {
          for (const item of items.slice(0, 10)) {
            addResult(item, 'erf_number',
              `${erfLabel} in ${erf.area} (area confirmed)`,
              94,
              [
                `Parsed "${erfLabel}" from description`,
                `Searched with erfNumber + allotmentArea="${erf.area}"`,
                `Area filter confirmed match`,
              ]
            );
          }
        })
      );
    }

    const allSgTerms = [...sgSearchTerms];
    if (!allSgTerms.includes(erf.erf)) allSgTerms.push(erf.erf);
    for (const sgTerm of allSgTerms) {
      searchPromises.push(
        safe(() => platinumDDOldAccountAutocomplete(sgTerm)).then((rawData: any) => {
          const items = unwrap(rawData);
          for (const item of items.slice(0, 10)) {
            if (item.displayItem && !item.sgNumber) item.sgNumber = item.displayItem;
            if (item.displayItem && !item.accountNumber) {
              const sgParts = parseSgNumber(item.displayItem);
              if (sgParts.erf) item.erfNumber = sgParts.erf;
              if (sgParts.portion) item.portion = sgParts.portion;
            }
            const hasAreaMatch = checkAreaMatch(item, erf.area);
            addResult(item, 'erf_number',
              `${erfLabel}${areaLabel} — SG code match${hasAreaMatch ? ' (area confirmed)' : ''}`,
              hasAreaMatch ? 95 : 90,
              [
                `Parsed "${erfLabel}" from description`,
                `Searched old account autocomplete with "${sgTerm}"`,
                item.displayItem ? `SG code: ${item.displayItem}` : `Matches SG code containing this ERF`,
                hasAreaMatch ? `Area confirmed` : `Verify area`,
              ]
            );
          }
        })
      );
    }

    searchPromises.push(
      safe(() => billingAutocomplete(erf.erf.padStart(8, '0'), 'erfNumber')).then((items: any[]) => {
        for (const item of items.slice(0, 10)) {
          if (item.displayItem && !item.sgNumber) item.sgNumber = item.displayItem;
          if (item.displayItem) {
            const sgParts = parseSgNumber(item.displayItem);
            if (sgParts.erf) item.erfNumber = sgParts.erf;
            if (sgParts.portion) item.portion = sgParts.portion;
          }
          const hasAreaMatch = checkAreaMatch(item, erf.area);
          addResult(item, 'erf_number',
            `${erfLabel}${areaLabel} — ERF autocomplete${hasAreaMatch ? ' (area confirmed)' : ''}`,
            hasAreaMatch ? 93 : 88,
            [
              `Parsed "${erfLabel}" from description`,
              `Searched billing enquiry ERF autocomplete`,
              item.displayItem ? `SG code: ${item.displayItem}` : `ERF matched`,
              hasAreaMatch ? `Area confirmed` : `Verify area`,
            ]
          );
        }
      })
    );

    searchPromises.push(
      safe(() => platinumDDAccountAutocomplete(erf.erf.padStart(8, '0'))).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 10)) {
          if (item.displayItem && !item.sgNumber) item.sgNumber = item.displayItem;
          const hasAreaMatch = checkAreaMatch(item, erf.area);
          addResult(item, 'erf_number',
            `${erfLabel}${areaLabel} — DD autocomplete${hasAreaMatch ? ' (area confirmed)' : ''}`,
            hasAreaMatch ? 92 : 87,
            [
              `Parsed "${erfLabel}" from description`,
              `Searched DD account autocomplete with padded ERF`,
              hasAreaMatch ? `Area confirmed` : `Verify area`,
            ]
          );
        }
      })
    );
  }

  const tokenMatchesWord = (tokens: string[], word: string): boolean => {
    const w = word.toUpperCase();
    return tokens.some(t => t === w);
  };
  const tokenize = (str: string): string[] =>
    str.toUpperCase().split(/[\s,&.]+/).map(t => t.replace(/[^A-Z'-]/g, '')).filter(t => t.length >= 2);

  for (const nameTerm of clues.nameSearchTerms.slice(0, 3)) {
    searchPromises.push(
      safe(() => platinumSearchAccountsPayment({ name: nameTerm })).then((rawData: any) => {
        const items = unwrap(rawData);
        for (const item of items.slice(0, 5)) {
          const itemName = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || '';
          const nameTokens = tokenize(itemName);
          const searchWords = nameTerm.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
          let nameMatchScore = 0;
          let matchedParts: string[] = [];
          for (const word of searchWords) {
            if (tokenMatchesWord(nameTokens, word)) {
              nameMatchScore += word.length >= 4 ? 15 : 8;
              matchedParts.push(word);
            }
          }
          const surnameFromSearch = searchWords[searchWords.length - 1] || '';
          const surnameExact = surnameFromSearch.length >= 3 &&
            (item.lastName || '').toUpperCase() === surnameFromSearch;
          if (surnameExact) nameMatchScore += 20;
          const confidence = Math.min(85, 45 + nameMatchScore);
          if (matchedParts.length > 0) {
            addResult(item, 'name',
              `Name match: "${nameTerm}" → ${matchedParts.join(', ')}`,
              confidence,
              [
                `Description "${nameTerm}" appears to be a person's name`,
                `Searched consumer accounts by name`,
                surnameExact ? `Surname "${surnameFromSearch}" matches exactly` : `Partial name match on: ${matchedParts.join(', ')}`,
                matchedParts.length >= 2 ? `Multiple name parts matched — higher confidence` : `Single name component matched — verify carefully`,
                `Account holder: "${itemName}"`,
              ]
            );
          }
        }
      })
    );
    searchPromises.push(
      safe(() => billingEnquirySearch({ name: nameTerm })).then((items: any[]) => {
        for (const item of items.slice(0, 5)) {
          const lastName = item.surname_Company || item.lastName || '';
          const itemName = item.name || [item.initials, lastName].filter(Boolean).join(' ') || '';
          const nameTokens = tokenize(itemName);
          const searchWords = nameTerm.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
          let nameMatchScore = 0;
          let matchedParts: string[] = [];
          for (const word of searchWords) {
            if (tokenMatchesWord(nameTokens, word)) {
              nameMatchScore += word.length >= 4 ? 15 : 8;
              matchedParts.push(word);
            }
          }
          const surnameFromSearch = searchWords[searchWords.length - 1] || '';
          const surnameExact = surnameFromSearch.length >= 3 && lastName.toUpperCase() === surnameFromSearch;
          if (surnameExact) nameMatchScore += 20;
          const confidence = Math.min(85, 45 + nameMatchScore);
          if (matchedParts.length > 0) {
            addResult({ ...item, account_ID: item.account_ID || item.accountID, lastName }, 'name',
              `Name match: "${nameTerm}" → ${matchedParts.join(', ')}`,
              confidence,
              [
                `Description "${nameTerm}" appears to be a name or company`,
                `Searched via billing enquiry`,
                surnameExact ? `Surname "${surnameFromSearch}" matches exactly` : `Partial name match on: ${matchedParts.join(', ')}`,
                matchedParts.length >= 2 ? `Multiple name parts matched — higher confidence` : `Single name component matched — verify carefully`,
                `Account holder: "${itemName}"`,
              ]
            );
          }
        }
      })
    );
    searchPromises.push(
      safe(() => billingAutocomplete(nameTerm, 'nameCompany')).then((suggestions: any[]) => {
        const validSugs = (suggestions || []).filter((s: any) => s.accountId && s.accountId > 0);
        for (const sug of validSugs.slice(0, 5)) {
          const display = sug.displayItem || '';
          const acNoMatch = display.match(/^(\d{6,15})\s+/);
          const accountNo = acNoMatch ? acNoMatch[1] : '';
          const displayName = acNoMatch ? display.substring(acNoMatch[0].length).trim() : display;
          const displayTokens = tokenize(displayName);
          const searchWords = nameTerm.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
          let matchedParts: string[] = [];
          for (const word of searchWords) {
            if (tokenMatchesWord(displayTokens, word)) matchedParts.push(word);
          }
          if (matchedParts.length > 0 || validSugs.length <= 3) {
            const conf = Math.min(82, 50 + (matchedParts.length * 12));
            addResult(
              { account_ID: sug.accountId, accountNo, name: displayName || display, lastName: '' },
              'name',
              `Name/company match: "${nameTerm}" → "${displayName || display}"`,
              conf,
              [
                `Description "${nameTerm}" searched via billing autocomplete (nameCompany)`,
                `API returned: "${display}"`,
                matchedParts.length > 0 ? `Matched parts: ${matchedParts.join(', ')}` : `Direct API match — verify account details`,
              ]
            );
          }
        }
      })
    );
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

  const erfAreaWords = new Set(
    clues.erfNumbers.map(e => (e.area || '').toLowerCase().trim()).filter(Boolean)
  );
  const groupMatchSkipWords = new Set([
    ...erfAreaWords,
    ...Array.from(GENERIC_WORDS),
    'erf', 'erven', 'portion', 'ptn', 'lot', 'stand', 'plot', 'rem',
  ].map(w => w.toLowerCase()));

  searchPromises.push(
    safe(async () => {
      const groups = await loadMiscGroupsCache();
      if (groups.length === 0) return;
      const combinedText = `${note || ''} ${reference || ''}`.toLowerCase();
      const words = combinedText.split(/[\s,&.\-\/]+/).filter(w => w.length >= 3 && !groupMatchSkipWords.has(w));
      if (words.length === 0) return;
      for (const group of groups) {
        const groupName = group.name.toLowerCase();
        const groupWords = groupName.split(/[\s,&.\-\/]+/).filter(w => w.length >= 3 && !groupMatchSkipWords.has(w));
        let matchScore = 0;
        const matchedWords: string[] = [];
        for (const gw of groupWords) {
          if (words.some(w => w.includes(gw) || gw.includes(w))) {
            matchScore += gw.length >= 5 ? 20 : 10;
            matchedWords.push(gw);
          }
        }
        if (matchedWords.length > 0) {
          const conf = Math.min(75, 35 + matchScore);
          const groupKey = `MISC-${group.id}`;
          suggestions.push({
            accountId: -group.id,
            accountNo: groupKey,
            name: group.name,
            matchType: 'direct_income',
            matchDetail: `Direct Income: "${group.name}" (matched: ${matchedWords.join(', ')})`,
            confidence: conf,
            matchReasoning: [
              `Description keywords matched Miscellaneous Payment Group: "${group.name}"`,
              `Matched words: ${matchedWords.join(', ')}`,
              `This is a Direct Income (non-consumer) allocation`,
              `Click to allocate as Direct Income with full SCOA item selection`,
            ],
            miscPaymentGroupId: group.id,
            miscPaymentGroupName: group.name,
            matchSources: ['Direct Income'],
          });
        }
      }
    })
  );

  searchPromises.push(
    safe(async () => {
      const institutions = await loadInstitutionsCache();
      if (institutions.length === 0) return;
      const combinedText = `${note || ''} ${reference || ''}`.toLowerCase();
      const words = combinedText.split(/[\s,&.\-\/]+/).filter(w => w.length >= 3 && !groupMatchSkipWords.has(w));
      if (words.length === 0) return;
      for (const inst of institutions) {
        const instName = inst.name.toLowerCase();
        const instWords = instName.split(/[\s,&.\-\/]+/).filter(w => w.length >= 3 && !groupMatchSkipWords.has(w));
        let matchScore = 0;
        const matchedWords: string[] = [];
        for (const iw of instWords) {
          if (words.some(w => w.includes(iw) || iw.includes(w))) {
            matchScore += iw.length >= 5 ? 20 : 10;
            matchedWords.push(iw);
          }
        }
        if (matchedWords.length > 0 && matchScore >= 10) {
          const conf = Math.min(75, 35 + matchScore);
          suggestions.push({
            accountId: -(100000 + inst.id),
            accountNo: `INST-${inst.id}`,
            name: inst.name,
            matchType: 'institution',
            matchDetail: `Institution/Payment Group: "${inst.name}" (matched: ${matchedWords.join(', ')})`,
            confidence: conf,
            matchReasoning: [
              `Description keywords matched Institution/Payment Group: "${inst.name}"`,
              `Matched words: ${matchedWords.join(', ')}`,
              `Click to allocate as Institution/Group payment`,
            ],
            institutionId: inst.id,
            institutionName: inst.name,
            matchSources: ['Institution/Group'],
          });
        }
      }
    })
  );

  searchPromises.push(
    safe(async () => {
      const combinedText = `${note || ''} ${reference || ''}`.toUpperCase();
      const clrIdPatterns = combinedText.match(/\b(?:CLR|CLEAR|CLEARANCE)[\s\-_:]*(\d{3,10})\b/gi) || [];
      const csIdPatterns = combinedText.match(/\b(?:CS|COST\s*SCHED(?:ULE)?|SCHEDULE)[\s\-_:]*(\d{3,10})\b/gi) || [];
      const allNumericIds: string[] = [];
      for (const p of [...clrIdPatterns, ...csIdPatterns]) {
        const m = p.match(/(\d{3,10})/);
        if (m) allNumericIds.push(m[1]);
      }

      const clearanceSearchTerms: string[] = [];
      for (const id of allNumericIds) clearanceSearchTerms.push(id);
      const clueAccNums = clues.accountNumbers || [];
      for (const acc of clueAccNums.slice(0, 2)) clearanceSearchTerms.push(acc);
      if (clues.erfNumbers?.length) {
        for (const e of clues.erfNumbers.slice(0, 2)) {
          const erfStr = typeof e === 'string' ? e : e.erf;
          if (erfStr) clearanceSearchTerms.push(erfStr);
        }
      }

      if (clearanceSearchTerms.length === 0) return;

      const uniqueTerms = [...new Set(clearanceSearchTerms)].slice(0, 4);
      const clearanceResults: any[] = [];

      await Promise.allSettled(
        uniqueTerms.map(term =>
          safe(() => platinumDDClearanceAutocomplete(term)).then((rawData: any) => {
            const items = Array.isArray(rawData) ? rawData : [];
            clearanceResults.push(...items.slice(0, 5));
          })
        )
      );

      if (clearanceResults.length === 0) return;

      const seenClr = new Set<string>();
      for (const clrItem of clearanceResults) {
        const clrId = clrItem.clearanceId || clrItem.clearance_ID || clrItem.clearanceFormattedId || clrItem.costSchedule_ID || clrItem.costScheduleID || '';
        const clrKey = String(clrId);
        if (!clrKey || seenClr.has(clrKey)) continue;
        seenClr.add(clrKey);

        let clearanceData: any = null;
        try {
          clearanceData = await platinumGetClearanceData(clrKey);
        } catch {}

        if (!clearanceData) continue;
        const items = clearanceData.items || (Array.isArray(clearanceData) ? clearanceData : [clearanceData]);
        const firstItem = items[0];
        if (!firstItem) continue;

        const totalDue = firstItem.totalDue ?? firstItem.total ?? firstItem.totalAmount ?? 0;
        const paid = firstItem.paid ?? firstItem.paidAmount ?? 0;
        const remaining = totalDue - paid;
        const status = (firstItem.status || firstItem.statusDesc || '').toUpperCase();
        const sgNumber = firstItem.sgNumber || firstItem.sg_Number || '';
        const accountName = firstItem.accountName || firstItem.name || '';
        const locationAddress = firstItem.locationAddress || firstItem.address || '';
        const costScheduleID = firstItem.costScheduleID || firstItem.costSchedule_ID || firstItem.id || 0;

        const isApproved = status.includes('APPROV') || status.includes('ACTIVE') || status.includes('ISSUED') || status === '';

        let confidence = 50;
        const reasoning: string[] = [`Clearance ID: ${clrKey}`, `Status: ${status || 'Unknown'}`];

        if (isApproved) {
          confidence += 10;
          reasoning.push('Cost schedule is in approved/active status');
        }

        if (transactionAmount && remaining > 0) {
          const amtDiff = Math.abs(transactionAmount - remaining);
          const amtPct = remaining > 0 ? amtDiff / remaining : 1;
          if (amtPct < 0.01) {
            confidence += 30;
            reasoning.push(`Transaction amount R ${transactionAmount.toFixed(2)} matches remaining R ${remaining.toFixed(2)} exactly`);
          } else if (amtPct < 0.05) {
            confidence += 20;
            reasoning.push(`Transaction amount R ${transactionAmount.toFixed(2)} close to remaining R ${remaining.toFixed(2)} (${(amtPct * 100).toFixed(1)}% diff)`);
          } else if (transactionAmount <= remaining) {
            confidence += 10;
            reasoning.push(`Transaction amount R ${transactionAmount.toFixed(2)} is partial payment of remaining R ${remaining.toFixed(2)}`);
          }
        }

        if (allNumericIds.some(id => clrKey.includes(id) || id.includes(clrKey.replace(/^0+/, '')))) {
          confidence += 15;
          reasoning.push('Clearance/schedule ID found in description');
        }

        const conf = Math.min(95, confidence);
        const displayId = clrKey.replace(/^0+/, '') || clrKey;
        const uniqueAccId = -(200000 + (Number(costScheduleID) || Math.abs(clrKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0))));

        suggestions.push({
          accountId: uniqueAccId,
          accountNo: `CLR-${displayId}`,
          name: accountName || `Clearance ${displayId}`,
          matchType: 'clearance',
          matchDetail: `Clearance ${displayId}: ${accountName || 'N/A'} — Due R ${(remaining ?? totalDue).toFixed(2)}`,
          confidence: conf,
          matchReasoning: reasoning,
          outstandingAmount: remaining ?? totalDue,
          address: locationAddress,
          sgNumber: sgNumber || undefined,
          clearanceId: clrKey,
          costScheduleId: Number(costScheduleID) || 0,
          clearanceTotalDue: totalDue,
          clearanceStatus: status,
          clearanceSgNumber: sgNumber,
          clearanceAccountName: accountName,
          matchSources: ['Clearance'],
        });
      }
    })
  );

  const ensureStrArr = (v: any): string[] =>
    Array.isArray(v) ? v.filter((x: any) => typeof x === 'string' && x.trim()) : [];
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-\/]+/g, '');
  const normNum = (s: string) => s.replace(/^0+/, '') || '0';
  const regexAccNorm = new Set(clues.accountNumbers.map(norm));
  const regexErfNorm = new Set(clues.erfNumbers.map((e: any) => normNum(typeof e === 'string' ? e : e.erf)));
  const regexOldNorm = new Set(clues.oldAccountCodes.map(norm));
  const regexNameNorm = new Set((clues.nameSearchTerms || []).map((n: string) => n.toLowerCase().trim()));
  const aiSearchedIds = new Set<string>();

  searchPromises.push(
    safe(async () => {
      const aiAbort = new AbortController();
      const aiTimeout = setTimeout(() => aiAbort.abort(), 8000);
      const aiResp = await fetch('/api/ai/parse-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: note, reference }),
        signal: aiAbort.signal,
      }).finally(() => clearTimeout(aiTimeout));
      if (!aiResp.ok) return;
      const ai = await aiResp.json();
      console.log('[AI Parse]', note, ai);

      const aiSearches: Promise<void>[] = [];
      const aiAreas = ensureStrArr(ai.areaKeywords);
      const aiAreaCheck = (item: any): boolean => {
        if (aiAreas.length === 0) return false;
        const normArea = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
        const fields = [
          item.allotmentArea, item.town, item.name, item.address,
          item.locationAddress, item.deliveryAddress, item.accountDesc,
        ].filter(Boolean).map((f: string) => normArea(f));
        return aiAreas.some(a => fields.some(f => f.includes(normArea(a))));
      };

      for (const accNum of ensureStrArr(ai.accountNumbers).slice(0, 3)) {
        const n = norm(accNum);
        if (regexAccNorm.has(n) || aiSearchedIds.has(`acc:${n}`)) continue;
        aiSearchedIds.add(`acc:${n}`);
        aiSearches.push(
          safe(() => platinumDDAccountAutocomplete(accNum)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
              const exactMatch = accountNo === accNum || accountNo.endsWith(accNum) || accNum.endsWith(accountNo);
              addResult(item, 'account_number',
                `AI: Account ${exactMatch ? 'match' : 'ref'}: "${accNum}"`,
                exactMatch ? 88 : 70,
                [`AI identified "${accNum}" as account number`, exactMatch ? `Exact match` : `Partial match (${accountNo})`, `Searched DD autocomplete`]
              );
            }
          })
        );
        aiSearches.push(
          safe(() => platinumSearchAccountsPayment({ accountNo: accNum })).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
              const exactMatch = accountNo.includes(accNum) || String(item.account_ID).includes(accNum);
              addResult(item, 'account_number',
                `AI: Account "${accNum}" (payment search)`,
                exactMatch ? 85 : 60,
                [`AI identified "${accNum}" as account number`, `Searched via billing payment search`]
              );
            }
          })
        );
        if (!regexOldNorm.has(n)) {
          aiSearches.push(
            safe(() => platinumDDOldAccountAutocomplete(accNum)).then((rawData: any) => {
              const items = unwrap(rawData);
              for (const item of items.slice(0, 2)) {
                addResult(item, 'old_account',
                  `AI: Account "${accNum}" as old code`,
                  75,
                  [`AI identified "${accNum}" as account number`, `Also searched as old account code (dual-path)`]
                );
              }
            })
          );
        }
      }

      for (const mtr of ensureStrArr(ai.meterNumbers).slice(0, 3)) {
        const regexMtrNorm = new Set(clues.meterNumbers.map(norm));
        if (regexMtrNorm.has(norm(mtr)) || aiSearchedIds.has(`mtr:${norm(mtr)}`)) continue;
        aiSearchedIds.add(`mtr:${norm(mtr)}`);
        aiSearches.push(
          safe(() => platinumDDAccountAutocomplete(mtr)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              const meterStr = String(item.meterNumber || item.physicalMeterNumber || '');
              const exactMeterMatch = meterStr.includes(mtr);
              addResult(item, 'meter_number',
                `AI: Meter ${exactMeterMatch ? 'match' : 'ref'}: "${mtr}"`,
                exactMeterMatch ? 92 : 75,
                [`AI identified "${mtr}" as meter number`, exactMeterMatch ? `Exact meter match in Platinum` : `Partial meter reference`, `Searched via DD autocomplete`]
              );
            }
          })
        );
        aiSearches.push(
          safe(() => fetchAccounts({ physicalMeterNumber: mtr })).then((items: any[]) => {
            for (const item of items.slice(0, 3)) {
              addResult(item, 'meter_number',
                `AI: Meter match: "${mtr}"`,
                90,
                [`AI identified "${mtr}" as meter number`, `Exact physical meter match in billing system`, `Searched via billing enquiry meter search`]
              );
            }
          })
        );
      }

      for (const erfNum of ensureStrArr(ai.erfNumbers).slice(0, 3)) {
        const n = normNum(erfNum);
        if (regexErfNorm.has(n) || aiSearchedIds.has(`erf:${n}`)) continue;
        aiSearchedIds.add(`erf:${n}`);
        aiSearches.push(
          safe(() => timedFetchAccounts({ erfNumber: erfNum })).then((items: any[]) => {
            for (const item of items.slice(0, 10)) {
              const hasAreaMatch = aiAreaCheck(item);
              addResult(item, 'erf_number', `AI: ERF ${erfNum}${hasAreaMatch ? ' (area confirmed)' : ''}`,
                hasAreaMatch ? 93 : 85,
                [`AI identified "${erfNum}" as ERF number`, `Searched billing enquiry`, hasAreaMatch ? `Area confirmed from AI context` : `Area not verified`]);
            }
          })
        );
        if (aiAreas.length > 0) {
          for (const area of aiAreas.slice(0, 2)) {
            aiSearches.push(
              safe(() => timedFetchAccounts({ erfNumber: erfNum, allotmentArea: area })).then((items: any[]) => {
                for (const item of items.slice(0, 10)) {
                  addResult(item, 'erf_number', `AI: ERF ${erfNum} in ${area} (area confirmed)`, 94,
                    [`AI identified "${erfNum}" as ERF number + "${area}" as area`, `Searched with erfNumber + allotmentArea filter`]);
                }
              })
            );
          }
        }
        const erfPadded = erfNum.padStart(8, '0');
        aiSearches.push(
          safe(() => platinumDDOldAccountAutocomplete(erfPadded)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 10)) {
              const hasAreaMatch = aiAreaCheck(item);
              addResult(item, 'erf_number', `AI: ERF ${erfNum} (SG code)${hasAreaMatch ? ' area confirmed' : ''}`,
                hasAreaMatch ? 95 : 90,
                [`AI identified "${erfNum}" as ERF number`, `Searched as padded SG code "${erfPadded}"`, `Matches any municipality SG code containing this ERF`]);
            }
          })
        );
        if (erfNum.length >= 3) {
          aiSearches.push(
            safe(() => platinumDDOldAccountAutocomplete(erfNum)).then((rawData: any) => {
              const items = unwrap(rawData);
              for (const item of items.slice(0, 3)) {
                addResult(item, 'erf_number', `AI: ERF ${erfNum} as old code`, 78,
                  [`AI identified "${erfNum}" as ERF number`, `Also searched as old account code (dual-path)`]);
              }
            })
          );
        }
      }

      for (const oldCode of ensureStrArr(ai.oldAccountCodes).slice(0, 3)) {
        const n = norm(oldCode);
        if (regexOldNorm.has(n) || aiSearchedIds.has(`old:${n}`)) continue;
        aiSearchedIds.add(`old:${n}`);
        aiSearches.push(
          safe(() => platinumDDOldAccountAutocomplete(oldCode)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              addResult(item, 'old_account', `AI: Old code "${oldCode}"`, 80,
                [`AI identified "${oldCode}" as old account code`, `Searched DD old account autocomplete`]);
            }
          })
        );
        aiSearches.push(
          safe(() => platinumDDAccountAutocomplete(oldCode)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 2)) {
              addResult(item, 'old_account', `AI: Old code "${oldCode}" (DD search)`, 75,
                [`AI identified "${oldCode}" as old account code`, `Also searched via DD autocomplete`]);
            }
          })
        );
      }

      const aiTokenize = (str: string): string[] =>
        str.toUpperCase().split(/[\s,&.]+/).map(t => t.replace(/[^A-Z'-]/g, '')).filter(t => t.length >= 2);
      const aiTokenMatch = (tokens: string[], word: string): boolean =>
        tokens.some(t => t === word.toUpperCase());

      for (const name of ensureStrArr(ai.names).slice(0, 3)) {
        if (regexNameNorm.has(name.toLowerCase().trim()) || aiSearchedIds.has(`name:${name.toLowerCase()}`)) continue;
        aiSearchedIds.add(`name:${name.toLowerCase()}`);
        aiSearches.push(
          safe(() => platinumSearchAccountsPayment({ name })).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 5)) {
              const itemName = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || '';
              const nameTokens = aiTokenize(itemName);
              const searchWords = name.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
              let score = 0;
              const matched: string[] = [];
              for (const word of searchWords) {
                if (aiTokenMatch(nameTokens, word)) { score += word.length >= 4 ? 15 : 8; matched.push(word); }
              }
              const surname = searchWords[searchWords.length - 1] || '';
              if (surname.length >= 3 && (item.lastName || '').toUpperCase() === surname) score += 20;
              const conf = Math.min(85, 45 + score);
              if (matched.length > 0) {
                addResult(item, 'name', `AI: Name "${name}" → ${matched.join(', ')}`, conf,
                  [`AI identified "${name}" as person/company name`, `Searched payment accounts`, matched.length >= 2 ? `Multiple name parts matched` : `Single name part matched`, `Account holder: "${itemName}"`]);
              }
            }
          })
        );
        aiSearches.push(
          safe(() => billingEnquirySearch({ name })).then((items: any[]) => {
            for (const item of items.slice(0, 5)) {
              const lastName = item.surname_Company || item.lastName || '';
              const itemName = item.name || [item.initials, lastName].filter(Boolean).join(' ') || '';
              const nameTokens = aiTokenize(itemName);
              const searchWords = name.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
              let score = 0;
              const matched: string[] = [];
              for (const word of searchWords) {
                if (aiTokenMatch(nameTokens, word)) { score += word.length >= 4 ? 15 : 8; matched.push(word); }
              }
              const surname = searchWords[searchWords.length - 1] || '';
              if (surname.length >= 3 && lastName.toUpperCase() === surname) score += 20;
              const conf = Math.min(85, 45 + score);
              if (matched.length > 0) {
                addResult({ ...item, account_ID: item.account_ID || item.accountID, lastName }, 'name',
                  `AI: Name "${name}" → ${matched.join(', ')} (billing)`, conf,
                  [`AI identified "${name}" as name/company`, `Searched via billing enquiry`, matched.length >= 2 ? `Multiple name parts matched` : `Single name part matched`]);
              }
            }
          })
        );
        aiSearches.push(
          safe(() => billingAutocomplete(name, 'nameCompany')).then((suggestions: any[]) => {
            const validSugs = (suggestions || []).filter((s: any) => s.accountId && s.accountId > 0);
            for (const sug of validSugs.slice(0, 5)) {
              const display = sug.displayItem || '';
              const acNoMatch = display.match(/^(\d{6,15})\s+/);
              const accountNo = acNoMatch ? acNoMatch[1] : '';
              const displayName = acNoMatch ? display.substring(acNoMatch[0].length).trim() : display;
              const displayTokens = aiTokenize(displayName);
              const searchWords = name.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
              const matched: string[] = [];
              for (const word of searchWords) {
                if (aiTokenMatch(displayTokens, word)) matched.push(word);
              }
              if (matched.length > 0 || validSugs.length <= 3) {
                const conf = Math.min(82, 50 + (matched.length * 12));
                addResult(
                  { account_ID: sug.accountId, accountNo, name: displayName || display, lastName: '' },
                  'name', `AI: Name "${name}" → "${displayName || display}" (autocomplete)`, conf,
                  [`AI identified "${name}" as name/company`, `Searched billing autocomplete (nameCompany)`, matched.length > 0 ? `Matched: ${matched.join(', ')}` : `Direct API match`]);
              }
            }
          })
        );
        aiSearches.push(
          safe(() => platinumDDAccountAutocomplete(name)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              const itemName = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || '';
              const nameTokens = aiTokenize(itemName);
              const searchWords = name.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
              let score = 0;
              const matched: string[] = [];
              for (const word of searchWords) {
                if (aiTokenMatch(nameTokens, word)) { score += word.length >= 4 ? 15 : 8; matched.push(word); }
              }
              const surname = searchWords[searchWords.length - 1] || '';
              if (surname.length >= 3 && (item.lastName || '').toUpperCase() === surname) score += 20;
              const conf = Math.min(85, 45 + score);
              if (matched.length > 0) {
                addResult(item, 'name', `AI: Name "${name}" → ${matched.join(', ')} (DD autocomplete)`,
                  conf,
                  [`AI identified "${name}" as name/company`, `Searched DD autocomplete`, `Matched: ${matched.join(', ')}`,
                   surname.length >= 3 && (item.lastName || '').toUpperCase() === surname ? `Surname "${surname}" matches exactly` : ''
                  ].filter(Boolean));
              }
            }
          })
        );
      }

      for (const refNum of ensureStrArr(ai.referenceNumbers).slice(0, 3)) {
        const n = norm(refNum);
        if (regexAccNorm.has(n) || regexOldNorm.has(n) || aiSearchedIds.has(`ref:${n}`)) continue;
        aiSearchedIds.add(`ref:${n}`);
        aiSearches.push(
          safe(() => platinumDDAccountAutocomplete(refNum)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              addResult(item, 'reference', `AI: Ref "${refNum}"`, 70,
                [`AI identified "${refNum}" as reference number`, `Searched DD autocomplete`]);
            }
          })
        );
        aiSearches.push(
          safe(() => platinumDDOldAccountAutocomplete(refNum)).then((rawData: any) => {
            const items = unwrap(rawData);
            for (const item of items.slice(0, 3)) {
              addResult(item, 'reference', `AI: Ref "${refNum}" (old code)`, 70,
                [`AI identified "${refNum}" as reference number`, `Searched old account autocomplete`]);
            }
          })
        );
        if (/^\d{3,7}$/.test(refNum)) {
          const paddedRef = refNum.padStart(12, '0');
          aiSearches.push(
            safe(() => billingEnquirySearch({ accountNo: paddedRef })).then((items: any[]) => {
              for (const item of items.slice(0, 3)) {
                const accountNo = item.accountNumber || item.accountNo || String(item.account_ID || '');
                if (accountNo.endsWith(refNum) || accountNo === paddedRef) {
                  addResult({ ...item, account_ID: item.account_ID || item.accountID }, 'reference',
                    `AI: Ref "${refNum}" → account ${accountNo}`, 88,
                    [`AI identified "${refNum}" as reference`, `Zero-padded to "${paddedRef}" and matched as account number`]);
                }
              }
            })
          );
        }
      }

      await Promise.all(aiSearches);
    })
  );

  await Promise.race([
    Promise.all(searchPromises),
    new Promise(resolve => setTimeout(resolve, 15000)),
  ]);

  const top = suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);

  const extractBal = (obj: any): number => {
    const v = obj?.totalOutStanding ?? obj?.totalOutstanding ?? obj?.totalBalance ?? obj?.outStandingAmt ?? obj?.outstandingAmount ?? obj?.balance;
    return v != null ? (parseFloat(v) || 0) : 0;
  };
  const specialTypes = new Set(['direct_income', 'institution', 'clearance']);
  const needsBalance = top.filter(s => !specialTypes.has(s.matchType) && (s.outstandingAmount === 0 || s.outstandingAmount == null));
  if (needsBalance.length > 0) {
    await Promise.allSettled(
      needsBalance.map(s =>
        getAccountBalance(s.accountId).then((bal: any) => {
          if (Array.isArray(bal)) {
            s.outstandingAmount = Math.round(bal.reduce((sum: number, svc: any) => sum + extractBal(svc), 0) * 100) / 100;
          } else if (bal && typeof bal === 'object') {
            s.outstandingAmount = extractBal(bal);
          } else if (typeof bal === 'number') {
            s.outstandingAmount = bal;
          }
        }).catch(() => {})
      )
    );
  }

  return top;
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
  const [pageSize, setPageSize] = useState(25);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
  const [showHelp, setShowHelp] = useState(false);

  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();

  const [suggestions, setSuggestions] = useState<Record<number, SuggestedMatch[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<number>>(new Set());

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [quickAllocItem, setQuickAllocItem] = useState<{ tx: BankReconPosItem; match: SuggestedMatch } | null>(null);
  const [quickAllocRunning, setQuickAllocRunning] = useState(false);
  const [quickAllocStatus, setQuickAllocStatus] = useState('');
  const [autoMatchRunning, setAutoMatchRunning] = useState(false);
  const [autoMatchProgress, setAutoMatchProgress] = useState({ done: 0, total: 0 });
  const autoMatchAbort = useRef(false);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const [autoMatchQueued, setAutoMatchQueued] = useState<Set<number>>(new Set());
  const [autoMatchOrder, setAutoMatchOrder] = useState<Map<number, number>>(new Map());
  const autoMatchTotalRef = useRef(0);
  const [autoMatchEta, setAutoMatchEta] = useState<number | null>(null);

  const cancelAutoMatch = useCallback(() => {
    if (autoMatchRunning) {
      autoMatchAbort.current = true;
    }
    setAutoMatchRunning(false);
    setAutoMatchProgress({ done: 0, total: 0 });
    setAutoMatchQueued(new Set());
    setAutoMatchOrder(new Map());
    setAutoMatchEta(null);
    autoMatchTotalRef.current = 0;
    setLoadingSuggestions(new Set());
    setSuggestions({});
    setSelectedIds(new Set());
  }, [autoMatchRunning]);

  const [allocateDialogPosItemId, setAllocateDialogPosItemId] = useState<number | null>(null);
  const [allocateDialogKey, setAllocateDialogKey] = useState(0);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchTerm, txnDateFrom, txnDateTo]);

  const allItemsCacheRef = useRef<BankReconPosItem[] | null>(null);
  const allItemsLoadingRef = useRef(false);

  const loadData = useCallback(async (pageNum: number, ps?: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await platinumGetBankReconPosItemList({
        page: pageNum,
        pageSize: ps ?? pageSize,
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
  }, [pageSize]);

  const loadAllForSearch = useCallback(async () => {
    if (allItemsCacheRef.current || allItemsLoadingRef.current) return;
    allItemsLoadingRef.current = true;
    setLoading(true);
    try {
      const allItems: BankReconPosItem[] = [];
      const firstResult = await platinumGetBankReconPosItemList({
        page: 1,
        pageSize: 200,
        orderby: 'dateOfTransaction',
        shortDirection: 'desc',
      });
      const firstData = firstResult as any;
      const firstBatch: BankReconPosItem[] = Array.isArray(firstData?.items) ? firstData.items : Array.isArray(firstData) ? firstData : [];
      allItems.push(...firstBatch);
      const total = firstData?.totalCount ?? firstBatch.length;

      if (total > 200) {
        const remainingPages = Math.ceil((total - 200) / 200);
        const pagePromises = [];
        for (let p = 2; p <= remainingPages + 1; p++) {
          pagePromises.push(
            platinumGetBankReconPosItemList({
              page: p,
              pageSize: 200,
              orderby: 'dateOfTransaction',
              shortDirection: 'desc',
            }).catch(() => ({ items: [] }))
          );
        }
        const results = await Promise.all(pagePromises);
        for (const r of results) {
          const d = r as any;
          const batch: BankReconPosItem[] = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
          allItems.push(...batch);
        }
      }
      allItemsCacheRef.current = allItems;
    } catch (e: any) {
      console.error("Failed to load all items for search", e);
    } finally {
      allItemsLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(page);
  }, [page, pageSize, loadData]);

  const changePage = useCallback((newPage: number | ((prev: number) => number)) => {
    cancelAutoMatch();
    setPage(newPage);
  }, [cancelAutoMatch]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    const firstItemIndex = (page - 1) * pageSize;
    const newPage = Math.max(1, Math.floor(firstItemIndex / newSize) + 1);
    cancelAutoMatch();
    setPageSize(newSize);
    setPage(newPage);
  }, [page, pageSize, cancelAutoMatch]);

  useEffect(() => {
    if (searchTerm.trim().length >= 2 && !allItemsCacheRef.current) {
      loadAllForSearch();
    }
  }, [searchTerm, loadAllForSearch]);

  const sourceItems = searchTerm.trim().length >= 2 && allItemsCacheRef.current
    ? allItemsCacheRef.current
    : items;

  const filtered = sourceItems.filter(item => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (item.note || '').toLowerCase().includes(term) ||
        (item.reference || '').toLowerCase().includes(term) ||
        item.amount.toString().includes(searchTerm) ||
        item.posItem_ID.toString().includes(searchTerm) ||
        ((item as any).dateOfTransaction || '').toLowerCase().includes(term);
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
  const specialMatchTypes = new Set(['direct_income', 'institution', 'clearance']);
  const selectedWithMatch = selectedItems.filter(i => {
    const s = suggestions[i.posItem_ID];
    return s && s.length > 0 && s[0].confidence >= 55 && !specialMatchTypes.has(s[0].matchType);
  });

  const selectedMatchQuality = useMemo(() => {
    let high = 0, medium = 0, low = 0, none = 0, unanalyzed = 0;
    for (const item of selectedItems) {
      const s = suggestions[item.posItem_ID];
      if (!s) { unanalyzed++; continue; }
      if (s.length === 0) { none++; continue; }
      const conf = s[0].confidence;
      if (conf >= 80) high++;
      else if (conf >= 60) medium++;
      else low++;
    }
    return { high, medium, low, none, unanalyzed };
  }, [selectedItems, suggestions]);

  const [autoMatchStats, setAutoMatchStats] = useState({ matched: 0, noMatch: 0 });

  const runAutoMatchBatch = async (targets: BankReconPosItem[], showToast: boolean) => {
    if (targets.length === 0) {
      if (showToast) toast({ title: 'Already Analyzed', description: `All items on this page have already been analyzed.` });
      return;
    }
    setAutoMatchRunning(true);
    autoMatchAbort.current = false;
    setAutoMatchProgress({ done: 0, total: targets.length });
    setAutoMatchQueued(new Set(targets.map(t => t.posItem_ID)));
    const orderMap = new Map<number, number>();
    targets.forEach((t, idx) => orderMap.set(t.posItem_ID, idx + 1));
    setAutoMatchOrder(orderMap);
    autoMatchTotalRef.current = targets.length;
    const stats = { matched: 0, noMatch: 0 };
    setAutoMatchStats({ matched: 0, noMatch: 0 });
    setAutoMatchEta(null);

    const BATCH_SIZE = 5;
    let doneCount = 0;
    const startTime = Date.now();
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      if (autoMatchAbort.current) break;
      const batch = targets.slice(i, i + BATCH_SIZE);
      setLoadingSuggestions(prev => {
        const next = new Set(prev);
        batch.forEach(item => next.add(item.posItem_ID));
        return next;
      });
      setAutoMatchQueued(prev => {
        const next = new Set(prev);
        batch.forEach(item => next.delete(item.posItem_ID));
        return next;
      });
      await Promise.all(batch.map(async (item) => {
        try {
          const results = await searchForSuggestions(item.note, item.reference, item.amount);
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
        setAutoMatchStats({ ...stats });
        const elapsed = (Date.now() - startTime) / 1000;
        const avgPerItem = elapsed / doneCount;
        const remaining = targets.length - doneCount;
        const etaSecs = Math.round(avgPerItem * remaining);
        setAutoMatchEta(etaSecs);
        setLoadingSuggestions(prev => {
          const next = new Set(prev);
          next.delete(item.posItem_ID);
          return next;
        });
      }));
    }

    setAutoMatchStats(stats);
    setAutoMatchRunning(false);
    setAutoMatchQueued(new Set());
    setAutoMatchOrder(new Map());
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
    const targets = selectedItems.filter(i => !i.billingAllocated && !suggestions[i.posItem_ID]);
    if (targets.length === 0) {
      toast({ title: 'Already Analyzed', description: 'All selected items have already been analyzed.' });
      return;
    }
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

  const isSearchActive = searchTerm.trim().length >= 2 && allItemsCacheRef.current !== null;
  const totalPages = isSearchActive ? 1 : Math.ceil(totalCount / pageSize);

  const handleAllocateClick = async (posItemId: number, e?: React.MouseEvent, preselectedAccount?: SuggestedMatch) => {
    if (e) e.stopPropagation();

    if (preselectedAccount) {
      const txItem = items.find(i => i.posItem_ID === posItemId)
        || allItemsCacheRef.current?.find(i => i.posItem_ID === posItemId);
      if (txItem) {
        setQuickAllocItem({ tx: txItem, match: preselectedAccount });
        return;
      }
    }

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
      setAllocateDialogKey(k => k + 1);
      setAllocateDialogPosItemId(posItemId);
    } catch (e: any) {
      console.error("Failed to check item processed status", e);
      setAllocateDialogKey(k => k + 1);
      setAllocateDialogPosItemId(posItemId);
    } finally {
      setCheckingItemId(null);
    }
  };

  const executeQuickAllocate = async () => {
    if (!quickAllocItem) return;
    const { tx, match } = quickAllocItem;
    setQuickAllocRunning(true);
    setQuickAllocStatus('Checking item...');
    try {
      let finYear: string;
      try {
        finYear = await fetchActiveFinYear();
      } catch (e: any) {
        toast({ title: 'Financial Year Error', description: e?.message || 'Unknown error', variant: 'destructive' });
        setQuickAllocRunning(false);
        setQuickAllocStatus('');
        return;
      }

      const checkUserId = currentUser?.id ? Number(currentUser.id) : -1;
      try {
        const checkResult = await platinumCheckSelectedItemProcessed(checkUserId, finYear, tx.posItem_ID);
        const msg = (checkResult?.message || '').toLowerCase();
        const isCashierError = msg.includes('active cashier') || msg.includes('cashier count');
        if (checkResult && checkResult.success === false && !isCashierError) {
          toast({ title: 'Item Already Processed', description: checkResult.message || 'Cannot allocate.', variant: 'destructive' });
          setQuickAllocRunning(false);
          setQuickAllocStatus('');
          setQuickAllocItem(null);
          return;
        }
      } catch {}

      setQuickAllocStatus('Submitting allocation...');
      const now = new Date();
      const saFormatter = new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const saParts = saFormatter.formatToParts(now);
      const getPart = (type: string) => saParts.find(p => p.type === type)?.value || '';
      const receiptDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

      const batchPayload = {
        posItemId: tx.posItem_ID,
        reconId: tx.bankReconID || tx.posItem_ID,
        financialYear: finYear,
        transactionDate: tx.dateOfTransaction || receiptDate,
        transactionNote: tx.note || tx.reference || '',
        lines: [{
          accountNo: match.accountNo,
          accountId: match.accountId,
          amount: tx.amount,
          allocationType: 'ACCOUNT',
          description: tx.note || tx.reference || '',
        }],
      };

      const result = await submitDDAllocationBatch(batchPayload);
      setQuickAllocStatus('Processing...');

      let pollAttempts = 0;
      const maxPolls = 30;
      while (pollAttempts < maxPolls) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const jobStatus = await pollDDAllocationJob(result.jobId);
          if (jobStatus.status === 'COMPLETED') {
            toast({ title: 'Allocation Successful', description: `POS Item #${tx.posItem_ID} allocated to ${match.accountNo} — ${match.name}` });
            setQuickAllocItem(null);
            setQuickAllocStatus('');
            loadData(page);
            return;
          } else if (jobStatus.status === 'FAILED' || jobStatus.status === 'PARTIAL_FAILURE') {
            const errMsg = jobStatus.errors?.join(', ') || 'Allocation failed';
            toast({ title: 'Allocation Failed', description: errMsg, variant: 'destructive' });
            setQuickAllocStatus('');
            return;
          }
        } catch (pollErr: any) {
          console.warn(`[QuickAllocate] Poll error:`, pollErr?.message);
        }
        pollAttempts++;
        setQuickAllocStatus(`Processing... (${pollAttempts}/${maxPolls})`);
      }
      toast({ title: 'Timeout', description: 'Allocation is still processing. Please check the allocation history.', variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Allocation Error', description: e?.message || 'Failed to submit allocation', variant: 'destructive' });
    } finally {
      setQuickAllocRunning(false);
      setQuickAllocStatus('');
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

  const findMatch = async (posItemId: number, note: string, reference: string, amount?: number) => {
    if (suggestions[posItemId] || loadingSuggestions.has(posItemId)) return;

    setLoadingSuggestions(prev => new Set(prev).add(posItemId));
    try {
      const results = await searchForSuggestions(note, reference, amount);
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

  const getAmountComparison = (txAmount: number, outstanding?: number): { label: string; color: string; bgColor: string } | null => {
    if (outstanding == null || outstanding === 0) return null;
    const ratio = txAmount / outstanding;
    if (ratio >= 0.95 && ratio <= 1.05) return { label: 'Exact', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' };
    if (txAmount < outstanding) return { label: 'Partial', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' };
    return { label: 'Overpays', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' };
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
      case 'name': return <Users className="w-3 h-3" />;
      case 'direct_income': return <Banknote className="w-3 h-3" />;
      case 'institution': return <Landmark className="w-3 h-3" />;
      case 'clearance': return <Shield className="w-3 h-3" />;
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
      case 'name': return 'Name';
      case 'direct_income': return 'Income';
      case 'institution': return 'Group';
      case 'clearance': return 'Clearance';
    }
  };

  const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [];
    pages.push(1);
    if (current > 3) pages.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('ellipsis');
    if (total > 1) pages.push(total);
    return pages;
  };

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

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

             <Button variant="outline" size="sm" className="h-11 sm:h-10 px-3 gap-1.5 border-[#D6D6D6]" onClick={() => { allItemsCacheRef.current = null; loadData(page); if (searchTerm.trim().length >= 2) loadAllForSearch(); }} disabled={loading} data-testid="button-refresh">
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
              <span className="text-slate-400">{isSearchActive ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} found` : `on this page (${filtered.length} of ${totalCount.toLocaleString()})`}</span>
            </div>
            {!autoMatchRunning && pageUnmatchedCount > 0 && (() => {
              const unmatchedNotAnalyzed = unmatchedFiltered.filter(i => !suggestions[i.posItem_ID]).length;
              const estSecs = Math.round(unmatchedNotAnalyzed * 1.2);
              const estLabel = estSecs >= 60 ? `~${Math.floor(estSecs / 60)}m ${estSecs % 60}s` : `~${estSecs}s`;
              return unmatchedNotAnalyzed > 0 ? (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2" onClick={runAutoMatchAll} data-testid="button-auto-match-page" title={`Analyze ${unmatchedNotAnalyzed} items (est. ${estLabel})`}>
                  <Zap className="w-3 h-3" /> Auto-Match {unmatchedNotAnalyzed} items <span className="text-[10px] text-amber-400 ml-0.5">({estLabel})</span>
                </Button>
              ) : null;
            })()}
            <div className="hidden sm:flex items-center gap-1.5 ml-auto text-muted-foreground text-[11px] max-w-[370px]">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span><strong className="text-slate-600">Matched items</strong> → click match to quick-allocate &nbsp;|&nbsp; <strong className="text-slate-600">No match</strong> → click Allocate for full search</span>
            </div>
            
            <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Banknote className="w-3 h-3" />
              <span className="hidden sm:inline">Page total: </span>
              <span className="font-mono font-medium text-slate-700">R {pageTotalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="sm:hidden px-4 pt-2 pb-1 bg-[#F2F4F7]">
          <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-white/70 rounded-lg px-3 py-2 border border-slate-200/60">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span><strong className="text-slate-600">Matched items</strong> → tap match card to quick-allocate &nbsp;|&nbsp; <strong className="text-slate-600">No match</strong> → tap Allocate for full search screen</span>
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
                    {!tx.billingAllocated && bestMatch && (() => {
                      const allMatches = suggestions[tx.posItem_ID] || [];
                      const renderMobileCard = (m: SuggestedMatch, isPrimary: boolean) => {
                        const isDI = m.matchType === 'direct_income';
                        const isInst = m.matchType === 'institution';
                        const isClr = m.matchType === 'clearance';
                        const isSpecial = isDI || isInst || isClr;
                        const ind = isDI ? 'income' : isInst ? 'inst' : isClr ? 'clr' : m.confidence >= 80 ? 'high' : m.confidence >= 60 ? 'medium' : 'low';
                        const amtCmp = isSpecial ? null : getAmountComparison(tx.amount, m.outstandingAmount);
                        return (
                        <button
                          key={m.accountId}
                          className={`flex items-start gap-2.5 w-full px-3 py-2.5 rounded-xl border mb-1.5 text-left transition-all hover:shadow-sm ${
                            isDI ? 'bg-violet-50/60 border-violet-200' :
                            isInst ? 'bg-teal-50/60 border-teal-200' :
                            isClr ? 'bg-cyan-50/60 border-cyan-200' :
                            ind === 'high' ? 'bg-emerald-50/60 border-emerald-200' :
                            ind === 'medium' ? 'bg-amber-50/60 border-amber-200' :
                            'bg-slate-50/60 border-slate-200'
                          } ${!isPrimary ? 'opacity-80' : ''}`}
                          onClick={() => {
                            if (isSpecial) {
                              handleAllocateClick(tx.posItem_ID);
                            } else {
                              handleAllocateClick(tx.posItem_ID, undefined, m);
                            }
                          }}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isDI ? 'bg-violet-100 text-violet-600' :
                            isInst ? 'bg-teal-100 text-teal-600' :
                            isClr ? 'bg-cyan-100 text-cyan-600' :
                            ind === 'high' ? 'bg-emerald-100 text-emerald-600' :
                            ind === 'medium' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {getMatchIcon(m.matchType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isDI ? (
                                <span className="text-xs font-semibold text-violet-700">Direct Income</span>
                              ) : isInst ? (
                                <span className="text-xs font-semibold text-teal-700">Institution/Group</span>
                              ) : isClr ? (
                                <span className="text-xs font-semibold text-cyan-700">{m.clearanceId ? `Clearance ${m.clearanceId.replace(/^0+/, '')}` : 'Clearance'}</span>
                              ) : (
                                <span className="font-mono text-xs font-semibold text-slate-800">{m.accountNo}</span>
                              )}
                              <Badge variant="outline" className={`text-[8px] px-1.5 py-0 font-bold ${isDI ? 'bg-violet-100 text-violet-700 border-violet-200' : isInst ? 'bg-teal-100 text-teal-700 border-teal-200' : isClr ? 'bg-cyan-100 text-cyan-700 border-cyan-200' : ind === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ind === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{m.confidence}%</Badge>
                              {!isSpecial && m.statusDesc && (
                                <Badge variant="outline" className={`text-[7px] px-1 py-0 ${m.statusDesc === 'Active' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-red-200 text-red-600 bg-red-50'}`}>{m.statusDesc}</Badge>
                              )}
                              {isClr && m.clearanceStatus && (
                                <Badge variant="outline" className={`text-[7px] px-1 py-0 ${m.clearanceStatus.includes('APPROV') || m.clearanceStatus.includes('ACTIVE') ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`}>{m.clearanceStatus}</Badge>
                              )}
                              {amtCmp && <Badge variant="outline" className={`text-[7px] px-1 py-0 ${amtCmp.bgColor} ${amtCmp.color} border`}>{amtCmp.label}</Badge>}
                            </div>
                            <div className={`text-[11px] font-medium mt-0.5 ${isDI ? 'text-violet-700' : isInst ? 'text-teal-700' : isClr ? 'text-cyan-700' : 'text-slate-700'}`}>{m.institutionName || m.miscPaymentGroupName || m.clearanceAccountName || m.name || m.accountDesc || m.typeOfUseDesc || m.address || 'Account ' + m.accountNo}</div>
                            {m.address && (m.name || m.institutionName || m.miscPaymentGroupName) && (
                              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />{m.address}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{getMatchTypeLabel(m.matchType)}</span>
                              {m.typeOfUseDesc && m.name && <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.typeOfUseDesc}</span>}
                              {m.erfNumber && <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">ERF {m.erfNumber}</span>}
                              {m.portion && <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Ptn {m.portion}</span>}
                              {m.allotment && <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.allotment}{m.town ? ` — ${m.town}` : ''}</span>}
                              {m.suburb && <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.suburb}</span>}
                              {m.activeServices != null && m.activeServices > 0 && <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.activeServices} svc{m.activeServices !== 1 ? 's' : ''}</span>}
                            </div>
                            {m.sgNumber && (
                              <div className="text-[9px] font-mono text-slate-400 mt-0.5">SG {m.sgNumber}</div>
                            )}
                            {m.matchSources && m.matchSources.length > 1 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                <span className="text-[8px] font-semibold text-emerald-700">{m.matchSources.length} sources:</span>
                                {m.matchSources.map((src, i) => (
                                  <span key={i} className="text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">{src}</span>
                                ))}
                              </div>
                            )}
                            {!isSpecial && m.outstandingAmount != null && (
                              <div className={`text-[10px] font-mono mt-1 ${m.outstandingAmount > 0 ? 'text-red-600' : m.outstandingAmount < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                Balance: <strong>R {m.outstandingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            {isClr && m.clearanceTotalDue != null && (
                              <div className="text-[10px] font-mono mt-1 text-cyan-700">
                                Amount Due: <strong>R {(m.outstandingAmount ?? m.clearanceTotalDue).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            {m.bankStatementPrior && m.bankStatementPrior.length > 0 && (
                              <div className="bg-blue-50/80 rounded-md px-2 py-1 mt-1 border border-blue-100">
                                <div className="text-[8px] font-semibold text-blue-700 flex items-center gap-1">
                                  <HistoryIcon className="w-2.5 h-2.5" /> Prior EFT Receipt
                                </div>
                                {m.bankStatementPrior.slice(0, 2).map((bp, i) => (
                                  <div key={i} className="text-[8px] text-blue-600 mt-0.5">
                                    <div>{bp.receiptNo} · R {bp.paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}{bp.date && ` · ${new Date(bp.date).toLocaleDateString('en-GB')}`}</div>
                                    {bp.description && <div className="text-[7px] text-blue-400">Desc: {bp.description}</div>}
                                    {bp.cashierName && <div className="text-[7px] text-blue-400">By: {bp.cashierName}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {m.priorAllocations && m.priorAllocations.length > 0 && (() => {
                              const latest = m.priorAllocations[0];
                              const dateStr = latest.dateCaptured ? new Date(latest.dateCaptured).toLocaleDateString('en-GB') : '—';
                              return (
                                <div className="text-[9px] text-blue-500 flex items-center gap-1 mt-1">
                                  <HistoryIcon className="w-2.5 h-2.5" />
                                  Prior DD: {dateStr} · R {latest.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                </div>
                              );
                            })()}
                          </div>
                          <div className={`shrink-0 mt-1.5 self-end px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 transition-all shadow-sm ${isClr ? 'bg-cyan-600 text-white shadow-cyan-200' : isInst ? 'bg-teal-600 text-white shadow-teal-200' : isDI ? 'bg-violet-600 text-white shadow-violet-200' : 'bg-emerald-600 text-white shadow-emerald-200'}`}>
                            {isSpecial ? 'Allocate' : 'Quick Allocate'}
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </button>
                        );
                      };
                      return (
                        <div className="mb-1">
                          {renderMobileCard(bestMatch, true)}
                          {allMatches.length > 1 && bestMatch.confidence < 90 && (() => {
                            const extras = allMatches.slice(1, 5).filter(m => m.confidence >= Math.max(bestMatch.confidence - 20, 40));
                            if (extras.length === 0) return null;
                            return (
                            <>
                              <div className="text-[9px] text-slate-400 px-1 mb-1 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {extras.length} more account{extras.length > 1 ? 's' : ''} on this property — select to allocate:
                              </div>
                              {extras.map(m => renderMobileCard(m, false))}
                            </>
                            );
                          })()}
                        </div>
                      );
                    })()}
                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="font-mono text-[10px]">{tx.reference || '-'}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-800">R {(tx.amount || 0).toFixed(2)}</span>
                        {!tx.billingAllocated && (
                          <Button size="sm" className="h-11 text-xs bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] px-3" disabled={checkingItemId === tx.posItem_ID} onClick={(e) => { const bestM = suggestions[tx.posItem_ID]?.[0]; const isSpecialMatch = bestM && (bestM.matchType === 'direct_income' || bestM.matchType === 'institution' || bestM.matchType === 'clearance'); handleAllocateClick(tx.posItem_ID, e, isSpecialMatch ? undefined : bestM); }} data-testid={`button-allocate-mobile-${tx.posItem_ID}`}>
                            {checkingItemId === tx.posItem_ID ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Allocate <ArrowRight className="ml-1 w-3.5 h-3.5" /></>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
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
                    <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 min-w-[340px]">Match</th>
                    <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-28">Amount</th>
                    <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--pos-accent)] mb-2" />
                        <span className="text-xs text-muted-foreground">Loading deposits...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center" data-testid="text-empty-state">
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
                        className={`transition-colors hover:bg-[#F7F7F7] ${isSelected ? 'bg-blue-50/40' : ''}`}
                      >
                        <td className="px-2 py-2.5 text-center">
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
                        <td className="px-3 py-2.5">
                          {!tx.billingAllocated && bestMatch ? (() => {
                            const allMatches = suggestions[tx.posItem_ID] || [];
                            const showMultiple = allMatches.length > 1 && bestMatch.confidence < 90;
                            const renderMatchCard = (m: SuggestedMatch, isPrimary: boolean) => {
                              const isDI = m.matchType === 'direct_income';
                              const isInst = m.matchType === 'institution';
                              const isClr = m.matchType === 'clearance';
                              const isSpecial = isDI || isInst || isClr;
                              const ind = isDI ? 'income' : isInst ? 'inst' : isClr ? 'clr' : m.confidence >= 80 ? 'high' : m.confidence >= 60 ? 'medium' : 'low';
                              const amtCmp = isSpecial ? null : getAmountComparison(tx.amount, m.outstandingAmount);
                              return (
                                <button
                                  key={m.accountId}
                                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left w-full transition-all hover:border-[var(--pos-accent)] hover:shadow-sm ${
                                    isDI ? 'bg-violet-50/60 border-violet-200' :
                                    isInst ? 'bg-teal-50/60 border-teal-200' :
                                    isClr ? 'bg-cyan-50/60 border-cyan-200' :
                                    ind === 'high' ? 'bg-emerald-50/60 border-emerald-200' :
                                    ind === 'medium' ? 'bg-amber-50/60 border-amber-200' :
                                    'bg-slate-50/60 border-slate-200'
                                  } ${!isPrimary ? 'opacity-80 hover:opacity-100' : ''}`}
                                  onClick={() => {
                                    if (isSpecial) {
                                      handleAllocateClick(tx.posItem_ID);
                                    } else {
                                      handleAllocateClick(tx.posItem_ID, undefined, m);
                                    }
                                  }}
                                  title={m.matchReasoning?.join('\n') || m.matchDetail}
                                >
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                    isDI ? 'bg-violet-100 text-violet-600' :
                                    isInst ? 'bg-teal-100 text-teal-600' :
                                    isClr ? 'bg-cyan-100 text-cyan-600' :
                                    ind === 'high' ? 'bg-emerald-100 text-emerald-600' :
                                    ind === 'medium' ? 'bg-amber-100 text-amber-600' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {getMatchIcon(m.matchType)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {isDI ? (
                                        <span className="text-[11px] font-semibold text-violet-700">Direct Income</span>
                                      ) : isInst ? (
                                        <span className="text-[11px] font-semibold text-teal-700">Institution/Group</span>
                                      ) : isClr ? (
                                        <span className="text-[11px] font-semibold text-cyan-700">{m.clearanceId ? `Clearance ${m.clearanceId.replace(/^0+/, '')}` : 'Clearance'}</span>
                                      ) : (
                                        <span className="font-mono text-[11px] font-semibold text-slate-800">{m.accountNo}</span>
                                      )}
                                      <Badge variant="outline" className={`text-[8px] px-1.5 py-0 font-bold ${
                                        isDI ? 'bg-violet-100 text-violet-700 border-violet-200' :
                                        isInst ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                        isClr ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                                        ind === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                        ind === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                        'bg-slate-100 text-slate-600 border-slate-200'
                                      }`}>{m.confidence}%</Badge>
                                      {!isSpecial && m.statusDesc && (
                                        <Badge variant="outline" className={`text-[7px] px-1 py-0 ${m.statusDesc === 'Active' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-red-200 text-red-600 bg-red-50'}`}>{m.statusDesc}</Badge>
                                      )}
                                      {isClr && m.clearanceStatus && (
                                        <Badge variant="outline" className={`text-[7px] px-1 py-0 ${m.clearanceStatus.includes('APPROV') || m.clearanceStatus.includes('ACTIVE') ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`}>{m.clearanceStatus}</Badge>
                                      )}
                                      {amtCmp && <Badge variant="outline" className={`text-[7px] px-1 py-0 ${amtCmp.bgColor} ${amtCmp.color} border`}>{amtCmp.label}</Badge>}
                                    </div>
                                    <div className={`text-[11px] font-medium mt-0.5 ${isDI ? 'text-violet-700' : isInst ? 'text-teal-700' : isClr ? 'text-cyan-700' : 'text-slate-700'}`}>{m.institutionName || m.miscPaymentGroupName || m.clearanceAccountName || m.name || m.accountDesc || m.typeOfUseDesc || m.address || 'Account ' + m.accountNo}</div>
                                    {m.address && (m.name || m.institutionName || m.miscPaymentGroupName) && (
                                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 shrink-0" />{m.address}{m.town ? `, ${m.town}` : ''}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{getMatchTypeLabel(m.matchType)}</span>
                                      {m.typeOfUseDesc && m.name && <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.typeOfUseDesc}</span>}
                                      {m.erfNumber && <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">ERF {m.erfNumber}</span>}
                                      {m.portion && <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Ptn {m.portion}</span>}
                                      {m.allotment && <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.allotment}{m.town ? ` — ${m.town}` : ''}</span>}
                                      {m.suburb && <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.suburb}</span>}
                                      {m.activeServices != null && m.activeServices > 0 && <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.activeServices} svc{m.activeServices !== 1 ? 's' : ''}</span>}
                                    </div>
                                    {m.sgNumber && (
                                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">SG {m.sgNumber}</div>
                                    )}
                                    {m.matchSources && m.matchSources.length > 1 && (
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                        <span className="text-[9px] font-semibold text-emerald-700">Confirmed by {m.matchSources.length} sources:</span>
                                        {m.matchSources.map((src, i) => (
                                          <span key={i} className="text-[8px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{src}</span>
                                        ))}
                                      </div>
                                    )}
                                    {!isSpecial && m.outstandingAmount != null && (
                                      <div className={`text-[10px] font-mono mt-1 ${m.outstandingAmount > 0 ? 'text-red-600' : m.outstandingAmount < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                        Balance: <strong>R {m.outstandingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                    )}
                                    {isClr && m.clearanceTotalDue != null && (
                                      <div className="text-[10px] font-mono mt-1 text-cyan-700">
                                        Amount Due: <strong>R {(m.outstandingAmount ?? m.clearanceTotalDue).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                    )}
                                    {m.bankStatementPrior && m.bankStatementPrior.length > 0 && (
                                      <div className="bg-blue-50/80 rounded-md px-2 py-1 mt-1 border border-blue-100">
                                        <div className="text-[9px] font-semibold text-blue-700 flex items-center gap-1">
                                          <HistoryIcon className="w-2.5 h-2.5" /> Previously Allocated (EFT Receipt)
                                        </div>
                                        {m.bankStatementPrior.slice(0, 3).map((bp, i) => (
                                          <div key={i} className="text-[9px] text-blue-600 mt-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono">{bp.receiptNo}</span>
                                              <span>R {bp.paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                                              {bp.date && <span className="text-blue-400">{new Date(bp.date).toLocaleDateString('en-GB')}</span>}
                                            </div>
                                            {bp.description && <div className="text-[8px] text-blue-400 mt-0.5">Desc: {bp.description}</div>}
                                            {(bp.cashierName || bp.dateCaptured) && (
                                              <div className="text-[8px] text-blue-400">
                                                {bp.cashierName && <>By: <strong className="text-blue-500">{bp.cashierName}</strong></>}
                                                {bp.dateCaptured && <> on {new Date(bp.dateCaptured).toLocaleDateString('en-GB')}</>}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {m.priorAllocations && m.priorAllocations.length > 0 && (() => {
                                      const latest = m.priorAllocations[0];
                                      const dateStr = latest.dateCaptured ? new Date(latest.dateCaptured).toLocaleDateString('en-GB') : '—';
                                      return (
                                        <div className="text-[9px] text-blue-600 flex items-center gap-1 mt-1">
                                          <HistoryIcon className="w-2.5 h-2.5" />
                                          Prior DD allocation: {dateStr} · R {latest.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                    <div className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap ${isClr ? 'bg-cyan-600 text-white shadow-cyan-200 hover:bg-cyan-700' : isInst ? 'bg-teal-600 text-white shadow-teal-200 hover:bg-teal-700' : isDI ? 'bg-violet-600 text-white shadow-violet-200 hover:bg-violet-700' : 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'}`}>
                                      {isSpecial ? 'Allocate' : 'Quick Allocate'}
                                      <ArrowRight className="w-3 h-3" />
                                    </div>
                                  </div>
                                </button>
                              );
                            };
                            return (
                              <div className="space-y-1.5">
                                {renderMatchCard(bestMatch, true)}
                                {showMultiple && (() => {
                                  const extras = allMatches.slice(1, 5).filter(m => m.confidence >= Math.max(bestMatch.confidence - 20, 40));
                                  if (extras.length === 0) return null;
                                  return (
                                  <div className="space-y-1">
                                    <div className="text-[9px] text-slate-400 px-1 flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5" />
                                      {extras.length} more account{extras.length > 1 ? 's' : ''} on this property — select to allocate:
                                    </div>
                                    {extras.map(m => renderMatchCard(m, false))}
                                  </div>
                                  );
                                })()}
                              </div>
                            );
                          })() : !tx.billingAllocated && suggestions[tx.posItem_ID] !== undefined ? (
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 flex-1">
                                <Search className="w-3 h-3 text-slate-300" />
                                <span className="text-[10px] text-slate-400">No match found</span>
                              </div>
                              <Button
                                size="sm"
                                className="h-8 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-xs gap-1 px-3 shrink-0"
                                disabled={checkingItemId === tx.posItem_ID}
                                onClick={(e) => { e.stopPropagation(); handleAllocateClick(tx.posItem_ID, e); }}
                                data-testid={`button-allocate-${tx.posItem_ID}`}
                              >
                                {checkingItemId === tx.posItem_ID ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                Allocate <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : !tx.billingAllocated ? (
                            <div className="flex items-center gap-2 py-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-8 text-xs gap-1.5 px-3 w-[130px] justify-center shrink-0 ${loadingSuggestions.has(tx.posItem_ID) ? 'text-amber-600 border-amber-300 animate-pulse' : autoMatchQueued.has(tx.posItem_ID) ? 'text-slate-400 border-slate-200' : 'text-slate-500 hover:text-amber-600 hover:border-amber-300'}`}
                                onClick={(e) => { e.stopPropagation(); findMatch(tx.posItem_ID, tx.note, tx.reference, tx.amount); }}
                                disabled={autoMatchQueued.has(tx.posItem_ID)}
                                data-testid={`button-suggest-${tx.posItem_ID}`}
                              >
                                {loadingSuggestions.has(tx.posItem_ID) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : autoMatchQueued.has(tx.posItem_ID) ? <Clock className="w-3.5 h-3.5 text-slate-400" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {loadingSuggestions.has(tx.posItem_ID)
                                  ? autoMatchRunning && autoMatchOrder.has(tx.posItem_ID)
                                    ? `${autoMatchOrder.get(tx.posItem_ID)}/${autoMatchTotalRef.current} Searching...`
                                    : 'Searching...'
                                  : autoMatchQueued.has(tx.posItem_ID)
                                    ? autoMatchRunning && autoMatchOrder.has(tx.posItem_ID)
                                      ? `#${autoMatchOrder.get(tx.posItem_ID)}/${autoMatchTotalRef.current} Queued`
                                      : 'Queued'
                                    : 'Find Match'}
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-xs gap-1 px-3 shrink-0"
                                disabled={checkingItemId === tx.posItem_ID}
                                onClick={(e) => { e.stopPropagation(); handleAllocateClick(tx.posItem_ID, e); }}
                                data-testid={`button-allocate-${tx.posItem_ID}`}
                              >
                                {checkingItemId === tx.posItem_ID ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                Allocate <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
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
                      </tr>
                    </React.Fragment>
                  );})}
                </tbody>
              </table>
              </div>

              {totalPages >= 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t bg-[#F7F7F7]/50 gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">Rows:</span>
                    <div className="flex items-center rounded-lg border border-[#D6D6D6] overflow-hidden">
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <button
                          key={size}
                          className={`px-2.5 py-1 text-[11px] font-medium transition-all ${pageSize === size
                            ? 'bg-[var(--pos-accent)] text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                          } ${size !== PAGE_SIZE_OPTIONS[0] ? 'border-l border-[#D6D6D6]' : ''}`}
                          onClick={() => handlePageSizeChange(size)}
                          disabled={loading}
                          data-testid={`button-pagesize-${size}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400 hidden lg:inline">
                      Showing {startItem}–{endItem} of {totalCount.toLocaleString()}
                    </span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1 || loading} onClick={() => changePage(1)} data-testid="button-first-page" title="First page">
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1 || loading} onClick={() => changePage(p => p - 1)} data-testid="button-prev-page" title="Previous page">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      {getPageNumbers(page, totalPages).map((p, idx) =>
                        p === 'ellipsis' ? (
                          <span key={`e${idx}`} className="px-1 text-[11px] text-slate-400">…</span>
                        ) : (
                          <button
                            key={p}
                            className={`w-7 h-7 rounded-md text-[11px] font-medium transition-all ${p === page
                              ? 'bg-[var(--pos-accent)] text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            onClick={() => changePage(p)}
                            disabled={loading}
                            data-testid={`button-page-${p}`}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages || loading} onClick={() => changePage(p => p + 1)} data-testid="button-next-page" title="Next page">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages || loading} onClick={() => changePage(totalPages)} data-testid="button-last-page" title="Last page">
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile pagination */}
            {totalPages >= 1 && (
              <div className="sm:hidden mt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Rows:</span>
                    <div className="flex items-center rounded-lg border border-[#D6D6D6] overflow-hidden">
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <button
                          key={size}
                          className={`px-3 py-1.5 text-xs font-medium transition-all ${pageSize === size
                            ? 'bg-[var(--pos-accent)] text-white'
                            : 'text-slate-600'
                          } ${size !== PAGE_SIZE_OPTIONS[0] ? 'border-l border-[#D6D6D6]' : ''}`}
                          onClick={() => handlePageSizeChange(size)}
                          disabled={loading}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">{startItem}–{endItem} of {totalCount.toLocaleString()}</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page <= 1 || loading} onClick={() => changePage(1)}>
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page <= 1 || loading} onClick={() => changePage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {getPageNumbers(page, totalPages).map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span key={`e${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          className={`w-9 h-9 rounded-lg text-xs font-medium transition-all ${p === page
                            ? 'bg-[var(--pos-accent)] text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          onClick={() => changePage(p)}
                          disabled={loading}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page >= totalPages || loading} onClick={() => changePage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page >= totalPages || loading} onClick={() => changePage(totalPages)}>
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div ref={selectionToolbarRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-[95vw]">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 bg-[#1a1a2e] text-white rounded-2xl shadow-2xl px-4 sm:px-5 py-3 border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--pos-accent)] flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{selectedItems.length} selected</div>
                    <div className="text-[10px] text-white/60 font-mono">R {selectedTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-[9px]">
                  {selectedMatchQuality.high > 0 && <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{selectedMatchQuality.high}</span>}
                  {selectedMatchQuality.medium > 0 && <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{selectedMatchQuality.medium}</span>}
                  {selectedMatchQuality.low > 0 && <span className="flex items-center gap-1 bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{selectedMatchQuality.low}</span>}
                  {selectedMatchQuality.none > 0 && <span className="flex items-center gap-1 bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />{selectedMatchQuality.none} no match</span>}
                  {selectedMatchQuality.unanalyzed > 0 && <span className="flex items-center gap-1 bg-white/5 text-white/40 px-1.5 py-0.5 rounded-full">{selectedMatchQuality.unanalyzed} pending</span>}
                </div>

                <div className="w-px h-8 bg-white/20 hidden sm:block" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 text-xs text-white hover:bg-white/10 gap-1.5 px-3"
                  onClick={runAutoMatchSelected}
                  disabled={autoMatchRunning}
                  data-testid="button-auto-match-selected"
                >
                  {autoMatchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  Auto-Match{selectedMatchQuality.unanalyzed > 0 ? ` (${selectedMatchQuality.unanalyzed})` : ''}
                </Button>
                {selectedWithMatch.length > 0 && (
                  <Button
                    size="sm"
                    className="h-9 text-xs gap-1.5 px-4 font-semibold shadow-lg animate-in fade-in duration-300"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
                    onClick={openBulkAllocate}
                    data-testid="button-allocate-matched"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Allocate {selectedWithMatch.length} Matched
                  </Button>
                )}
                {selectedItems.length > 0 && selectedWithMatch.length === 0 && selectedMatchQuality.unanalyzed === 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs text-white/40 gap-1.5 px-3 cursor-default"
                    disabled
                    data-testid="button-no-matches"
                  >
                    No matches to allocate
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

    {autoMatchRunning && ReactDOM.createPortal(
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-xl transition-all duration-300"
        style={{ bottom: selectedIds.size > 0 && selectionToolbarRef.current ? `${selectionToolbarRef.current.offsetHeight + 24}px` : '16px' }}
        data-testid="auto-match-progress-bar">
        <div className="bg-white border-2 border-amber-300 rounded-2xl px-4 py-3" style={{ boxShadow: '0 8px 32px rgba(217,119,6,0.25), 0 0 0 1px rgba(217,119,6,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-800">
                  Auto-matching: {autoMatchProgress.done} of {autoMatchProgress.total} done
                </span>
                <span className="text-sm font-mono font-bold text-amber-700">
                  {autoMatchProgress.total > 0 ? Math.round((autoMatchProgress.done / autoMatchProgress.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2.5 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${autoMatchProgress.total > 0 ? Math.round((autoMatchProgress.done / autoMatchProgress.total) * 100) : 0}%`,
                    backgroundColor: 'var(--pos-accent)',
                  }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                {autoMatchStats && autoMatchProgress.done > 0 ? (
                  <>
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      {autoMatchStats.matched} matched
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                      {autoMatchStats.noMatch} no match
                    </span>
                    <span className="text-amber-500 font-medium ml-auto">
                      {autoMatchEta != null
                        ? autoMatchEta >= 60
                          ? `~${Math.floor(autoMatchEta / 60)}m ${autoMatchEta % 60}s left`
                          : autoMatchEta > 0
                            ? `~${autoMatchEta}s left`
                            : 'Almost done...'
                        : `${autoMatchProgress.total - autoMatchProgress.done} remaining`
                      }
                    </span>
                  </>
                ) : (
                  <span className="text-amber-500">Starting analysis...</span>
                )}
              </div>
            </div>
            <button
              className="flex-shrink-0 text-[11px] font-semibold text-amber-700 hover:text-white bg-amber-100 hover:bg-amber-500 px-3 py-1.5 rounded-lg transition-colors"
              onClick={() => { autoMatchAbort.current = true; }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    <Dialog open={bulkAllocOpen} onOpenChange={(open) => { if (!bulkAllocRunning) setBulkAllocOpen(open); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 bg-white border-[#D6D6D6] overflow-hidden" style={{ borderRadius: '16px' }}>
        <div className="shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-[#D6D6D6] bg-[#FAFAFA]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--pos-accent, #10b981)' }}>
                  <Zap className="w-4.5 h-4.5 text-white" />
                </div>
                Batch Allocation Review
              </DialogTitle>
              <DialogDescription className="text-[#6B6B6B] text-sm">
                Review all {bulkAllocItems.length} items below. Change accounts or remove items before processing.
              </DialogDescription>
            </div>
            {!bulkAllocRunning && bulkAllocDone === 0 && (
              <button onClick={() => setBulkAllocOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
            <div className="bg-white rounded-xl px-3 py-2.5 border border-[#D6D6D6] shadow-sm">
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider font-medium">Items</div>
              <div className="text-lg font-bold text-[#2E2E2E]" data-testid="bulk-summary-count">{bulkAllocItems.length}</div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2.5 border border-[#D6D6D6] shadow-sm">
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider font-medium">Total Amount</div>
              <div className="text-lg font-bold text-[#2E2E2E]" data-testid="bulk-summary-amount">R {bulkAllocTotalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2.5 border border-[#D6D6D6] shadow-sm">
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider font-medium">Confidence</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {bulkHighConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">{bulkHighConfCount} high</Badge>}
                {bulkMedConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">{bulkMedConfCount} med</Badge>}
                {bulkLowConfCount > 0 && <Badge className="text-[9px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">{bulkLowConfCount} low</Badge>}
              </div>
            </div>
            <div className="bg-white rounded-xl px-3 py-2.5 border border-[#D6D6D6] shadow-sm">
              <div className="text-[10px] text-[#6B6B6B] uppercase tracking-wider font-medium">Status</div>
              <div className="text-sm font-semibold mt-0.5">
                {bulkAllocRunning ? (
                  <span className="text-amber-600 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing {bulkAllocDone}/{bulkAllocItems.length}</span>
                ) : bulkAllocDone > 0 ? (
                  <span className="flex items-center gap-1.5">
                    {bulkAllocSuccessCount > 0 && <span className="text-emerald-600">{bulkAllocSuccessCount} done</span>}
                    {bulkAllocFailCount > 0 && <span className="text-red-600">{bulkAllocFailCount} failed</span>}
                  </span>
                ) : bulkAmendedCount > 0 ? (
                  <span className="text-blue-600">{bulkAmendedCount} amended</span>
                ) : (
                  <span className="text-[#6B6B6B]">Ready to process</span>
                )}
              </div>
            </div>
          </div>

          {bulkAllocRunning && (
            <div className="mt-3">
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${bulkAllocItems.length > 0 ? (bulkAllocDone / bulkAllocItems.length) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--pos-accent, #10b981), #3b82f6)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-5 py-3 space-y-2 bg-[#F2F4F7]">
          {bulkAllocItems.map((item, idx) => {
            const isExpanded = bulkExpandedItem === item.posItemId;
            const isSearching = bulkSearching === item.posItemId;
            const confColor = item.match.confidence >= 80 ? 'emerald' : item.match.confidence >= 60 ? 'amber' : 'red';
            const statusBorder = item.status === 'success' ? 'border-emerald-300' : item.status === 'failed' ? 'border-red-300' : item.status === 'submitting' || item.status === 'polling' ? 'border-amber-300' : item.amended ? 'border-blue-300' : 'border-[#D6D6D6]';
            const statusBg = item.status === 'success' ? 'bg-emerald-50' : item.status === 'failed' ? 'bg-red-50' : item.status === 'submitting' || item.status === 'polling' ? 'bg-amber-50' : 'bg-white';

            return (
              <div key={item.posItemId} data-testid={`bulk-alloc-row-${item.posItemId}`} className={`rounded-xl border transition-all duration-200 ${statusBorder} ${statusBg} overflow-hidden shadow-sm`}>
                <div role="button" tabIndex={0} aria-expanded={isExpanded} className="w-full text-left px-3.5 sm:px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 rounded-t-xl" onClick={() => { if (!bulkAllocRunning) setBulkExpandedItem(isExpanded ? null : item.posItemId); }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !bulkAllocRunning) { e.preventDefault(); setBulkExpandedItem(isExpanded ? null : item.posItemId); } }} data-testid={`bulk-expand-${item.posItemId}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: item.status === 'success' ? '#10b981' : item.status === 'failed' ? '#ef4444' : item.status === 'submitting' || item.status === 'polling' ? '#f59e0b' : '#f1f5f9', color: item.status === 'pending' ? '#64748b' : '#fff' }}>
                      {item.status === 'submitting' || item.status === 'polling' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : item.status === 'success' ? <CheckSquare className="w-3.5 h-3.5" /> : item.status === 'failed' ? <X className="w-3.5 h-3.5" /> : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-[#2E2E2E] truncate max-w-[180px] sm:max-w-[280px]" title={item.note || item.reference}>
                          {item.note || item.reference || `POS Item ${item.posItemId}`}
                        </span>
                        <span className="text-sm font-bold text-[#2E2E2E] shrink-0">R {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className={`font-mono text-xs ${item.amended ? 'text-blue-600' : 'text-emerald-700'}`}>{item.match.accountNo}</span>
                        <span className="text-[10px] text-[#6B6B6B] hidden sm:inline">—</span>
                        <span className="text-[10px] text-[#6B6B6B] truncate max-w-[140px] sm:max-w-[220px] hidden sm:inline">{item.match.name}</span>
                        <Badge className="text-[8px] px-1.5 py-0 shrink-0 border" style={{ backgroundColor: confColor === 'emerald' ? '#ecfdf5' : confColor === 'amber' ? '#fffbeb' : '#fef2f2', color: confColor === 'emerald' ? '#047857' : confColor === 'amber' ? '#b45309' : '#b91c1c', borderColor: confColor === 'emerald' ? '#a7f3d0' : confColor === 'amber' ? '#fde68a' : '#fecaca' }}>{item.match.confidence}%</Badge>
                        {item.amended && <Badge className="text-[8px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Amended</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'pending' && !bulkAllocRunning && (
                        <button onClick={(e) => { e.stopPropagation(); removeBulkItem(item.posItemId); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Remove" data-testid={`bulk-remove-${item.posItemId}`}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.status === 'failed' && <span className="text-[10px] text-red-600 max-w-[100px] truncate hidden sm:inline" title={item.error}>{item.error}</span>}
                      {!bulkAllocRunning && item.status === 'pending' && (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && !bulkAllocRunning && item.status === 'pending' && (
                  <div className="border-t border-[#D6D6D6] px-3.5 sm:px-4 py-3 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200 bg-[#FAFAFA]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] text-[#6B6B6B] uppercase tracking-wider font-medium mb-1.5">Transaction Details</div>
                        <div className="bg-white rounded-lg p-2.5 space-y-1.5 text-xs border border-[#D6D6D6]">
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Description</span><span className="text-[#2E2E2E] text-right max-w-[200px] truncate" title={item.note}>{item.note || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Reference</span><span className="font-mono text-[#2E2E2E]">{item.reference || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Date</span><span className="text-[#2E2E2E]">{item.dateOfTransaction ? new Date(item.dateOfTransaction).toLocaleDateString('en-GB') : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Amount</span><span className="font-bold text-[#2E2E2E]">R {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">POS Item</span><span className="font-mono text-[#6B6B6B]">{item.posItemId}</span></div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-[#6B6B6B] uppercase tracking-wider font-medium mb-1.5">Target Account</div>
                        <div className={`rounded-lg p-2.5 space-y-1.5 text-xs border ${item.amended ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Account No</span><span className={`font-mono font-bold ${item.amended ? 'text-blue-700' : 'text-emerald-700'}`}>{item.match.accountNo}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Name</span><span className="text-[#2E2E2E] text-right max-w-[160px] truncate">{item.match.name || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Match Type</span><span className="text-[#2E2E2E]">{getMatchTypeLabel(item.match.matchType)}</span></div>
                          <div className="flex justify-between"><span className="text-[#6B6B6B]">Confidence</span><Badge className="text-[9px] px-1.5 py-0" style={{ backgroundColor: confColor === 'emerald' ? '#ecfdf5' : confColor === 'amber' ? '#fffbeb' : '#fef2f2', color: confColor === 'emerald' ? '#047857' : confColor === 'amber' ? '#b45309' : '#b91c1c', borderColor: confColor === 'emerald' ? '#a7f3d0' : confColor === 'amber' ? '#fde68a' : '#fecaca' }}>{item.match.confidence}%</Badge></div>
                          {item.match.outstandingAmount != null && <div className="flex justify-between"><span className="text-[#6B6B6B]">Outstanding</span><span className="font-mono text-[#2E2E2E]">R {item.match.outstandingAmount.toFixed(2)}</span></div>}
                        </div>
                      </div>
                    </div>

                    {item.match.priorAllocations && item.match.priorAllocations.length > 0 && (
                      <div>
                        <div className="text-[9px] text-[#6B6B6B] uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5">
                          <HistoryIcon className="w-3 h-3 text-blue-500" /> Recent Allocations to this Account
                        </div>
                        <div className="space-y-1">
                          {item.match.priorAllocations.slice(0, 3).map((pa, pi) => (
                            <div key={pi} className="flex items-center gap-3 bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-200 text-xs">
                              <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="text-[#6B6B6B] shrink-0">{pa.dateCaptured ? new Date(pa.dateCaptured).toLocaleDateString('en-GB') : '—'}</span>
                              <span className="text-[#6B6B6B] truncate flex-1" title={pa.paymentReference}>{pa.paymentReference || 'No reference'}</span>
                              <span className="font-mono font-semibold text-blue-700 shrink-0">R {pa.allocatedAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.match.matchReasoning && item.match.matchReasoning.length > 0 && (
                      <div className="bg-white rounded-lg px-2.5 py-2 border border-[#D6D6D6]">
                        <div className="text-[9px] text-[#6B6B6B] uppercase tracking-wider font-medium mb-1">Match Logic</div>
                        <div className="space-y-0.5">
                          {item.match.matchReasoning.map((r, ri) => (
                            <div key={ri} className="text-[10px] text-[#6B6B6B] flex items-start gap-1.5">
                              <span className="text-slate-400 mt-0.5 shrink-0">&#8226;</span><span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-[#D6D6D6] pt-3">
                      <div className="text-[9px] text-[#6B6B6B] uppercase tracking-wider font-medium mb-2">Change Account</div>
                      <div className="flex flex-col gap-2">
                        {!isSearching && item.alternativeMatches.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-[#6B6B6B] mb-1">Alternative suggestions:</div>
                            {item.alternativeMatches.slice(0, 3).map((alt, ai) => (
                              <button key={ai} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#D6D6D6] hover:border-blue-300 hover:bg-blue-50 transition-all text-left text-xs group" onClick={() => changeBulkItemMatch(item.posItemId, alt)} data-testid={`bulk-alt-${item.posItemId}-${ai}`}>
                                <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                  {getMatchIcon(alt.matchType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono text-[#2E2E2E]">{alt.accountNo}</span>
                                  <span className="text-[#6B6B6B] ml-1.5">{alt.name}</span>
                                </div>
                                <Badge className="text-[8px] px-1.5 py-0 shrink-0" style={{ backgroundColor: alt.confidence >= 80 ? '#ecfdf5' : alt.confidence >= 60 ? '#fffbeb' : '#fef2f2', color: alt.confidence >= 80 ? '#047857' : alt.confidence >= 60 ? '#b45309' : '#b91c1c' }}>{alt.confidence}%</Badge>
                              </button>
                            ))}
                          </div>
                        )}

                        {isSearching ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                  autoFocus
                                  placeholder="Type account number or name..."
                                  className="h-9 text-xs pl-8 bg-white border-[#D6D6D6]"
                                  value={bulkSearchTerm}
                                  onChange={(e) => { doBulkAccountSearch(e.target.value); }}
                                  data-testid={`bulk-search-input-${item.posItemId}`}
                                />
                              </div>
                              <Button size="sm" variant="ghost" className="h-9 text-[#6B6B6B] hover:text-[#2E2E2E] px-2" onClick={() => { setBulkSearching(null); setBulkSearchTerm(''); setBulkSearchResults([]); }}>
                                Cancel
                              </Button>
                            </div>
                            {bulkSearchResults.length > 0 && (
                              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                                {bulkSearchResults.map((sr, si) => (
                                  <button key={si} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#D6D6D6] hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left text-xs" onClick={() => changeBulkItemMatch(item.posItemId, sr)} data-testid={`bulk-search-result-${item.posItemId}-${si}`}>
                                    <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-mono text-emerald-700">{sr.accountNo}</span>
                                    <span className="text-[#6B6B6B] flex-1 truncate">{sr.name}</span>
                                    {sr.outstandingAmount != null && <span className="text-[10px] font-mono text-[#6B6B6B] shrink-0">R {sr.outstandingAmount.toFixed(2)}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                            {bulkSearchTerm.length >= 3 && bulkSearchResults.length === 0 && (
                              <div className="text-[10px] text-[#6B6B6B] text-center py-2">No accounts found</div>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 text-xs border-[#D6D6D6] text-[#6B6B6B] hover:text-[#2E2E2E] hover:border-blue-300 hover:bg-blue-50 gap-1.5 w-full sm:w-auto" onClick={() => startBulkAccountSearch(item.posItemId)} data-testid={`bulk-change-account-${item.posItemId}`}>
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

        <div className="shrink-0 border-t border-[#D6D6D6] px-5 sm:px-7 py-4 bg-[#FAFAFA]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[#6B6B6B] hidden sm:block">
              {bulkAllocItems.length} item{bulkAllocItems.length !== 1 ? 's' : ''} · R {bulkAllocTotalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} total
              {bulkAmendedCount > 0 && <span className="text-blue-600 ml-2">· {bulkAmendedCount} amended</span>}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!bulkAllocRunning && bulkAllocDone === 0 && (
                <>
                  <Button variant="outline" className="text-[#6B6B6B] border-[#D6D6D6] flex-1 sm:flex-none" onClick={() => setBulkAllocOpen(false)} data-testid="bulk-alloc-cancel">
                    Cancel
                  </Button>
                  <Button className="gap-2 flex-1 sm:flex-none h-10 px-6 font-semibold text-sm text-white" style={{ background: 'var(--pos-accent, #10b981)' }} onClick={executeBulkAllocate} disabled={bulkAllocItems.length === 0} data-testid="bulk-alloc-confirm">
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
                <Button className="gap-2 flex-1 sm:flex-none h-10 px-6 font-semibold text-sm text-white" style={{ background: bulkAllocFailCount > 0 ? '#f59e0b' : 'var(--pos-accent, #10b981)' }} onClick={() => { setBulkAllocOpen(false); setSelectedIds(new Set()); loadData(page); }} data-testid="bulk-alloc-done">
                  <CheckSquare className="w-4 h-4" />
                  {bulkAllocFailCount > 0 ? `Done — ${bulkAllocSuccessCount} Allocated, ${bulkAllocFailCount} Failed` : `Done — ${bulkAllocSuccessCount} Allocated`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={allocateDialogPosItemId !== null} onOpenChange={(open) => { if (!open) { setAllocateDialogPosItemId(null); loadData(page); } }}>
      <DialogContent hideCloseButton className="max-w-[100vw] sm:max-w-6xl w-[98vw] h-[100dvh] sm:h-[92vh] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-none sm:rounded-xl border-0 sm:border bg-white">
        <div className="sr-only"><DialogTitle>Allocate Transaction</DialogTitle><DialogDescription>Allocate direct deposit to accounts</DialogDescription></div>
        {allocateDialogPosItemId && (
          <AllocateTransaction
            key={allocateDialogKey}
            dialogMode
            dialogPosItemId={allocateDialogPosItemId}
            onDialogClose={() => { setAllocateDialogPosItemId(null); loadData(page); }}
            onDialogComplete={() => { setAllocateDialogPosItemId(null); loadData(page); }}
          />
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={!!quickAllocItem} onOpenChange={(open) => { if (!open && !quickAllocRunning) { setQuickAllocItem(null); setQuickAllocStatus(''); } }}>
      <DialogContent className="sm:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            Quick Allocate — Confirm Match
          </DialogTitle>
          <DialogDescription>
            This item was auto-matched. Review the details below and click Allocate to confirm.
          </DialogDescription>
        </DialogHeader>
        {quickAllocItem && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">POS Item #{quickAllocItem.tx.posItem_ID}</div>
                  <div className="text-sm font-medium mt-0.5 break-words">{quickAllocItem.tx.note || quickAllocItem.tx.reference || '—'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="text-lg font-bold text-green-700 whitespace-nowrap">R {quickAllocItem.tx.amount?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              {quickAllocItem.tx.dateOfTransaction && (
                <div className="text-xs text-muted-foreground">
                  Date: {(() => { try { return format(parseISO(quickAllocItem.tx.dateOfTransaction), 'dd/MM/yyyy'); } catch { return quickAllocItem.tx.dateOfTransaction; } })()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
              <span>Allocating to:</span>
            </div>

            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 font-mono">{quickAllocItem.match.accountNo}</Badge>
                <Badge className="text-[10px]" style={{ backgroundColor: quickAllocItem.match.confidence >= 80 ? '#16a34a' : quickAllocItem.match.confidence >= 60 ? '#d97706' : '#6b7280' }}>
                  {quickAllocItem.match.confidence}%
                </Badge>
                {quickAllocItem.match.statusDesc && (
                  <Badge variant="outline" className={`text-[10px] ${quickAllocItem.match.statusDesc === 'Active' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-red-300 text-red-700 bg-red-50'}`}>
                    {quickAllocItem.match.statusDesc}
                  </Badge>
                )}
                {quickAllocItem.match.erfNumber && (
                  <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 font-mono">ERF {quickAllocItem.match.erfNumber}</Badge>
                )}
                {quickAllocItem.match.portion && (
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 font-mono">Ptn {quickAllocItem.match.portion}</Badge>
                )}
                {quickAllocItem.match.allotment && (
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 font-mono">{quickAllocItem.match.allotment}{quickAllocItem.match.town ? ` — ${quickAllocItem.match.town}` : ''}</Badge>
                )}
                {quickAllocItem.match.matchSources && quickAllocItem.match.matchSources.length > 1 && (
                  <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">
                    <Check className="w-3 h-3 mr-0.5" /> {quickAllocItem.match.matchSources.length} sources
                  </Badge>
                )}
              </div>
              <div className="text-sm font-semibold">{quickAllocItem.match.name}</div>
              {(quickAllocItem.match.address || quickAllocItem.match.suburb) && (
                <div className="text-xs text-muted-foreground">{[quickAllocItem.match.address, quickAllocItem.match.suburb].filter(Boolean).join(', ')}</div>
              )}
              {quickAllocItem.match.matchDetail && (
                <div className="text-xs text-muted-foreground">{quickAllocItem.match.matchDetail}</div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                {quickAllocItem.match.outstandingAmount != null && (
                  <div className={`text-xs font-mono ${quickAllocItem.match.outstandingAmount > 0 ? 'text-red-600' : quickAllocItem.match.outstandingAmount < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    Balance: <span className="font-semibold">R {quickAllocItem.match.outstandingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              {quickAllocItem.match.sgNumber && (
                <div className="text-[10px] font-mono text-muted-foreground">SG {quickAllocItem.match.sgNumber}</div>
              )}
              {quickAllocItem.match.bankStatementPrior && quickAllocItem.match.bankStatementPrior.length > 0 && (
                <div className="bg-blue-50 rounded-md px-3 py-2 border border-blue-100 mt-1 space-y-1.5">
                  <div className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
                    <HistoryIcon className="w-3 h-3" /> Previously Allocated (EFT Receipt)
                  </div>
                  {quickAllocItem.match.bankStatementPrior.slice(0, 3).map((bp: any, i: number) => (
                    <div key={i} className="text-xs text-blue-600 space-y-0.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{bp.receiptNo}</span>
                        <span className="font-mono font-medium">R {bp.paidAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        {bp.date && <span className="text-blue-400">{new Date(bp.date).toLocaleDateString('en-GB')}</span>}
                      </div>
                      {bp.description && (
                        <div className="text-[10px] text-blue-500 pl-1">Description: {bp.description}</div>
                      )}
                      <div className="text-[10px] text-blue-400 pl-1 flex items-center gap-2">
                        {bp.cashierName && <span>Allocated by: <strong className="text-blue-600">{bp.cashierName}</strong></span>}
                        {bp.dateCaptured && <span>on {new Date(bp.dateCaptured).toLocaleDateString('en-GB')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {quickAllocItem.match.matchReasoning && quickAllocItem.match.matchReasoning.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-green-200 space-y-0.5">
                  {quickAllocItem.match.matchReasoning.map((r: string, i: number) => (
                    <div key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <span className="text-green-500 mt-px">•</span> {r}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {quickAllocStatus && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                {quickAllocStatus}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => { setQuickAllocItem(null); setQuickAllocStatus(''); }} disabled={quickAllocRunning} data-testid="button-quick-alloc-cancel">
            Cancel
          </Button>
          <Button
            onClick={executeQuickAllocate}
            disabled={quickAllocRunning}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-quick-alloc-confirm"
          >
            {quickAllocRunning ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Allocating...</> : <><Check className="w-4 h-4 mr-1" /> Allocate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
