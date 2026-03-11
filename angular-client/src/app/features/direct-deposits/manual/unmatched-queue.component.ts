import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

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
  priorAllocations?: any[];
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

type SortField = 'posItem_ID' | 'dateOfTransaction' | 'amount' | 'reference' | 'note' | 'billingAllocated';
type SortDir = 'asc' | 'desc';

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

const AREA_NAMES = new Set([
  'george', 'blanco', 'pacaltsdorp', 'pacalts', 'wilderness', 'uniondale',
  'haarlem', 'hoekwil', 'friemersheim', 'kleinkrantz', 'heather', 'herold',
  'herolds', 'heroldsbaai', 'herholdsbaai', 'heroldsbay', 'touwsranten',
  'slowveld', 'tyolora', 'delplan', 'conville',
  'le', 'grand', 'estate', 'outeniqua',
]);

const NOISE_WORDS = new Set(['FNB', 'OB', 'PMT', 'ABSA', 'STD', 'STANDARD', 'NEDBANK', 'CAPITEC', 'EFT', 'INT', 'CREDIT',
  'DEBIT', 'REF', 'INV', 'USER', 'MAGTAPE', 'GENERAL', 'DOM', 'INTERNET', 'PAYMENT', 'DEPOSIT',
  'ONTEC', 'FIXES', 'ACC', 'ACCOUNT', 'MTR', 'METER', 'ERF', 'SEQ', 'NO', 'NR', 'THE', 'AND', 'OF',
  'FOR', 'TO', 'IN', 'AT', 'MR', 'MRS', 'MS', 'DR', 'PROF', 'MUNICIPALITY', 'MUNICIPAL', 'GEORGE',
  'INVESTEC', 'CASHFOCUS', 'PROJECTS', 'PROJECT', 'BANK', 'TRANSFER']);

function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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

@Component({
  selector: 'app-unmatched-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './unmatched-queue.component.html',
  styleUrl: './unmatched-queue.component.css'
})
export class UnmatchedQueueComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  items = signal<BankReconPosItem[]>([]);
  totalCount = signal(0);

  searchQuery = signal('');
  statusFilter = signal('all');
  page = signal(1);
  pageSize = signal(25);
  sortField = signal<SortField>('dateOfTransaction');
  sortDir = signal<SortDir>('desc');

  selectedItem = signal<BankReconPosItem | null>(null);
  suggestedMatches = signal<SuggestedMatch[]>([]);
  matchLoading = signal(false);
  matchProgress = signal('');
  autoAllocating = signal(false);
  autoAllocatingId = signal<number | null>(null);

  selectedItems = signal<Set<number>>(new Set());
  batchAllocating = signal(false);

  detailOpen = signal(false);
  parsedClues = signal<ParsedClues | null>(null);

  pageSizeOptions = [10, 25, 50, 100];

  filteredItems = computed(() => {
    let data = this.items();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      data = data.filter(item =>
        (item.reference || '').toLowerCase().includes(q) ||
        (item.note || '').toLowerCase().includes(q) ||
        String(item.amount).includes(q) ||
        String(item.posItem_ID).includes(q)
      );
    }
    const sf = this.statusFilter();
    if (sf === 'allocated') {
      data = data.filter(i => i.billingAllocated);
    } else if (sf === 'unallocated') {
      data = data.filter(i => !i.billingAllocated);
    }
    return data;
  });

  sortedItems = computed(() => {
    const data = [...this.filteredItems()];
    const field = this.sortField();
    const dir = this.sortDir();
    data.sort((a, b) => {
      let valA: any = (a as any)[field];
      let valB: any = (b as any)[field];
      if (field === 'amount') {
        valA = valA || 0;
        valB = valB || 0;
        return dir === 'asc' ? valA - valB : valB - valA;
      }
      if (field === 'billingAllocated') {
        return dir === 'asc' ? (valA ? 1 : 0) - (valB ? 1 : 0) : (valB ? 1 : 0) - (valA ? 1 : 0);
      }
      if (field === 'dateOfTransaction') {
        const dA = new Date(valA || '').getTime() || 0;
        const dB = new Date(valB || '').getTime() || 0;
        return dir === 'asc' ? dA - dB : dB - dA;
      }
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      const cmp = valA.localeCompare(valB);
      return dir === 'asc' ? cmp : -cmp;
    });
    return data;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.sortedItems().length / this.pageSize())));

  paginatedItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedItems().slice(start, start + this.pageSize());
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  stats = computed(() => {
    const all = this.items();
    const allocated = all.filter(i => i.billingAllocated);
    const unallocated = all.filter(i => !i.billingAllocated);
    return {
      total: all.length,
      totalAmount: all.reduce((s, i) => s + (i.amount || 0), 0),
      allocated: allocated.length,
      allocatedAmount: allocated.reduce((s, i) => s + (i.amount || 0), 0),
      unallocated: unallocated.length,
      unallocatedAmount: unallocated.reduce((s, i) => s + (i.amount || 0), 0),
    };
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {}

  loadingMore = signal(false);
  loadProgress = signal('');

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.loadProgress.set('');
    try {
      const pageSize = 200;
      const result: any = await firstValueFrom(
        this.api.post('/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list', {
          page: 1,
          pageSize,
          orderby: 'dateOfTransaction',
          shortDirection: 'desc',
        })
      );

      const firstPageItems = this.extractItems(result);
      const serverTotal = result?.totalCount ?? firstPageItems.length;

      this.items.set(firstPageItems);
      this.totalCount.set(serverTotal);
      this.selectedItems.set(new Set());
      this.page.set(1);
      this.loading.set(false);

      if (firstPageItems.length < serverTotal && firstPageItems.length >= pageSize) {
        this.loadRemainingPages(firstPageItems, pageSize, serverTotal);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load deposits');
      this.toast.error('Failed to load deposits');
      this.loading.set(false);
    }
  }

  private async loadRemainingPages(initialItems: BankReconPosItem[], pageSize: number, serverTotal: number): Promise<void> {
    this.loadingMore.set(true);
    const allItems = [...initialItems];
    let currentPage = 2;
    const maxPages = 10;

    try {
      while (currentPage <= maxPages && allItems.length < serverTotal) {
        this.loadProgress.set(`Loading page ${currentPage}...`);
        const result: any = await firstValueFrom(
          this.api.post('/api/platinum/direct-deposit-allocation/get-bank-recon-positem-list', {
            page: currentPage,
            pageSize,
            orderby: 'dateOfTransaction',
            shortDirection: 'desc',
          })
        );

        const pageItems = this.extractItems(result);
        if (pageItems.length === 0) break;
        allItems.push(...pageItems);
        this.items.set([...allItems]);
        this.totalCount.set(allItems.length);
        currentPage++;
      }
    } catch (e: any) {
      console.error('[deposits] Background page load failed at page', currentPage, e);
      this.toast.show(`Loaded ${allItems.length} of ~${serverTotal} deposits (some pages failed)`, 'info');
    }
    this.loadingMore.set(false);
    this.loadProgress.set('');
  }

  private extractItems(result: any): BankReconPosItem[] {
    return Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result)
        ? result
        : Array.isArray(result?.value)
          ? result.value
          : Array.isArray(result?.data)
            ? result.data
            : [];
  }

  sort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'dateOfTransaction' || field === 'amount' ? 'desc' : 'asc');
    }
    this.page.set(1);
  }

  getSortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.page.set(1);
  }

  onStatusFilterChange(val: string): void {
    this.statusFilter.set(val);
    this.page.set(1);
  }

  onPageSizeChange(val: number): void {
    this.pageSize.set(val);
    this.page.set(1);
  }

  changePage(newPage: number | string): void {
    if (typeof newPage === 'string') return;
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.page.set(newPage);
    }
  }

  selectItem(item: BankReconPosItem): void {
    this.selectedItem.set(item);
    this.detailOpen.set(true);
    this.loadSuggestedMatches(item);
  }

  private sourceLabel(mt: string): string {
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
  }

  private addResult(
    suggestions: SuggestedMatch[],
    item: any,
    matchType: SuggestedMatch['matchType'],
    matchDetail: string,
    confidence: number,
    reasoning: string[]
  ): void {
    const accId = item.account_ID || item.accountID || item.accountId || item.id;
    if (!accId) return;
    const clampedConf = Math.min(confidence, 99);
    const existing = suggestions.find(s => s.accountId === accId);
    if (existing) {
      const newSource = this.sourceLabel(matchType);
      if (!existing.matchSources) existing.matchSources = [this.sourceLabel(existing.matchType)];
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
      matchSources: [this.sourceLabel(matchType)],
      bankStatementPrior: item._bankStatementPrior || undefined,
    });
  }

  private unwrap(rawData: any): any[] {
    return Array.isArray(rawData) ? rawData : rawData?.value || rawData?.results || [];
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<T | any[]> {
    try {
      return await fn();
    } catch (err) {
      console.error('[AutoMatch]', err);
      return [];
    }
  }

  async loadSuggestedMatches(item: BankReconPosItem): Promise<void> {
    this.matchLoading.set(true);
    this.matchProgress.set('Parsing description...');
    this.suggestedMatches.set([]);

    try {
      const clues = parseDescriptionForClues(item.note || '', item.reference || '');
      this.parsedClues.set(clues);
      const suggestions: SuggestedMatch[] = [];
      const searchPromises: Promise<void>[] = [];

      console.log('[AutoMatch] Searching — ERFs:', clues.erfNumbers, 'AccNums:', clues.accountNumbers,
        'Names:', clues.nameSearchTerms, 'Meters:', clues.meterNumbers, 'OldCodes:', clues.oldAccountCodes);

      this.matchProgress.set('Searching accounts...');

      for (const accNum of clues.accountNumbers.slice(0, 3)) {
        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: accNum })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 3)) {
              const accountNo = r.accountNumber || r.accountNo || String(r.account_ID || '');
              const exactMatch = accountNo === accNum || accountNo.endsWith(accNum) || accNum.endsWith(accountNo);
              this.addResult(suggestions, r, 'account_number',
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
          this.safeCall(() => firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNum })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 3)) {
              const accountNo = r.accountNumber || r.accountNo || String(r.account_ID || '');
              const nameMatch = accountNo.includes(accNum) || String(r.account_ID).includes(accNum);
              this.addResult(suggestions, r, 'account_number',
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
          this.safeCall(() => firstValueFrom(
            this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: oldCode })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 3)) {
              this.addResult(suggestions, r, 'old_account',
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
            this.safeCall(() => firstValueFrom(
              this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: accNum })
            )).then((rawData: any) => {
              const items = this.unwrap(rawData);
              for (const r of items.slice(0, 2)) {
                this.addResult(suggestions, r, 'old_account',
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

      for (const mtr of clues.meterNumbers.slice(0, 3)) {
        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: mtr })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 3)) {
              const meterStr = String(r.meterNumber || r.physicalMeterNumber || '');
              const exactMeterMatch = meterStr.includes(mtr);
              this.addResult(suggestions, r, 'meter_number',
                `Meter ${exactMeterMatch ? 'match' : 'ref'}: "${mtr}"${clues.serviceType ? ` (${clues.serviceType})` : ''}`,
                exactMeterMatch ? 92 : 75,
                [
                  `Extracted "${mtr}" as meter number from description`,
                  exactMeterMatch ? `Exact meter number match found` : `Partial meter reference found`,
                  clues.serviceType ? `Service type detected: ${clues.serviceType}` : `No specific service type detected`,
                  `Searched via DD account autocomplete API`,
                ]
              );
            }
          })
        );
      }

      const normalizeArea = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
      const checkAreaMatch = (r: any, area: string): boolean => {
        if (!area) return false;
        const normArea = normalizeArea(area);
        const fields = [
          r.allotmentArea, r.town, r.name, r.address,
          r.locationAddress, r.deliveryAddress, r.accountDesc,
        ].filter(Boolean).map((f: string) => normalizeArea(f));
        return fields.some(f => f.includes(normArea));
      };

      for (const erf of clues.erfNumbers.slice(0, 2)) {
        const erfLabel = erf.portion ? `ERF ${erf.erf}/${erf.portion}` : `ERF ${erf.erf}`;
        const areaLabel = erf.area ? ` ${erf.area}` : '';

        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { erfNumber: erf.erf })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 10)) {
              const hasAreaMatch = checkAreaMatch(r, erf.area);
              this.addResult(suggestions, r, 'erf_number',
                `${erfLabel}${areaLabel}${hasAreaMatch ? ' (area confirmed)' : ''}`,
                hasAreaMatch ? 93 : (erf.portion ? 85 : 75),
                [
                  `Parsed "${erfLabel}" from description`,
                  `Searched billing payment with erfNumber="${erf.erf}"`,
                  hasAreaMatch ? `Area "${erf.area}" confirmed in result` : `Area not verified`,
                ]
              );
            }
          })
        );

        const erfPadded = erf.erf.padStart(8, '0');
        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: erfPadded })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 10)) {
              if (r.displayItem && !r.sgNumber) r.sgNumber = r.displayItem;
              if (r.displayItem && !r.accountNumber) {
                const sgParts = parseSgNumber(r.displayItem);
                if (sgParts.erf) r.erfNumber = sgParts.erf;
                if (sgParts.portion) r.portion = sgParts.portion;
              }
              const hasAreaMatch = checkAreaMatch(r, erf.area);
              this.addResult(suggestions, r, 'erf_number',
                `${erfLabel}${areaLabel} — SG code match${hasAreaMatch ? ' (area confirmed)' : ''}`,
                hasAreaMatch ? 95 : 90,
                [
                  `Parsed "${erfLabel}" from description`,
                  `Searched old account autocomplete with "${erfPadded}"`,
                  r.displayItem ? `SG code: ${r.displayItem}` : `Matches SG code containing this ERF`,
                  hasAreaMatch ? `Area confirmed` : `Verify area`,
                ]
              );
            }
          })
        );

        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: erfPadded })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 10)) {
              if (r.displayItem && !r.sgNumber) r.sgNumber = r.displayItem;
              const hasAreaMatch = checkAreaMatch(r, erf.area);
              this.addResult(suggestions, r, 'erf_number',
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

        if (erf.erf !== erfPadded) {
          searchPromises.push(
            this.safeCall(() => firstValueFrom(
              this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: erf.erf })
            )).then((rawData: any) => {
              const items = this.unwrap(rawData);
              for (const r of items.slice(0, 10)) {
                if (r.displayItem && !r.sgNumber) r.sgNumber = r.displayItem;
                const hasAreaMatch = checkAreaMatch(r, erf.area);
                this.addResult(suggestions, r, 'erf_number',
                  `${erfLabel}${areaLabel} — DD autocomplete (raw)${hasAreaMatch ? ' (area confirmed)' : ''}`,
                  hasAreaMatch ? 91 : 85,
                  [
                    `Parsed "${erfLabel}" from description`,
                    `Searched DD autocomplete with raw ERF number`,
                    hasAreaMatch ? `Area confirmed` : `Verify area`,
                  ]
                );
              }
            })
          );
          searchPromises.push(
            this.safeCall(() => firstValueFrom(
              this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: erf.erf })
            )).then((rawData: any) => {
              const items = this.unwrap(rawData);
              for (const r of items.slice(0, 10)) {
                if (r.displayItem && !r.sgNumber) r.sgNumber = r.displayItem;
                if (r.displayItem) {
                  const sgParts = parseSgNumber(r.displayItem);
                  if (sgParts.erf) r.erfNumber = sgParts.erf;
                  if (sgParts.portion) r.portion = sgParts.portion;
                }
                const hasAreaMatch = checkAreaMatch(r, erf.area);
                this.addResult(suggestions, r, 'erf_number',
                  `${erfLabel}${areaLabel} — SG code (raw)${hasAreaMatch ? ' (area confirmed)' : ''}`,
                  hasAreaMatch ? 92 : 86,
                  [
                    `Parsed "${erfLabel}" from description`,
                    `Searched old account autocomplete with raw ERF`,
                    r.displayItem ? `SG code: ${r.displayItem}` : `ERF matched`,
                    hasAreaMatch ? `Area confirmed` : `Verify area`,
                  ]
                );
              }
            })
          );
        }
      }

      const tokenize = (str: string): string[] =>
        str.toUpperCase().split(/[\s,&.]+/).map(t => t.replace(/[^A-Z'-]/g, '')).filter(t => t.length >= 2);
      const tokenMatchesWord = (tokens: string[], word: string): boolean => {
        const w = word.toUpperCase();
        return tokens.some(t => t === w);
      };

      for (const nameTerm of clues.nameSearchTerms.slice(0, 3)) {
        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { name: nameTerm })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 5)) {
              const itemName = [r.initials, r.lastName].filter(Boolean).join(' ') || r.name || '';
              const nameTokens = tokenize(itemName);
              const searchWords = nameTerm.toUpperCase().split(/[\s,&]+/).filter((w: string) => w.length >= 2);
              let nameMatchScore = 0;
              const matchedParts: string[] = [];
              for (const word of searchWords) {
                if (tokenMatchesWord(nameTokens, word)) {
                  nameMatchScore += word.length >= 4 ? 15 : 8;
                  matchedParts.push(word);
                }
              }
              const surnameFromSearch = searchWords[searchWords.length - 1] || '';
              const surnameExact = surnameFromSearch.length >= 3 &&
                (r.lastName || '').toUpperCase() === surnameFromSearch;
              if (surnameExact) nameMatchScore += 20;
              const confidence = Math.min(85, 45 + nameMatchScore);
              if (matchedParts.length > 0) {
                this.addResult(suggestions, r, 'name',
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
      }

      const refTrimmed = (item.reference || '').trim();
      if (/^\d{3,7}$/.test(refTrimmed) && !clues.accountNumbers.some(a => a === refTrimmed || a.endsWith(refTrimmed))) {
        const paddedRef = refTrimmed.padStart(12, '0');
        searchPromises.push(
          this.safeCall(() => firstValueFrom(
            this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: paddedRef })
          )).then((rawData: any) => {
            const items = this.unwrap(rawData);
            for (const r of items.slice(0, 3)) {
              const accountNo = r.accountNumber || r.accountNo || String(r.account_ID || '');
              const isMatch = accountNo.endsWith(refTrimmed) || accountNo === paddedRef;
              if (isMatch) {
                this.addResult(suggestions, { ...r, account_ID: r.account_ID || r.accountID }, 'account_number',
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
      }

      if (clues.keywords.length > 0 && clues.erfNumbers.length === 0 && clues.accountNumbers.length === 0 && clues.meterNumbers.length === 0) {
        for (const keyword of clues.keywords.slice(0, 2)) {
          searchPromises.push(
            this.safeCall(() => firstValueFrom(
              this.api.post('/api/platinum/billing-payment/search-accounts', { name: keyword })
            )).then((rawData: any) => {
              const items = this.unwrap(rawData);
              for (const r of items.slice(0, 2)) {
                this.addResult(suggestions, r, 'reference', `Area/keyword match: "${keyword}"`, 40,
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

      this.matchProgress.set(`Running ${searchPromises.length} parallel searches...`);
      await Promise.allSettled(searchPromises);

      suggestions.sort((a, b) => b.confidence - a.confidence);

      this.suggestedMatches.set(suggestions);
      this.matchProgress.set('');
    } catch (e: any) {
      console.error('Failed to load suggested matches:', e);
    } finally {
      this.matchLoading.set(false);
      this.matchProgress.set('');
    }
  }

  async autoAllocateItem(item: BankReconPosItem): Promise<void> {
    this.autoAllocatingId.set(item.posItem_ID);
    this.autoAllocating.set(true);
    try {
      const clues = parseDescriptionForClues(item.note || '', item.reference || '');

      if (clues.accountNumbers.length === 0 && clues.erfNumbers.length === 0 && clues.meterNumbers.length === 0 && clues.oldAccountCodes.length === 0 && clues.nameSearchTerms.length === 0) {
        this.toast.error('No account clues found in description. Use manual allocation.');
        return;
      }

      const safeFirst = async (obs: any): Promise<any[]> => {
        try {
          const raw: any = await firstValueFrom(obs);
          if (Array.isArray(raw)) return raw;
          if (raw?.value && Array.isArray(raw.value)) return raw.value;
          if (raw?.results && Array.isArray(raw.results)) return raw.results;
          if (raw?.data && Array.isArray(raw.data)) return raw.data;
          return [];
        } catch { return []; }
      };

      type Candidate = { item: any; confidence: number; source: string };
      const candidateMap = new Map<number, Candidate>();
      const addCandidate = (r: any, confidence: number, source: string) => {
        const id = r.account_ID || r.accountID || r.id;
        if (!id) return;
        const existing = candidateMap.get(id);
        if (!existing || confidence > existing.confidence) {
          candidateMap.set(id, { item: r, confidence, source });
        }
      };

      const searchPromises: Promise<void>[] = [];

      for (const accNo of clues.accountNumbers.slice(0, 3)) {
        searchPromises.push(
          safeFirst(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: accNo }))
            .then(items => {
              for (const r of items.slice(0, 3)) {
                const resultAccNo = r.accountNumber || r.accountNo || '';
                const exact = resultAccNo.replace(/^0+/, '') === accNo.replace(/^0+/, '');
                addCandidate(r, exact ? 95 : 70, `Account: ${accNo}`);
              }
            })
        );
      }

      for (const erf of clues.erfNumbers.slice(0, 3)) {
        searchPromises.push(
          safeFirst(this.api.post('/api/platinum/billing-payment/search-accounts', { erfNumber: erf.erf }))
            .then(items => {
              for (const r of items.slice(0, 5)) {
                const normalizeArea = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
                let areaMatch = false;
                if (erf.area) {
                  const normArea = normalizeArea(erf.area);
                  areaMatch = [r.allotmentArea, r.town, r.name, r.address, r.locationAddress, r.deliveryAddress, r.accountDesc]
                    .filter(Boolean).map((f: string) => normalizeArea(f)).some(f => f.includes(normArea));
                }
                addCandidate(r, areaMatch ? 93 : (erf.portion ? 85 : 78), `ERF ${erf.erf}${erf.area ? ' ' + erf.area : ''}`);
              }
            })
        );

        const erfPadded = erf.erf.padStart(8, '0');
        searchPromises.push(
          safeFirst(this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: erfPadded }))
            .then(items => {
              for (const r of items.slice(0, 5)) {
                const normalizeArea = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');
                let areaMatch = false;
                if (erf.area) {
                  const normArea = normalizeArea(erf.area);
                  areaMatch = [r.allotmentArea, r.town, r.name, r.address, r.locationAddress]
                    .filter(Boolean).map((f: string) => normalizeArea(f)).some(f => f.includes(normArea));
                }
                addCandidate(r, areaMatch ? 92 : 87, `ERF ${erf.erf} (autocomplete)`);
              }
            })
        );

        searchPromises.push(
          safeFirst(this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: erfPadded }))
            .then(items => {
              for (const r of items.slice(0, 5)) {
                addCandidate(r, 90, `ERF ${erf.erf} (SG code)`);
              }
            })
        );

        if (erf.erf !== erfPadded) {
          searchPromises.push(
            safeFirst(this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: erf.erf }))
              .then(items => {
                for (const r of items.slice(0, 3)) addCandidate(r, 85, `ERF ${erf.erf} (raw)`);
              })
          );
        }
      }

      for (const mtr of clues.meterNumbers.slice(0, 3)) {
        searchPromises.push(
          safeFirst(this.api.post('/api/platinum/billing-payment/search-accounts', { physicalMeterNumber: mtr }))
            .then(items => {
              for (const r of items.slice(0, 3)) addCandidate(r, 90, `Meter: ${mtr}`);
            })
        );
        searchPromises.push(
          safeFirst(this.api.get('/api/platinum/direct-deposit-allocation/get-account-autocomplete', { searchText: mtr }))
            .then(items => {
              for (const r of items.slice(0, 3)) {
                const meterStr = String(r.meterNumber || r.physicalMeterNumber || '');
                addCandidate(r, meterStr.includes(mtr) ? 92 : 75, `Meter: ${mtr}`);
              }
            })
        );
      }

      for (const oldCode of clues.oldAccountCodes.slice(0, 2)) {
        searchPromises.push(
          safeFirst(this.api.get('/api/platinum/direct-deposit-allocation/get-old-account-autocomplete', { searchText: oldCode }))
            .then(items => {
              for (const r of items.slice(0, 3)) addCandidate(r, 78, `Old code: ${oldCode}`);
            })
        );
      }

      const refTrimmed = (item.reference || '').trim();
      if (/^\d{3,7}$/.test(refTrimmed) && !clues.accountNumbers.some(a => a === refTrimmed || a.endsWith(refTrimmed))) {
        const paddedRef = refTrimmed.padStart(12, '0');
        searchPromises.push(
          safeFirst(this.api.post('/api/platinum/billing-payment/search-accounts', { accountNo: paddedRef }))
            .then(items => {
              for (const r of items.slice(0, 2)) {
                const accNo = r.accountNumber || r.accountNo || '';
                if (accNo.endsWith(refTrimmed) || accNo === paddedRef) {
                  addCandidate(r, 92, `Reference: ${refTrimmed}`);
                }
              }
            })
        );
      }

      for (const nameTerm of clues.nameSearchTerms.slice(0, 2)) {
        searchPromises.push(
          safeFirst(this.api.post('/api/platinum/billing-payment/search-accounts', { name: nameTerm }))
            .then(items => {
              for (const r of items.slice(0, 3)) {
                const fullName = [r.initials, r.lastName].filter(Boolean).join(' ') || r.name || '';
                const nameUpper = nameTerm.toUpperCase();
                const exact = (r.lastName || '').toUpperCase() === nameUpper || fullName.toUpperCase().includes(nameUpper);
                addCandidate(r, exact ? 65 : 45, `Name: ${nameTerm}`);
              }
            })
        );
      }

      await Promise.allSettled(searchPromises);

      const candidates = Array.from(candidateMap.values());
      if (candidates.length === 0) {
        this.toast.error('No matching account found. Use manual allocation.');
        return;
      }

      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0];
      const accId = best.item.account_ID || best.item.accountID || best.item.id;
      const accNo = best.item.accountNumber || best.item.accountNo || String(accId);
      const name = [best.item.initials, best.item.lastName].filter(Boolean).join(' ') || best.item.name || best.item.accountDesc || '';
      this.toast.success(`Found: ${accNo} ${name} (${best.source}, ${best.confidence}%). Redirecting...`);
      this.router.navigate(['/direct-deposits/manual/allocate', item.posItem_ID]);
    } catch (e: any) {
      this.toast.error(e?.message || 'Auto-allocate failed');
    } finally {
      this.autoAllocating.set(false);
      this.autoAllocatingId.set(null);
    }
  }

  hasAccountClue(item: BankReconPosItem): boolean {
    const clues = parseDescriptionForClues(item.note || '', item.reference || '');
    return clues.accountNumbers.length > 0 || clues.erfNumbers.length > 0 || clues.meterNumbers.length > 0 || clues.oldAccountCodes.length > 0 || clues.nameSearchTerms.length > 0;
  }

  getClueTypeBadge(item: BankReconPosItem): string {
    const clues = parseDescriptionForClues(item.note || '', item.reference || '');
    if (clues.erfNumbers.length > 0) return 'ERF';
    if (clues.meterNumbers.length > 0) return 'Meter';
    if (clues.accountNumbers.length > 0) return 'Acc#';
    if (clues.nameSearchTerms.length > 0) return 'Name';
    return 'Match';
  }

  toggleItemSelection(itemId: number, event: Event): void {
    event.stopPropagation();
    const current = new Set(this.selectedItems());
    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }
    this.selectedItems.set(current);
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedItems().has(itemId);
  }

  selectAllItems(): void {
    const paginated = this.paginatedItems();
    const allSelected = paginated.every(i => this.selectedItems().has(i.posItem_ID));
    if (allSelected) {
      const current = new Set(this.selectedItems());
      paginated.forEach(i => current.delete(i.posItem_ID));
      this.selectedItems.set(current);
    } else {
      const current = new Set(this.selectedItems());
      paginated.forEach(i => current.add(i.posItem_ID));
      this.selectedItems.set(current);
    }
  }

  isAllOnPageSelected(): boolean {
    const paginated = this.paginatedItems();
    return paginated.length > 0 && paginated.every(i => this.selectedItems().has(i.posItem_ID));
  }

  navigateToAllocate(item: BankReconPosItem): void {
    this.router.navigate(['/direct-deposits/manual/allocate', item.posItem_ID]);
  }

  navigateToAllocateWithAccount(item: BankReconPosItem, match: SuggestedMatch): void {
    this.router.navigate(['/direct-deposits/manual/allocate', item.posItem_ID], {
      queryParams: {
        accountId: match.accountId,
        accountNo: match.accountNo,
        name: match.name,
        amount: item.amount,
      }
    });
  }

  navigateToHistory(): void {
    this.router.navigate(['/direct-deposits/manual/history']);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedItem.set(null);
    this.suggestedMatches.set([]);
    this.parsedClues.set(null);
  }

  formatCurrency(val: number): string {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return val; }
  }

  formatDateTime(val: string | null): string {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return val || '-'; }
  }

  getConfidenceBadgeClass(confidence: number): string {
    if (confidence >= 80) return 'badge-success';
    if (confidence >= 50) return 'badge-warning';
    return 'badge-default';
  }

  getMatchTypeIcon(matchType: string): string {
    switch (matchType) {
      case 'account_number': return '#';
      case 'erf_number': return '⌂';
      case 'meter_number': return '⚡';
      case 'old_account': return '⟲';
      case 'name': return '👤';
      case 'history': return '↻';
      case 'direct_income': return '💰';
      case 'institution': return '🏛';
      case 'clearance': return '📋';
      case 'reference': return '🔗';
      default: return '•';
    }
  }

  get Math() { return Math; }

  trackByPosItemId(_index: number, item: BankReconPosItem): number {
    return item.posItem_ID;
  }
}
