import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Account, DirectIncomeItem, ClearanceCostSchedule, AccountGroup, CashOffice } from './external-api';
import { calculateTransactionTotals, determineTransactionType, createTransactionRecord } from './pos-logic';
import { fetchBanks, fetchGroups, fetchInstitutions, fetchConfigSettings, fetchCashOffices, fetchCashiers, fetchBillingConfig, fetchPlatinumUserInfo, ApiCashier, BillingConfig, PlatinumUserInfo, postMultipleAccountPaymentReceipt, rebuildFullAccount, submitMiscPayment, submitConsumerPayment, submitPrepaidPayment, platinumPrintReceipt, platinumPrintMiscellaneousReceipt, platinumSaveMultipleAccountPayment, platinumGetMultipleAccountPayment, fetchPosMultiReceiptPrint, fetchReceiptAllocations, platinumSubmitClearancePayment, getReceiptTransactionDetail, fetchReceiptList, fetchCashierPaymentOptions, fetchCashierPaymentTypes, CashierPaymentOption, CashierPaymentType, mapTransactionTypeToPaymentOptionId, platinumGetConsAccountDetails, validateReceiptRange, fetchActiveCashierByUserId, fetchPosMultiReceiptPrintByCashier, platinumValidateCashier, fetchActiveFinYear, platinumAuthDayEndCancelReceipt, platinumRequestCancelReceipt, platinumApproveCancelReceipt, platinumDeclineCancelReceipt, platinumGetPendingCancelRequests } from './external-api';
import { getAccountBalance as enquiryGetAccountBalance } from './enquiries-service';

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}

export type TransactionType = 
  | 'CONSUMER_SERVICES' 
  | 'MULTI_ACCOUNT' 
  | 'ACCOUNT_GROUP' 
  | 'PREPAID' 
  | 'DIRECT_INCOME' 
  | 'CLEARANCE'
  | 'NONE';

export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'RECONCILED' | 'PENDING_CANCELLATION';
export type DayEndStatus = 'OPEN' | 'PENDING_APPROVAL' | 'RETURNED' | 'RECONCILED' | 'NOT_SUBMITTED';

export interface CashierProfile {
    id: string;
    name: string;
    role?: string;
    cashOffice: string;
    float?: number;
}

export interface ReceiptAllocation {
  service: string;
  amount: number;
  vat: number;
  total: number;
}

export interface ServiceBalance {
  serviceDescription: string;
  amount: number;
  vat: number;
  totalAmount: number;
  currentCharge: number;
  openingBalance: number;
}

export interface SplitReceipt {
  receiptNumber: string;
  receiptId: number;
  paymentType: 'cash' | 'card';
  amount: number;
  accountId?: string;
  accountName?: string;
  allocations?: ReceiptAllocation[];
  serviceBalances?: ServiceBalance[];
  receiptDetail?: any;
}

export interface TransactionRecord {
  id: string;
  receiptNumber: string;
  timestamp: number;
  items: TransactionItem[];
  totalAmount: number;
  payment: {
    cash: number;
    card: number;
    cardReference: string;
  };
  status: TransactionStatus;
  cashierId: string;
  cashierName?: string;
  cashOfficeName?: string;
  paymentTypeName?: string;
  paymentOptionName?: string;
  isReconciled: number;
  cancellationReason?: string;
  cancellationRequestTime?: number;
  allocations?: ReceiptAllocation[];
  splitReceipts?: SplitReceipt[];
  receiptDetail?: any;
}

export interface DayEndReport {
    cashOnHand: number;
    cardTotal: number;
    timestamp: number;
}

export interface TransactionItem {
  id: string; // unique id for the line item
  type: TransactionType;
  description: string;
  reference: string; // Account No, Meter No, Schedule No, etc.
  amountDue: number;
  amountToPay: number;
  originalData: any; // The full object (Account, Item, etc)
  paidBy?: string;
  paidByError?: boolean;
  notes?: string;
  additionalInfo?: string;
}

interface PosState {
  currentUser: CashierProfile;
  activeTransactionType: TransactionType;
  transactionItems: TransactionItem[];
  payment: {
    cashAmount: number;
    cardAmount: number;
    cardReference: string;
    tenderTotal: number;
    changeDue: number;
  };
  searchQuery: string;
  isReceiptModalOpen: boolean;
  transactionProcessing: boolean;
  currentTransactionId: string | null;
  viewingItemId: string | null;
  recentTransactions: TransactionRecord[];
  dayEndStatus: DayEndStatus;
  dayEndReturnReason?: string;
  activeSession: boolean;
  sessionLoading: boolean;
  startSession: (officeId: string, floatAmount: number, officeName?: string) => void;
  endSession: () => void;
  sessionDetails?: {
      startTime: number;
      officeId: string;
      officeDesc?: string;
      floatAmount: number;
  };
  platinumCashierId: number | null;
  officeLimits: Record<string, number>;
  currentTransactionLimit: number;
  allowedPaymentOptions: CashierPaymentOption[];
  allowedPaymentTypes: CashierPaymentType[];
  paymentOptionsSource: string;
  paymentTypesSource: string;
  isPaymentOptionAllowed: (transactionType: TransactionType) => boolean;
  isPaymentTypeAllowed: (typeId: number) => boolean;
  viewMode: 'desktop' | 'mobile';
  systemSettings: {
      enableDenominationCounting: boolean;
  };
  referenceData: {
      banks: any[];
      groups: any[];
      institutions: any[];
      settings: any[];
      cashOffices: CashOffice[];
      cashiers: ApiCashier[];
      billingConfig: BillingConfig | null;
  };
  platinumUser: PlatinumUserInfo | null;
  cashierRegistered: boolean | null;
  apiSessionActive: boolean | null;
  receiptDate: string;
}

interface PosActions {
  switchUser: (cashierId: string, name?: string, cashOffice?: string) => void;
  toggleViewMode: () => void;
  updateOfficeLimit: (officeId: string, limit: number) => void;
  updateSystemSettings: (settings: Partial<PosState['systemSettings']>) => void;
  setSearchQuery: (query: string) => void;
  addItem: (item: TransactionItem, allowDuplicates?: boolean) => void;
  removeItem: (id: string) => void;
  updateItemAmount: (id: string, amount: number) => void;
  updateItemDetails: (id: string, details: Partial<TransactionItem>) => void;
  setPaymentAmount: (type: 'cash' | 'card', amount: number) => void;
  setCardReference: (ref: string) => void;
  clearTransaction: () => void;
  completeTransaction: () => void;
  closeReceiptModal: () => void;
  setViewingItem: (id: string | null) => void;
  submitDayEnd: (report: { cashOnHand: number, cardTotal: number }) => void;
  returnDayEnd: (reason: string) => void;
  cancelTransaction: (id: string, reason: string) => void;
  approveCancellation: (id: string, approved: boolean) => void;
  refreshTransactions: () => Promise<void>;
  setReceiptDate: (date: string) => void;
}

const PosContext = createContext<(PosState & PosActions) | null>(null);

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within a PosProvider');
  return context;
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<CashierProfile>({
    id: "CSH-00",
    name: "Loading...",
    role: "CASHIER",
    cashOffice: "",
    float: 0
  });
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [payment, setPayment] = useState({ cash: 0, card: 0, cardReference: '' });
  const [completedPaymentSnapshot, setCompletedPaymentSnapshot] = useState<{ cashAmount: number; cardAmount: number; cardReference: string; tenderTotal: number; changeDue: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [transactionProcessing, setTransactionProcessing] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const currentTransactionIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { currentTransactionIdRef.current = currentTransactionId; }, [currentTransactionId]);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
  const [dayEndStatus, setDayEndStatus] = useState<DayEndStatus>('OPEN');
  const [dayEndReturnReason, setDayEndReturnReason] = useState<string>('');
  
  // Session State
  const [activeSession, setActiveSession] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState<{startTime: number; officeId: string; officeDesc?: string; floatAmount: number} | undefined>(undefined);
  const [platinumCashierId, setPlatinumCashierId] = useState<number | null>(null);
  const [cashierRegistered, setCashierRegistered] = useState<boolean | null>(null);
  const [apiSessionActive, setApiSessionActive] = useState<boolean | null>(null);
  const getSADateString = () => {
    const saDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
    return saDate.getFullYear() + '-' + String(saDate.getMonth() + 1).padStart(2, '0') + '-' + String(saDate.getDate()).padStart(2, '0');
  };
  const [receiptDate, setReceiptDate] = useState<string>(getSADateString());
  
  const [officeLimits, setOfficeLimits] = useState<Record<string, number>>({});
  const [allowedPaymentOptions, setAllowedPaymentOptions] = useState<CashierPaymentOption[]>([]);
  const [allowedPaymentTypes, setAllowedPaymentTypes] = useState<CashierPaymentType[]>([]);
  const [paymentOptionsSource, setPaymentOptionsSource] = useState<string>('not-loaded');
  const [paymentTypesSource, setPaymentTypesSource] = useState<string>('not-loaded');

  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [systemSettings, setSystemSettings] = useState({
      enableDenominationCounting: false
  });

  const [platinumUser, setPlatinumUser] = useState<PlatinumUserInfo | null>(null);

  const [referenceData, setReferenceData] = useState<{
      banks: any[];
      groups: any[];
      institutions: any[];
      settings: any[];
      cashOffices: CashOffice[];
      cashiers: ApiCashier[];
      billingConfig: BillingConfig | null;
  }>({
      banks: [],
      groups: [],
      institutions: [],
      settings: [],
      cashOffices: [],
      cashiers: [],
      billingConfig: null
  });

  // Fetch reference data on mount
  useEffect(() => {
      const loadData = async () => {
          try {
              console.log("Fetching reference data...");
              const safe = <T,>(promise: Promise<T>, fallback: T, label: string): Promise<T> =>
                  promise.catch((e) => { console.warn(`[RefData] ${label} failed:`, e?.message || e); return fallback; });

              const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Reference data loading timed out after 45 seconds')), 45000)
              );
              const dataPromise = Promise.all([
                  safe(fetchBanks(), [], 'banks'),
                  safe(fetchGroups(), [], 'groups'),
                  safe(fetchInstitutions(), [], 'institutions'),
                  safe(fetchConfigSettings(), [], 'configSettings'),
                  safe(fetchCashOffices(), [], 'cashOffices'),
                  safe(fetchCashiers(), [], 'cashiers'),
                  safe(fetchBillingConfig(), null, 'billingConfig'),
                  safe(fetchPlatinumUserInfo(), null, 'platinumUserInfo')
              ]);
              const [banks, groups, institutions, settings, cashOffices, cashiers, billingConfig, platinumUserInfo] = await Promise.race([dataPromise, timeoutPromise]) as any;
              
              setReferenceData({
                  banks: banks || [],
                  groups: groups || [],
                  institutions: institutions || [],
                  settings: settings || [],
                  cashOffices: cashOffices || [],
                  cashiers: cashiers || [],
                  billingConfig: billingConfig || null
              });

              if (platinumUserInfo) {
                  setPlatinumUser(platinumUserInfo);
                  console.log("Platinum user info loaded:", platinumUserInfo);
                  setCurrentUser({
                      id: String(platinumUserInfo.user_ID),
                      name: `${platinumUserInfo.firstName} ${platinumUserInfo.lastName}`.trim(),
                      role: platinumUserInfo.superUser ? 'SUPERVISOR' : 'CASHIER',
                      cashOffice: '',
                      float: platinumUserInfo.cashFloat || 0,
                  });
              } else {
                  console.warn("Platinum user info not available - ending session loading");
                  setSessionLoading(false);
              }
              
              console.log("Reference Data Loaded:", { banks, groups, institutions, settings, cashOffices, cashiers, billingConfig });
          } catch (error: any) {
              console.error("Failed to load reference data", error);
              setSessionLoading(false);
              toast({
                  title: "Connection Error",
                  description: `Failed to load data from API. Error: ${error.message || 'Unknown network error'}`,
                  variant: "destructive"
              });
          }
      };
      
      loadData();
  }, []);

  const currentTransactionLimit = useMemo(() => {
      if (!sessionDetails?.officeId) return 5000;
      return officeLimits[sessionDetails.officeId] || 5000;
  }, [sessionDetails?.officeId, officeLimits]);

  useEffect(() => {
    if (!platinumUser) return;
    const checkActiveSession = async () => {
      try {
        const res = await fetchActiveCashierByUserId(platinumUser.user_ID, platinumUser.finYear || '2025/2026').catch(() => null);
        if (!res) {
          setCashierRegistered(false);
          setSessionLoading(false);
          return;
        }
        const data = res;
        setCashierRegistered(data.cashierRegistered === true);
        const receiptCashierId = data.details?.id || data.cashierId || null;
        console.log(`[Session] Platinum cashier IDs — top-level cashierId: ${data.cashierId}, details.id: ${data.details?.id}, using for receipts: ${receiptCashierId}`);
        setPlatinumCashierId(receiptCashierId);
        if (data.cashOnHandLimit && data.officeId) {
          setOfficeLimits(prev => ({ ...prev, [String(data.officeId)]: data.cashOnHandLimit }));
        }
        console.log("Platinum cashier status:", { registered: data.cashierRegistered, isActive: data.isActive, officeId: data.officeId, officeName: data.officeName });

        if (data.cashierRegistered === true) {
          const userName = `${platinumUser.firstName || ''} ${platinumUser.lastName || ''}`.trim();
          const officeName = data.officeName || data.details?.const_CashOffice?.cashOfficeDesc || '';

          setCurrentUser({
            id: String(platinumUser.user_ID),
            name: userName || platinumUser.userName || 'Cashier',
            cashOffice: officeName
          });

          if (data.isActive === true && data.officeId) {
            const officeId = String(data.officeId);
            const cashFloat = data.cashFloat ?? data.details?.cashFloat ?? 0;
            console.log(`[Session] validate-cashier API confirms session is active (POS_Cashier.IsActive=1) — auto-resuming. Office: ${officeName} (ID: ${officeId}), Float: ${cashFloat}`);
            setActiveSession(true);
            setApiSessionActive(true);
            setSessionDetails({
              startTime: Date.now(),
              officeId,
              officeDesc: officeName,
              floatAmount: cashFloat
            });
          } else {
            console.log(`[Session] Cashier registered but validate-cashier returned isActive=false. Must start session via cashier setup page.`);
            setApiSessionActive(false);
          }
        }
      } catch (e) {
        console.warn("Failed to check active Platinum session", e);
        setCashierRegistered(false);
      } finally {
        setSessionLoading(false);
      }
    };
    checkActiveSession();
  }, [platinumUser]);

  const loadTransactionsFromApi = async () => {
    const pCashierId = platinumCashierId;
    if (!pCashierId) {
      console.log('[Transactions] No platinumCashierId available yet, skipping receipt load');
      return;
    }

    try {
      const today = new Date();
      const fromDate = today.getFullYear() + '-' +
          String(today.getMonth() + 1).padStart(2, '0') + '-' +
          String(today.getDate()).padStart(2, '0') + 'T00:00:00';

      console.log(`[Transactions] Fetching receipts for platinumCashierId: ${pCashierId}, fromDate: ${fromDate}`);

      const result = await fetchReceiptList({
        cashierId: String(pCashierId),
        fromDate,
        page: 1,
        pageSize: 200,
        orderby: 'receiptDate',
        shortDirection: 'desc',
      });

      if (result.items && result.items.length > 0) {
        const mapped: TransactionRecord[] = result.items.map((r) => {
          const isCash = (r.paymentType || '').toLowerCase().includes('cash');
          const isCard = (r.paymentType || '').toLowerCase().includes('card');
          const paymentAmount = r.amount || 0;

          let txType: TransactionType = 'CONSUMER_SERVICES';
          const opt = (r.paymentOption || '').toLowerCase();
          if (opt.includes('misc') || opt.includes('direct') || opt.includes('income')) {
            txType = 'DIRECT_INCOME';
          } else if (opt.includes('clearance')) {
            txType = 'CLEARANCE';
          } else if (opt.includes('prepaid')) {
            txType = 'PREPAID';
          }

          return {
            id: `plt-${r.receiptId}`,
            receiptNumber: r.receiptNo || `REC-${r.receiptId}`,
            timestamp: new Date(r.receiptDate).getTime() || Date.now(),
            items: [{
              id: `item-${r.receiptId}`,
              type: txType,
              description: r.accName || r.paymentOption || 'Payment',
              reference: r.accountNumber || '',
              amountDue: r.outstandingAmount || paymentAmount,
              amountToPay: paymentAmount,
              originalData: r,
            }],
            totalAmount: paymentAmount,
            payment: {
              cash: isCash ? paymentAmount : 0,
              card: isCard ? paymentAmount : 0,
              cardReference: '',
            },
            status: r.isCancelled === 1 ? 'CANCELLED' as TransactionStatus : 'COMPLETED' as TransactionStatus,
            cashierId: currentUser.id,
            cashierName: r.cashierName || '',
            cashOfficeName: r.cashOffice || '',
            paymentTypeName: r.paymentType || '',
            paymentOptionName: r.paymentOption || '',
            isReconciled: 0,
            cancellationReason: r.cancellationReason || undefined,
          };
        });

        setRecentTransactions(prev => {
            const activeId = currentTransactionIdRef.current;
            const activeTx = activeId ? prev.find(t => t.id === activeId) : null;
            if (activeTx) {
                const filtered = mapped.filter(t => t.id !== activeTx.id);
                return [activeTx, ...filtered];
            }
            return mapped;
        });
        console.log(`[Transactions] Loaded ${mapped.length} transactions from Platinum ViewReceipt API`);
        return;
      }

      console.log(`[Transactions] ViewReceipt returned empty, trying API discovery scan`);
      let results: { receiptId: number; data: any }[] = [];

      if (platinumUser) {
        console.log(`[Transactions] Running discovery scan for cashier: ${platinumUser.firstName} ${platinumUser.lastName}`);
        try {
          const cashierName = `${platinumUser.firstName} ${platinumUser.lastName}`;
          const discovered = await fetchPosMultiReceiptPrintByCashier(cashierName, 100);
          if (Array.isArray(discovered) && discovered.length > 0) {
            results = discovered.map((d: any) => ({ receiptId: d._receiptId, data: d }));
            console.log(`[Transactions] Discovered ${results.length} receipts via API scan`);
          }
        } catch (e) {
          console.warn(`[Transactions] Discovery scan failed:`, e);
        }
      }

      if (results.length > 0) {
        const mapped: TransactionRecord[] = results.map(({ receiptId: rid, data: rd }) => {
          const isCash = rd.billType?.toLowerCase().includes('cash') || rd.paymentTypeId === 1;
          const isCard = rd.billType?.toLowerCase().includes('card') || rd.paymentTypeId === 3;
          const paymentAmount = rd.tenderAmount || rd.amount || 0;

          let txType: TransactionType = 'CONSUMER_SERVICES';
          const mode = (rd.payMode || '').toLowerCase();
          if (mode.includes('misc') || mode.includes('direct') || mode.includes('income')) {
            txType = 'DIRECT_INCOME';
          } else if (mode.includes('clearance')) {
            txType = 'CLEARANCE';
          } else if (mode.includes('prepaid')) {
            txType = 'PREPAID';
          }

          const parseDate = (d: string) => {
            if (!d) return Date.now();
            const parts = d.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
            if (parts) {
              return new Date(`${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:${parts[6]}`).getTime();
            }
            return new Date(d).getTime() || Date.now();
          };

          return {
            id: `plt-${rid}`,
            receiptNumber: rd.receiptNo || `REC-${rid}`,
            timestamp: parseDate(rd.receiptDate),
            items: [{
              id: `item-${rid}`,
              type: txType,
              description: rd.accName || rd.payMode || 'Payment',
              reference: rd.accountId || rd.oldAccountCode || '',
              amountDue: rd.outstandingAmount || paymentAmount,
              amountToPay: paymentAmount,
              originalData: rd,
            }],
            totalAmount: paymentAmount,
            payment: {
              cash: isCash ? paymentAmount : 0,
              card: isCard ? paymentAmount : 0,
              cardReference: '',
            },
            status: rd.isCancelled ? 'CANCELLED' as TransactionStatus : 'COMPLETED' as TransactionStatus,
            cashierId: currentUser.id,
            cashierName: rd.cashierName || '',
            cashOfficeName: rd.cashOfficeName || '',
            paymentTypeName: rd.billType || '',
            paymentOptionName: rd.payMode || '',
            isReconciled: 0,
          };
        });

        mapped.sort((a, b) => b.timestamp - a.timestamp);
        setRecentTransactions(prev => {
            const activeId = currentTransactionIdRef.current;
            const activeTx = activeId ? prev.find(t => t.id === activeId) : null;
            if (activeTx) {
                const filtered = mapped.filter(t => t.id !== activeTx.id);
                return [activeTx, ...filtered];
            }
            return mapped;
        });
        console.log(`[Transactions] Loaded ${mapped.length} transactions from stored receipt IDs via pos-multi-receipt-print`);
      } else {
        setRecentTransactions(prev => {
            const activeId = currentTransactionIdRef.current;
            const activeTx = activeId ? prev.find(t => t.id === activeId) : null;
            return activeTx ? [activeTx] : [];
        });
        console.log(`[Transactions] No receipt data found from stored IDs`);
      }
    } catch (e) {
      console.warn('[Transactions] Failed to load transactions from API:', e);
    }
  };

  useEffect(() => {
    if (activeSession && platinumCashierId) {
      loadTransactionsFromApi();

      const loadPaymentConfig = async () => {
        try {
          const userId = platinumUser?.user_ID || 0;
          const cashofficeId = sessionDetails?.officeId ? Number(sessionDetails.officeId) : 0;
          console.log(`[PaymentConfig] Loading payment options — userId=${userId}, cashofficeId=${cashofficeId}, cashierId=${platinumCashierId}`);

          const [optionsResult, typesResult] = await Promise.all([
            fetchCashierPaymentOptions(platinumCashierId, userId, cashofficeId),
            fetchCashierPaymentTypes(platinumCashierId, userId, cashofficeId),
          ]);
          if (optionsResult.data?.length > 0) {
            setAllowedPaymentOptions(optionsResult.data);
            setPaymentOptionsSource(optionsResult.source);
            console.log(`[PaymentConfig] Loaded ${optionsResult.data.length} payment options (source: ${optionsResult.source})`);
          }
          if (typesResult.data?.length > 0) {
            setAllowedPaymentTypes(typesResult.data);
            setPaymentTypesSource(typesResult.source);
            console.log(`[PaymentConfig] Loaded ${typesResult.data.length} payment types (source: ${typesResult.source})`);
          }
        } catch (e) {
          console.warn('[PaymentConfig] Failed to load payment options/types:', e);
        }
      };
      loadPaymentConfig();
    }
  }, [activeSession, platinumCashierId]);

  // Update currentUser when cashiers are loaded from API (only if Platinum user info not available)
  useEffect(() => {
      if (!platinumUser && referenceData.cashiers.length > 0) {
          const apiCashier = referenceData.cashiers[0];
          setCurrentUser({
              id: apiCashier.id,
              name: apiCashier.name,
              role: 'CASHIER',
              cashOffice: apiCashier.cashOfficeId || 'Unknown',
              float: apiCashier.float
          });
      }
  }, [referenceData.cashiers, platinumUser]);

  // Derived state (Logic extracted to pos-logic.ts)
  const { totalToPay, tenderTotal, changeDue } = calculateTransactionTotals(items, payment);
  
  // Determine active transaction type (Logic extracted to pos-logic.ts)
  const activeTransactionType = determineTransactionType(items, viewingItemId);

  const isPaymentOptionAllowed = useMemo(() => {
    return (transactionType: TransactionType): boolean => {
      if (allowedPaymentOptions.length === 0) return true;
      const optionId = mapTransactionTypeToPaymentOptionId(transactionType);
      if (optionId === null) return true;
      const option = allowedPaymentOptions.find(o => o.posPaymentOption_ID === optionId);
      if (!option) {
        if (paymentOptionsSource === 'platinum') {
          console.warn(`[PaymentOptions] Option ${optionId} (${transactionType}) not found in Platinum options — BLOCKED`);
          return false;
        }
        return true;
      }
      return option.isTicked && option.enabled;
    };
  }, [allowedPaymentOptions, paymentOptionsSource]);

  const isPaymentTypeAllowed = useMemo(() => {
    return (typeId: number): boolean => {
      if (allowedPaymentTypes.length === 0) return true;
      const pt = allowedPaymentTypes.find(t => t.posPaymentType_ID === typeId);
      if (!pt) {
        if (paymentTypesSource === 'platinum') {
          console.warn(`[PaymentTypes] Type ${typeId} not found in Platinum types — BLOCKED`);
          return false;
        }
        return false;
      }
      return pt.isTicked && pt.enabled;
    };
  }, [allowedPaymentTypes, paymentTypesSource]);

  const switchUser = (cashierId: string, name?: string, cashOffice?: string) => {
      // Try to find in API cashiers first
      const apiCashier = referenceData.cashiers.find(c => c.id === cashierId);
      
      if (apiCashier) {
          setCurrentUser({
              id: apiCashier.id,
              name: name || apiCashier.name,
              role: 'CASHIER',
              cashOffice: cashOffice || apiCashier.cashOfficeId || 'Unknown',
              float: apiCashier.float
          });
          resetSession();
          return;
      }

      // Accept direct Platinum cashier ID with name
      setCurrentUser(prev => ({
          ...prev,
          id: cashierId,
          name: name || prev.name,
          cashOffice: cashOffice || prev.cashOffice,
          role: 'CASHIER',
      }));
      resetSession();
  };

  const resetSession = () => {
      setItems([]);
      setSearchQuery('');
      setDayEndStatus('OPEN');
      setDayEndReturnReason('');
      setRecentTransactions([]);
      setPayment({ cash: 0, card: 0, cardReference: '' });
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'desktop' ? 'mobile' : 'desktop');
  };

  const updateSystemSettings = (settings: Partial<typeof systemSettings>) => {
      setSystemSettings(prev => ({ ...prev, ...settings }));
  };

  const startSession = async (officeId: string, floatAmount: number, officeName?: string) => {
      setActiveSession(true);
      setSessionLoading(false);
      setSessionDetails({
          startTime: Date.now(),
          officeId,
          officeDesc: officeName || '',
          floatAmount
      });
      console.log(`[startSession] Session started - officeId: ${officeId}, float: ${floatAmount}, office: ${officeName}`);
  };

  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSessionViaApi = useCallback(async () => {
    if (!platinumUser?.user_ID) return;
    try {
      const userId = platinumUser.user_ID;
      const finYear = platinumUser.finYear || '2025/2026';
      let result: any;
      try {
        result = await platinumValidateCashier(userId, finYear);
      } catch (e: any) {
        console.error(`[SessionEnforcement] validate-cashier API failed — ending session`, e);
        setActiveSession(false);
        setSessionDetails(undefined);
        toast({
          title: "Session Error",
          description: "Unable to verify your session with the billing system. Your session has been ended.",
          variant: "destructive"
        });
        return;
      }
      const isActive = result?.cashier?.isActive === true;
      setApiSessionActive(isActive);
      if (!isActive) {
        console.warn(`[SessionEnforcement] validate-cashier returned isActive=${result?.cashier?.isActive} — session is no longer active (POS_Cashier.IsActive != 1). Ending session.`);
        setActiveSession(false);
        setSessionDetails(undefined);
        toast({
          title: "Session Ended",
          description: "Your cashier session is no longer active in the billing system. Please set up a new session.",
          variant: "destructive"
        });
      } else {
        console.log(`[SessionEnforcement] validate-cashier confirmed isActive=true (POS_Cashier.IsActive=1)`);
      }
    } catch (e) {
      console.error(`[SessionEnforcement] Failed to check validate-cashier:`, e);
    }
  }, [platinumUser?.user_ID, platinumUser?.finYear, toast]);

  useEffect(() => {
    if (activeSession && platinumUser?.user_ID) {
      sessionPollRef.current = setInterval(checkSessionViaApi, 30000);
    }
    return () => {
      if (sessionPollRef.current) clearInterval(sessionPollRef.current);
    };
  }, [activeSession, platinumUser?.user_ID, checkSessionViaApi]);

  const endSession = async () => {
      if (dayEndStatus !== 'RECONCILED') {
          toast({
              title: "Cannot End Session",
              description: "Your session cannot be ended until day-end reconciliation has been completed and approved. Please complete the day-end process first.",
              variant: "destructive",
          });
          return;
      }
      setActiveSession(false);
      setSessionDetails(undefined);
      setPlatinumCashierId(null);
  };

  const updateOfficeLimit = (officeId: string, limit: number) => {
      setOfficeLimits(prev => ({ ...prev, [officeId]: limit }));
  };

  const addItem = (item: TransactionItem, allowDuplicates: boolean = false) => {
     if (!isPaymentOptionAllowed(item.type)) {
        const optionId = mapTransactionTypeToPaymentOptionId(item.type);
        const optionName = allowedPaymentOptions.find(o => o.posPaymentOption_ID === optionId)?.posPaymentOptionDesc || item.type;
        toast({
            title: "Function Not Allowed",
            description: `${optionName} is not enabled for your cashier profile. Contact your supervisor to update your payment options.`,
            variant: "destructive"
        });
        return;
     }

     setItems(prev => {
        if (prev.find(i => i.id === item.id)) return prev;
        
        if (!allowDuplicates && (item.type === 'CONSUMER_SERVICES' || item.type === 'PREPAID')) {
            const existing = prev.find(i => 
                (i.type === 'CONSUMER_SERVICES' || i.type === 'PREPAID') && 
                i.reference === item.reference
            );
            
            if (existing) {
                toast({
                    title: "Duplicate Item",
                    description: `Account/Meter ${item.reference} is already in the transaction.`,
                    variant: "destructive"
                });
                return prev;
            }
        }
        
        return [...prev, item];
     });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (viewingItemId === id) setViewingItemId(null);
  };

  const updateItemAmount = (id: string, amount: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, amountToPay: amount } : i));
  };

  const updateItemDetails = (id: string, details: Partial<TransactionItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...details } : i));
  };
  
  const setViewingItem = (id: string | null) => {
      setViewingItemId(id);
  }

  const setPaymentAmount = (type: 'cash' | 'card', amount: number) => {
    setPayment(prev => ({ ...prev, [type]: amount }));
  };

  const setCardReference = (ref: string) => {
    setPayment(prev => ({ ...prev, cardReference: ref }));
  };

  const clearTransaction = () => {
    setItems([]);
    setPayment({ cash: 0, card: 0, cardReference: '' });
    setSearchQuery('');
    setViewingItemId(null);
  };

  const updateRecordReceiptNumber = (record: TransactionRecord, newReceiptNumber: string) => {
    record.receiptNumber = newReceiptNumber;
    setRecentTransactions(prev => {
      const idx = prev.findIndex(t => t.id === record.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...record };
        return updated;
      }
      return prev;
    });
  };

  const completeTransaction = async () => {
    if (!activeSession || !sessionDetails) {
        toast({
            title: "No Active Session",
            description: "You must have an active cashier session before processing payments. Please set up your session first.",
            variant: "destructive",
        });
        return;
    }

    const sessionUserId = Number(currentUser.id);
    const sessionOfficeId = sessionDetails.officeId ? Number(sessionDetails.officeId) : 0;
    const sessionOfficeDesc = sessionDetails.officeDesc || currentUser.cashOffice || '';

    if (!sessionUserId || sessionUserId === 0) {
        toast({
            title: "Invalid Session",
            description: "Could not determine the cashier user ID from the active session.",
            variant: "destructive",
        });
        return;
    }

    console.log(`[Payment] Active session context — userId: ${sessionUserId}, officeId: ${sessionOfficeId}, office: ${sessionOfficeDesc}, platinumCashierId: ${platinumCashierId}, float: ${sessionDetails.floatAmount}`);

    if (payment.cash > 0 && !isPaymentTypeAllowed(1)) {
        toast({ title: "Payment Method Not Allowed", description: "Cash payments are not enabled for your profile. Contact your supervisor.", variant: "destructive" });
        return;
    }
    if (payment.card > 0 && !isPaymentTypeAllowed(3)) {
        toast({ title: "Payment Method Not Allowed", description: "Credit Card payments are not enabled for your profile. Contact your supervisor.", variant: "destructive" });
        return;
    }

    let resolvedFinYear = platinumUser?.finYear || '2025/2026';
    if (!resolvedFinYear || resolvedFinYear === '2025/2026') {
        try {
            resolvedFinYear = await fetchActiveFinYear();
        } catch (e) {
            console.warn("[Payment] Failed to fetch active fin year for receipt range validation, using default");
        }
    }
    const receiptOfficeId = sessionDetails?.officeId ? Number(sessionDetails.officeId) : undefined;
    console.log(`[Payment] Validating receipt range — userId=${sessionUserId}, cashierId=${platinumCashierId}, finYear=${resolvedFinYear}, officeId=${receiptOfficeId}`);
    const receiptRangeResult = await validateReceiptRange(sessionUserId, platinumCashierId || undefined, resolvedFinYear, receiptOfficeId);
    if (!receiptRangeResult.valid) {
        console.warn(`[Payment] Receipt range validation FAILED:`, receiptRangeResult.reason);
        toast({
            title: "Receipt Range Invalid",
            description: receiptRangeResult.reason || "Your cashier session is not properly set up for receipt allocation. Please complete cashier setup.",
            variant: "destructive"
        });
        return;
    }
    console.log(`[Payment] Receipt range valid — cashier active at ${receiptRangeResult.officeName}, POS record ${receiptRangeResult.cashierDetailsId}`);

    const record = createTransactionRecord(items, totalToPay, payment, currentUser.id, {
        cashierName: currentUser.name,
        cashOfficeName: sessionOfficeDesc,
    });
    
    setRecentTransactions(prev => [record, ...prev]);
    setCurrentTransactionId(record.id);
    setIsReceiptModalOpen(true);
    setTransactionProcessing(true);

    const finYear = resolvedFinYear;
    console.log(`[Priority 1] Using finYear: ${finYear} (platinumUser: ${platinumUser?.finYear})`);

    const isSplitPayment = record.payment.cash > 0 && record.payment.card > 0;
    const saDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
    const saTime = String(saDate.getHours()).padStart(2, '0') + ':' +
        String(saDate.getMinutes()).padStart(2, '0') + ':' +
        String(saDate.getSeconds()).padStart(2, '0');
    const selectedDatePart = receiptDate || getSADateString();
    const formattedReceiptDate = selectedDatePart + 'T' + saTime;
    console.log(`[Payment] Using receipt date: ${formattedReceiptDate} (selected date: ${receiptDate}, current time: ${saTime})`);

    const accountItems = record.items.filter(item =>
        item.type === 'CONSUMER_SERVICES' || item.type === 'MULTI_ACCOUNT' || item.type === 'ACCOUNT_GROUP'
    );
    const clearanceItems = record.items.filter(item => item.type === 'CLEARANCE');
    const directIncomeItems = record.items.filter(item => item.type === 'DIRECT_INCOME');
    const electricityPrepaidItems = record.items.filter(item =>
        item.type === 'PREPAID' && (item.originalData?.prepaidType === 'Electricity' || !item.originalData?.prepaidType)
    );
    const waterPrepaidItems = record.items.filter(item =>
        item.type === 'PREPAID' && item.originalData?.prepaidType === 'Water'
    );

    let finalReceiptNumber = '';
    record.splitReceipts = [];

    const accountTotal = accountItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const clearanceTotal = clearanceItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const directIncomeTotal = directIncomeItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const prepaidTotal = electricityPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0)
        + waterPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const grandTotal = record.totalAmount;

    for (const item of accountItems) {
        const origOutstanding = item.originalData?.outstandingAmount ?? item.originalData?.outStandingAmt ?? item.originalData?._rawSearchResult?.outStandingAmt ?? 'N/A';
        console.log(`[AMOUNT TRACE] Account item "${item.reference}": amountToPay=R${item.amountToPay}, amountDue=R${item.amountDue}, originalData.outstandingAmount=R${origOutstanding}`);
        if (item.amountToPay === origOutstanding && item.amountToPay !== item.amountDue) {
            console.warn(`[AMOUNT TRACE WARNING] amountToPay equals full outstanding — user may not have changed the amount!`);
        }
    }
    console.log(`[AMOUNT TRACE] accountTotal=R${accountTotal}, grandTotal=R${grandTotal}, record.totalAmount=R${record.totalAmount}`);
    const totalTender = record.payment.cash + record.payment.card;
    const totalChange = Math.max(0, totalTender - grandTotal);

    const groupTotals = [
        { key: 'ACC', total: accountTotal },
        { key: 'CLR', total: clearanceTotal },
        { key: 'INC', total: directIncomeTotal },
        { key: 'PREPAID', total: prepaidTotal },
    ].filter(g => g.total > 0);

    const isMixedBasket = groupTotals.length > 1;

    const groupTenders: Record<string, number> = {};
    const groupChanges: Record<string, number> = {};

    if (!isMixedBasket) {
        const key = groupTotals[0]?.key || 'ACC';
        groupTenders[key] = totalTender;
        groupChanges[key] = totalChange;
    } else {
        let allocatedTender = 0;
        for (let i = 0; i < groupTotals.length; i++) {
            const g = groupTotals[i];
            if (i < groupTotals.length - 1) {
                const tender = Math.round((g.total / grandTotal) * totalTender * 100) / 100;
                groupTenders[g.key] = tender;
                groupChanges[g.key] = Math.max(0, Math.round((tender - g.total) * 100) / 100);
                allocatedTender += tender;
            } else {
                const tender = Math.round((totalTender - allocatedTender) * 100) / 100;
                groupTenders[g.key] = tender;
                groupChanges[g.key] = Math.max(0, Math.round((tender - g.total) * 100) / 100);
            }
        }
    }

    const accTender = groupTenders['ACC'] ?? 0;
    const accChange = groupChanges['ACC'] ?? 0;
    const clrTender = groupTenders['CLR'] ?? 0;
    const clrChange = groupChanges['CLR'] ?? 0;
    const incTender = groupTenders['INC'] ?? 0;
    const incChange = groupChanges['INC'] ?? 0;

    console.log(`[Payment Split] Grand total: R${grandTotal}, Tender: R${totalTender}, Change: R${totalChange}`);
    console.log(`[Payment Split] ACC portion: R${accountTotal} (tender: R${accTender}, change: R${accChange})`);
    console.log(`[Payment Split] CLR portion: R${clearanceTotal} (tender: R${clrTender}, change: R${clrChange})`);
    console.log(`[Payment Split] INC portion: R${directIncomeTotal} (tender: R${incTender}, change: R${incChange})`);
    console.log(`[Payment Split] Prepaid portion: R${prepaidTotal}`);
    if (isSplitPayment) {
        console.log(`[Payment Split] SPLIT PAYMENT detected: Cash R${record.payment.cash} + Card R${record.payment.card} — will create separate receipts`);
    }

    try {
        const finYear = platinumUser?.finYear || '2025/2026';
        const sessionResult = await platinumValidateCashier(sessionUserId, finYear).catch(() => null);
        if (sessionResult) {
            const isStillActive = sessionResult?.cashier?.isActive === true;
            console.log(`[Payment] validate-cashier pre-payment check — isActive: ${isStillActive} (POS_Cashier.IsActive=${sessionResult?.cashier?.isActive})`);
            if (!isStillActive) {
                console.error(`[Payment] Session is NOT active (POS_Cashier.IsActive != 1) for userId ${sessionUserId}. BLOCKING payment.`);
                setActiveSession(false);
                setSessionDetails(undefined);
                toast({
                    title: "Session Expired",
                    description: "Your cashier session is no longer active. Please restart your session from the setup screen.",
                    variant: "destructive",
                });
                setTransactionProcessing(false);
                setIsReceiptModalOpen(false);
                setRecentTransactions(prev => prev.filter(t => t.id !== record.id));
                return;
            }
        } else {
            console.error(`[Payment] validate-cashier returned null — BLOCKING payment (cannot verify session)`);
            toast({
                title: "Session Verification Failed",
                description: "Unable to verify your session with the billing system. Please try again.",
                variant: "destructive",
            });
            setTransactionProcessing(false);
            setIsReceiptModalOpen(false);
            return;
        }
    } catch (e: any) {
        console.error(`[Payment] Failed to call validate-cashier before payment:`, e?.message || e);
        toast({
            title: "Session Verification Failed",
            description: "Unable to verify your session. Please check your connection and try again.",
            variant: "destructive",
        });
        setTransactionProcessing(false);
        setIsReceiptModalOpen(false);
        return;
    }

    const extractReceiptIds = (result: any): number[] => {
        if (result?.ids && Array.isArray(result.ids) && result.ids.length > 0) {
            return result.ids.map(Number);
        } else if (Array.isArray(result)) {
            return result
                .map((r: any) => r.receiptID || r.receiptId || r.id)
                .filter((id: any) => id != null)
                .map(Number);
        } else if (result && typeof result === 'object') {
            const rid = result.receiptID || result.receiptId || result.id;
            if (rid != null) return [Number(rid)];
        }
        return [];
    };

    const serviceBalanceMap = new Map<string, ServiceBalance[]>();
    for (const item of accountItems) {
        const acct = item.originalData as any;
        const acctId = acct?.apiId || acct?.account_ID || acct?.accountID || acct?.accountId || '';
        if (!acctId) continue;
        if (acct?.agingBreakdown && Array.isArray(acct.agingBreakdown) && acct.agingBreakdown.length > 0) {
            const balances: ServiceBalance[] = acct.agingBreakdown
                .filter((row: any) => Math.abs(row.totalOutstanding || 0) >= 0.01)
                .map((row: any) => ({
                    serviceDescription: row.totalOutstanding < 0 && row.serviceDescription === 'Balance B/F' ? 'Advance Payment' : (row.serviceDescription || 'Unknown'),
                    amount: row.totalOutstanding || 0,
                    vat: 0,
                    totalAmount: row.totalOutstanding || 0,
                    currentCharge: row.newCharge || 0,
                    openingBalance: 0,
                }));
            if (balances.length > 0) {
                serviceBalanceMap.set(String(acctId), balances);
                console.log(`[Priority 1] Pre-payment service balances for ${acctId} (from cart data):`, balances.map(b => `${b.serviceDescription}: ${b.totalAmount}`));
            }
        }
        if (!serviceBalanceMap.has(String(acctId))) {
            try {
                const balData = await enquiryGetAccountBalance(acctId);
                let rows: any[] = [];
                if (Array.isArray(balData)) rows = balData;
                else if (balData?.results && Array.isArray(balData.results)) rows = balData.results;
                else if (balData && typeof balData === 'object') rows = [balData];
                const balances: ServiceBalance[] = rows
                    .filter((row: any) => Math.abs(row.totalOutStanding || row.totalOutstanding || 0) >= 0.01)
                    .map((row: any) => ({
                        serviceDescription: row.serviceDescription || row.description || 'Unknown',
                        amount: row.totalOutStanding || row.totalOutstanding || 0,
                        vat: 0,
                        totalAmount: row.totalOutStanding || row.totalOutstanding || 0,
                        currentCharge: 0,
                        openingBalance: 0,
                    }));
                if (balances.length > 0) {
                    serviceBalanceMap.set(String(acctId), balances);
                    console.log(`[Priority 1] Pre-payment service balances for ${acctId} (from API):`, balances.map(b => `${b.serviceDescription}: ${b.totalAmount}`));
                }
            } catch (e) {
                console.warn(`[Priority 1] Failed to fetch pre-payment service balances for ${acctId}`, e);
            }
        }
    }

    const processAccReceiptResult = async (receiptIds: number[], paymentLabel: string, paymentType: 'cash' | 'card', paymentAmount: number, perAccountAmounts?: { accountId: string; accountName: string; amount: number }[]) => {
        if (receiptIds.length === 0) {
            console.warn(`[Priority 1 ${paymentLabel}] No receipt IDs returned — receipt print skipped`);
            return;
        }

        const receiptDataResults = await Promise.all(
            receiptIds.map(rid =>
                fetchPosMultiReceiptPrint(String(rid)).catch(e => {
                    console.warn(`[Priority 1 ${paymentLabel}] Could not fetch multi-receipt-print for ${rid}`, e);
                    return [] as any[];
                })
            )
        );

        const uniqueAccountIds = new Set<string>();
        for (let rIdx = 0; rIdx < receiptIds.length; rIdx++) {
            const receiptData = receiptDataResults[rIdx];
            if (receiptData?.length > 0) {
                const acctId = receiptData[0].accountId;
                if (acctId) uniqueAccountIds.add(acctId);
            }
            const matched = perAccountAmounts?.[rIdx];
            if (matched?.accountId) uniqueAccountIds.add(matched.accountId);
        }

        for (let rIdx = 0; rIdx < receiptIds.length; rIdx++) {
            const rid = receiptIds[rIdx];
            let receiptNo = `REC-${rid}`;
            let receiptDetail: any = null;
            let acctId = '';
            let acctName = '';

            const receiptData = receiptDataResults[rIdx];
            if (receiptData && receiptData.length > 0) {
                const rd = receiptData[0];
                if (rd.receiptNo) receiptNo = rd.receiptNo;
                acctId = rd.accountId || '';
                acctName = rd.accName || '';

                const lineItems = receiptData.map((row: any) => ({
                    description: row.billType || 'Cash',
                    amount: row.tenderAmount ?? row.amount ?? 0,
                    vatAmount: row.vatAmount ?? 0,
                }));

                const paymentTypeLabel = rd.paymentTypeId === 1 ? 'Cash' : rd.paymentTypeId === 3 ? 'Credit Card' : rd.paymentTypeId === 2 ? 'Cheque' : rd.paymentTypeId === 4 ? 'Postal Order' : 'Cash';

                receiptDetail = {
                    receiptNo: rd.receiptNo,
                    cashierName: rd.cashierName,
                    cashOffice: rd.cashOfficeName,
                    tenderAmount: rd.tenderAmount,
                    changeAmount: rd.changeAmount,
                    outstandingAmount: rd.outstandingAmount,
                    paymentType: paymentTypeLabel,
                    paymentOption: rd.payMode || 'Consumer Services',
                    accountId: rd.accountId,
                    oldAccountCode: rd.oldAccountCode,
                    sgNumber: rd.sgNumber,
                    accAddress: rd.accAddress,
                    accName: rd.accName,
                    receiptDate: rd.receiptDate,
                    paymentDate: rd.paymentDate,
                    isCancelled: rd.isCancelled,
                    lineItems,
                };
                console.log(`[Priority 1 ${paymentLabel}] Receipt ${receiptNo} for account ${acctId} (${acctName}), ${lineItems.length} line items`);
            }

            if (!finalReceiptNumber) {
                finalReceiptNumber = receiptNo;
                updateRecordReceiptNumber(record, finalReceiptNumber);
            }

            const matchedPerAcct = perAccountAmounts?.[rIdx];
            const perAccountAmount = matchedPerAcct?.amount ?? (receiptIds.length > 1
                ? Math.round((paymentAmount / receiptIds.length) * 100) / 100
                : paymentAmount);
            const splitEntry: SplitReceipt = {
                receiptNumber: receiptNo,
                receiptId: rid,
                paymentType,
                amount: receiptDetail?.tenderAmount ?? perAccountAmount,
                accountId: acctId || matchedPerAcct?.accountId || '',
                accountName: acctName || matchedPerAcct?.accountName || '',
            };

            if (receiptDetail) {
                splitEntry.receiptDetail = receiptDetail;
            }

            const resolvedAcctId = acctId || matchedPerAcct?.accountId || '';

            record.splitReceipts!.push(splitEntry);

            if (receiptDetail && !record.receiptDetail) {
                record.receiptDetail = receiptDetail;
            }

            console.log(`[Priority 1 ${paymentLabel}] Receipt ${receiptNo} added to split receipts (account: ${resolvedAcctId})`);
        }
    };

    try {
    // --- PRIORITY 1: Consumer Services / Account Payments ---
    if (accountItems.length > 0) {
        const buildAccountPayload = (item: typeof accountItems[0]) => {
            const raw = item.originalData?._rawSearchResult;
            const orig = raw ? { ...item.originalData, ...raw } : (item.originalData || {});
            const acctId = Number(orig.account_ID || orig.apiId || orig.accountID || orig.accountId);
            const fullOutstanding = orig.outStandingAmt ?? orig.outstandingAmount ?? orig.balance ?? 0;
            return {
                isSelected: true,
                account_ID: acctId,
                accountNumber: orig.accountNumber || '',
                statusDesc: orig.statusDesc || 'Active',
                accountDesc: orig.accountDesc || '',
                name: orig.name || orig.accountHolder || item.reference || '',
                deliveryAddress: orig.deliveryAddress || orig.address || '',
                erfNumber: orig.erfNumber || orig.sgNo || '',
                town: orig.town || '',
                streetName: orig.streetName || '',
                activeServices: orig.activeServices ?? 0,
                closedServices: orig.closedServices ?? 0,
                typeOfUseDesc: orig.typeOfUseDesc || '',
                zoneDesc: orig.zoneDesc || '',
                outStandingAmt: fullOutstanding,
                billId: orig.billId || null,
                certificateNo: orig.certificateNo || '',
                clearance_ID: orig.clearance_ID ?? 0,
                clearanceAmount: orig.clearanceAmount ?? 0,
                clearanceSellDate: orig.clearanceSellDate || null,
                clearanceScheduleCost: orig.clearanceScheduleCost ?? 0,
                clearanceTotalCost: orig.clearanceTotalCost ?? 0,
                clearancePaidAmount: orig.clearancePaidAmount ?? 0,
                miscServiceType: orig.miscServiceType || '',
                miscDate: orig.miscDate || null,
                miscDescription: orig.miscDescription || '',
                miscAmount: orig.miscAmount ?? 0,
                deposit: orig.deposit ?? 0,
                cutOffAmount: orig.cutOffAmount ?? 0,
                cutOffID: orig.cutOffID ?? 0,
                debtAmount: orig.debtAmount ?? 0,
                debtArrangementId: orig.debtArrangementId ?? 0,
                instituationID: orig.instituationID ?? 0,
                instituationDeptID: orig.instituationDeptID ?? 0,
                clearance: orig.clearance || '',
                physicalMeterNo: orig.physicalMeterNo || '',
                oldAccountCode: orig.oldAccountCode || '',
                billingCycleId: orig.billingCycleId ?? 1,
                id: orig.id ?? 1,
                sundryDebtorsId: orig.sundryDebtorsId ?? null,
                _userAmountToPay: item.amountToPay,
            };
        };

        const saveAccounts = accountItems
            .filter(item => item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID)
            .map(item => buildAccountPayload(item));

        for (const acct of saveAccounts) {
            console.log(`[Priority 1 AMOUNT CHECK] Account ${acct.account_ID}: _userAmountToPay=R${acct._userAmountToPay}, fullOutstanding(outStandingAmt)=R${acct.outStandingAmt}`);
        }

        const stagingPayload = saveAccounts.map(acct => {
            const { _userAmountToPay, ...rest } = acct;
            return { ...rest, outStandingAmt: _userAmountToPay };
        });

        console.log(`[Priority 1] Staging payload outStandingAmt (user amount): R${stagingPayload[0]?.outStandingAmt}, full outstanding: R${saveAccounts[0]?.outStandingAmt}, user amountToPay: R${saveAccounts[0]?._userAmountToPay}`);

        const isSingleAccount = accountItems.length === 1;

        if (saveAccounts.length > 0) {
            if (!isSplitPayment) {
                try {
                    await platinumSaveMultipleAccountPayment(stagingPayload, { userId: String(sessionUserId) });
                    console.log(`[Priority 1] Saved ${stagingPayload.length} account(s) for payment (userId: ${sessionUserId})`);
                } catch (e) {
                    console.warn(`[Priority 1] Failed to save multiple account payment`, e);
                }

                let serverAccounts: any[] | null = null;
                try {
                    const serverData = await platinumGetMultipleAccountPayment({ userId: String(sessionUserId) });
                    if (Array.isArray(serverData) && serverData.length > 0) {
                        serverAccounts = serverData;
                        console.log(`[Priority 1] Fetched ${serverAccounts.length} server-enriched account(s)`);
                    }
                } catch (e) {
                    console.warn(`[Priority 1] Failed to fetch server accounts, falling back to local data`, e);
                }
            } else {
                console.log(`[Priority 1] Skipping initial staging for split payment — each portion will stage separately`);
            }

            const submitConsumerPayments = async (
                paymentAmount: number,
                tenderAmt: number,
                changeAmt: number,
                paymentTypeId: number,
                paymentOptionId: number,
                label: string,
                paymentAmountOverride?: number,
            ) => {
                const accountsToSubmit = saveAccounts;
                const allReceiptIds: number[] = [];

                const perAccountPayments: { acct: any; localItem: any; itemPayment: number; acctOutstanding: number }[] = [];
                for (let i = 0; i < accountsToSubmit.length; i++) {
                    const acct = accountsToSubmit[i];
                    const localItem = accountItems.find(
                        item => String(item.originalData?.account_ID ?? item.originalData?.accountID ?? item.originalData?.apiId) === String(acct.account_ID)
                    ) || accountItems[i];
                    const userEnteredAmount = acct._userAmountToPay ?? localItem?.amountToPay ?? 0;
                    const itemPayment = paymentAmountOverride !== undefined
                        ? Math.round((userEnteredAmount / accountTotal) * paymentAmountOverride * 100) / 100
                        : userEnteredAmount;
                    const acctOutstanding = acct.outStandingAmt ?? localItem?.originalData?.outStandingAmt ?? localItem?.originalData?.outstandingAmount ?? 0;
                    console.log(`[Priority 1 SUBMIT] Account ${acct.account_ID}: userEnteredAmount=R${userEnteredAmount}, itemPayment=R${itemPayment}, fullOutstanding=R${acctOutstanding}, paymentAmountOverride=${paymentAmountOverride}`);
                    if (itemPayment !== userEnteredAmount && paymentAmountOverride === undefined) {
                        console.warn(`[Priority 1 SUBMIT WARNING] itemPayment (R${itemPayment}) differs from userEnteredAmount (R${userEnteredAmount}) — this should not happen for non-split payments!`);
                    }
                    perAccountPayments.push({ acct, localItem, itemPayment, acctOutstanding });
                }

                if (paymentAmountOverride !== undefined && perAccountPayments.length > 1) {
                    const pSum = perAccountPayments.reduce((s, p) => s + p.itemPayment, 0);
                    const pDelta = Math.round((paymentAmountOverride - pSum) * 100) / 100;
                    if (pDelta !== 0) {
                        perAccountPayments[perAccountPayments.length - 1].itemPayment =
                            Math.round((perAccountPayments[perAccountPayments.length - 1].itemPayment + pDelta) * 100) / 100;
                    }
                }

                for (let i = 0; i < perAccountPayments.length; i++) {
                    const { acct, itemPayment, acctOutstanding } = perAccountPayments[i];

                    const isCardPayment = paymentTypeId === 3;
                    const requestModel = {
                        finYear,
                        receiptDate: formattedReceiptDate,
                        totalAmount: itemPayment,
                        tenderAmount: i === 0 ? tenderAmt : itemPayment,
                        changeAmount: i === 0 ? changeAmt : 0,
                        paymentType: paymentTypeId,
                        paymentOption: paymentOptionId,
                        outStandingAmount: itemPayment,
                        cardNumber: isCardPayment ? (record.payment.cardReference || '') : '',
                        expiryDate: '',
                        chequeNumber: '',
                        chequeDate: null,
                        processingMonth: null,
                        accountHolderName: acct.name || '',
                        bankName: '',
                        bankBranchCode: '',
                        cutOffID: acct.cutOffID ?? 0,
                        debtArrangementId: acct.debtArrangementId ?? 0,
                        cutOffAmount: acct.cutOffAmount ?? 0,
                        debtAmount: acct.debtAmount ?? 0,
                        sundryDebtorsId: acct.sundryDebtorsId ?? null,
                        apiTransactionID: 0,
                        isReconciled: 0,
                        isCancelled: 0,
                    };

                    console.log(`[Priority 1 ${label}] Submitting consumer payment for account ${acct.account_ID} (${acct.name}), PAYMENT amount: R${itemPayment}, full outstanding: R${acctOutstanding}, requestModel.totalAmount: R${requestModel.totalAmount}, requestModel.outStandingAmount: R${requestModel.outStandingAmount}, paymentType: ${paymentTypeId}, cardNumber: "${requestModel.cardNumber}"`);

                    const { _userAmountToPay: _, ...submitAccount } = acct;
                    submitAccount.outStandingAmt = itemPayment;
                    console.log(`[Priority 1 ${label}] submitAccount.outStandingAmt set to payment amount: R${submitAccount.outStandingAmt} (matches staged amount, requestModel.totalAmount: R${itemPayment})`);
                    const result = await submitConsumerPayment(sessionUserId, {
                        account: submitAccount,
                        requestModel,
                    });
                    console.log(`[Priority 1 ${label}] submit-consumer-payment response for account ${acct.account_ID}:`, result);
                    if (result && result.isSuccess === false) {
                        throw new Error(result.message || `Payment failed for account ${acct.account_ID}`);
                    }
                    const ids = extractReceiptIds(result);
                    allReceiptIds.push(...ids);
                }

                if (allReceiptIds.length > 0) {
                    try {
                        await platinumPrintReceipt(allReceiptIds);
                        console.log(`[Priority 1 ${label}] print-receipt called for IDs: ${allReceiptIds.join(', ')}`);
                    } catch (e) {
                        console.warn(`[Priority 1 ${label}] print-receipt failed (non-critical)`, e);
                    }
                }

                return { isSuccess: true, ids: allReceiptIds, perAccountAmounts: perAccountPayments.map(p => ({ accountId: String(p.acct.account_ID), accountName: p.acct.name || '', amount: p.itemPayment })) };
            };

            if (isSplitPayment) {
                const cashPaid = Math.max(0, record.payment.cash - totalChange);
                const cardPaid = record.payment.card;
                const cashPaidRatio = grandTotal > 0 ? cashPaid / grandTotal : 0;
                const accGroupTotal = isMixedBasket ? accountTotal : grandTotal;
                const accCashActual = Math.round(accGroupTotal * cashPaidRatio * 100) / 100;
                const accCardActual = Math.round((accGroupTotal - accCashActual) * 100) / 100;
                const accCashTender = isMixedBasket ? accCashActual : record.payment.cash;
                const accCashChange = isMixedBasket ? 0 : totalChange;

                console.log(`[Priority 1 SPLIT] ACC total: R${accGroupTotal}, Cash: R${accCashActual} (tender: R${accCashTender}, change: R${accCashChange}), Card: R${accCardActual}`);

                const buildPortionStagingPayload = (portionTotal: number) => {
                    const result = saveAccounts.map(acct => {
                        const { _userAmountToPay, ...rest } = acct;
                        const userAmt = _userAmountToPay;
                        const portionAmt = accGroupTotal > 0
                            ? Math.round((userAmt / accGroupTotal) * portionTotal * 100) / 100
                            : Math.round(portionTotal / saveAccounts.length * 100) / 100;
                        return { ...rest, outStandingAmt: portionAmt };
                    });
                    const summed = result.reduce((s, a) => s + a.outStandingAmt, 0);
                    const delta = Math.round((portionTotal - summed) * 100) / 100;
                    if (delta !== 0 && result.length > 0) {
                        result[result.length - 1].outStandingAmt = Math.round((result[result.length - 1].outStandingAmt + delta) * 100) / 100;
                    }
                    return result;
                };

                try {
                    const cashStagingPayload = buildPortionStagingPayload(accCashActual);
                    console.log(`[Priority 1 SPLIT CASH] Staging ${cashStagingPayload.length} accounts with cash portions`, cashStagingPayload.map(a => `${a.account_ID}: R${a.outStandingAmt}`));
                    await platinumSaveMultipleAccountPayment(cashStagingPayload, { userId: String(sessionUserId) });
                    const cashResult = await submitConsumerPayments(accCashActual, accCashTender, accCashChange, 1, 1, 'CASH', accCashActual);
                    console.log(`[Priority 1 SPLIT CASH] Submitted cash payment`, cashResult);
                    const cashReceiptIds = extractReceiptIds(cashResult);
                    await processAccReceiptResult(cashReceiptIds, 'CASH', 'cash', accCashActual, cashResult.perAccountAmounts);
                } catch (e: any) {
                    console.warn(`[Priority 1 SPLIT CASH] Failed to submit cash payment`, e);
                    toast({ title: "Cash Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                }

                if (accCardActual > 0) {
                    try {
                        const cardStagingPayload = buildPortionStagingPayload(accCardActual);
                        console.log(`[Priority 1 SPLIT CARD] Staging ${cardStagingPayload.length} accounts with card portions`, cardStagingPayload.map(a => `${a.account_ID}: R${a.outStandingAmt}`));
                        await platinumSaveMultipleAccountPayment(cardStagingPayload, { userId: String(sessionUserId) });
                        const cardResult = await submitConsumerPayments(accCardActual, accCardActual, 0, 3, 1, 'CARD', accCardActual);
                        console.log(`[Priority 1 SPLIT CARD] Submitted card payment`, cardResult);
                        const cardReceiptIds = extractReceiptIds(cardResult);
                        await processAccReceiptResult(cardReceiptIds, 'CARD', 'card', accCardActual, cardResult.perAccountAmounts);
                    } catch (e: any) {
                        console.warn(`[Priority 1 SPLIT CARD] Failed to submit card payment`, e);
                        toast({ title: "Card Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                    }
                }
            } else {
                try {
                    const singlePaymentTypeId = record.payment.card > 0 && record.payment.cash === 0 ? 3 : 1;
                    const submitResult = await submitConsumerPayments(accountTotal, accTender, accChange, singlePaymentTypeId, 1, 'ACC');
                    console.log(`[Priority 1] Submitted payment (paymentType=${singlePaymentTypeId})`, submitResult);
                    const receiptIds = extractReceiptIds(submitResult);
                    await processAccReceiptResult(receiptIds, 'SINGLE', record.payment.card > 0 ? 'card' : 'cash', accountTotal);
                } catch (e: any) {
                    console.warn(`[Priority 1] Failed to submit payment`, e);
                    toast({ title: "Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                }
            }

            for (const item of accountItems) {
                const accountId = item.originalData?.account_ID || item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId;
                if (!accountId) continue;
                const latestReceiptId = record.splitReceipts && record.splitReceipts.length > 0
                    ? String(record.splitReceipts[record.splitReceipts.length - 1].receiptId)
                    : record.receiptNumber.replace(/\D/g, '') || '0';

                try {
                    await postMultipleAccountPaymentReceipt(String(sessionUserId), accountId, latestReceiptId);
                    console.log(`[Priority 1] Legacy receipt posted for account ${accountId}`);
                } catch (e) {
                    console.warn(`[Priority 1] Failed to post legacy receipt for account ${accountId}`, e);
                }

                try {
                    await rebuildFullAccount(Number(accountId));
                    console.log(`[Priority 1] Rebuild completed for account ${accountId}`);
                } catch (e) {
                    console.warn(`[Priority 1] Failed to rebuild account ${accountId}`, e);
                }

                try {
                    const consDetails = await platinumGetConsAccountDetails(Number(accountId));
                    if (consDetails && consDetails.outStandingAmt !== undefined) {
                        const updatedOutstanding = consDetails.outStandingAmt;
                        console.log(`[Priority 1] Updated outstanding balance for account ${accountId}: R${updatedOutstanding} (from API)`);

                        if (record.receiptDetail && (String(record.receiptDetail.accountId) === String(accountId))) {
                            record.receiptDetail.outstandingAmount = updatedOutstanding;
                        }

                        for (const sr of (record.splitReceipts || [])) {
                            if (sr.receiptDetail && (String(sr.accountId) === String(accountId) || String(sr.receiptDetail.accountId) === String(accountId))) {
                                sr.receiptDetail.outstandingAmount = updatedOutstanding;
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[Priority 1] Failed to fetch updated outstanding for account ${accountId}`, e);
                }

                let allocations: ReceiptAllocation[] = [];

                const prePaymentBalances = serviceBalanceMap.get(String(accountId));
                if (prePaymentBalances && prePaymentBalances.length > 0) {
                    try {
                        const balanceData = await enquiryGetAccountBalance(accountId);
                        {
                            let rows: any[] = [];
                            if (Array.isArray(balanceData)) rows = balanceData;
                            else if (balanceData?.results && Array.isArray(balanceData.results)) rows = balanceData.results;
                            else if (balanceData && typeof balanceData === 'object') rows = [balanceData];

                            if (rows.length > 0) {
                                const postPaymentMap = new Map<string, number>();
                                for (const row of rows) {
                                    const desc = row.serviceDescription || row.description || 'Unknown';
                                    postPaymentMap.set(desc, row.totalOutStanding || row.totalOutstanding || 0);
                                }

                                for (const pre of prePaymentBalances) {
                                    const postAmount = postPaymentMap.get(pre.serviceDescription) ?? pre.totalAmount;
                                    const allocated = Math.round((pre.totalAmount - postAmount) * 100) / 100;
                                    if (Math.abs(allocated) >= 0.01) {
                                        allocations.push({
                                            service: pre.serviceDescription,
                                            amount: allocated,
                                            vat: 0,
                                            total: allocated,
                                        });
                                    }
                                }
                                if (allocations.length > 0) {
                                    console.log(`[Priority 1] Payment allocations from balance diff for account ${accountId}:`, allocations.map(a => `${a.service}: R${a.amount}`));
                                } else {
                                    console.log(`[Priority 1] No measurable allocations via diff for account ${accountId}, trying receipt PDF`);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`[Priority 1] Failed to compute payment allocations via diff for account ${accountId}`, e);
                    }
                }

                if (allocations.length === 0) {
                    console.log(`[Priority 1] No payment allocations available for account ${accountId} — receipt will show line items only`);
                }

                if (allocations.length > 0) {
                    if (!record.allocations) record.allocations = [];
                    record.allocations.push(...allocations);
                    for (const sr of (record.splitReceipts || [])) {
                        if (String(sr.accountId) === String(accountId) || String(sr.receiptDetail?.accountId) === String(accountId)) {
                            sr.allocations = allocations;
                        }
                    }
                }
            }
        }
    }

    // --- PRIORITY 1B: Clearance Payments ---
    if (clearanceItems.length > 0) {
        const clrGroupTender = isMixedBasket ? clrTender : totalTender;
        const clrGroupChange = isMixedBasket ? clrChange : totalChange;

        for (const item of clearanceItems) {
            const origData = item.originalData || {};
            const clearanceStagingId = origData.clearanceStagingId || origData.clearanceStaging_ID || origData.clearanceId || origData.scheduleNo || item.reference;
            const paidItems = origData.paidItems || [];
            const accountHolderName = item.paidBy || origData.ownerName || origData.linkedAccounts?.[0]?.name || 'Walk-in';

            const submitOneClearance = async (paymentTypeId: number, amount: number, tender: number, change: number, label: string, splitType: 'cash' | 'card') => {
                const clrPayload = {
                    userId: sessionUserId,
                    paymentTypeId,
                    cashierId: platinumCashierId || null,
                    receiptDate: formattedReceiptDate,
                    tenderAmount: tender,
                    changeAmount: change,
                    paidAmount: amount,
                    outstandingAmount: item.amountDue || amount,
                    clearance_ID: String(clearanceStagingId),
                    finYear,
                    accountHolderName,
                    chequeNo: null,
                    bankId: null,
                    branchId: null,
                    cardNo: record.payment.cardReference || null,
                    cardExpiryDate: null,
                    paySection1181Only: origData.paySection1181Only || false,
                    section1181Amount: origData.paySection1181Only ? Math.abs(origData.total1181 || 0) : 0,
                    paidItems: paidItems.map((pi: any) => ({
                        account_ID: pi.account_ID ?? pi.accountID ?? pi.accountId ?? null,
                        accountNumber: pi.accountNumber || pi.accountNo || null,
                        name: pi.name || null,
                        debT_TYPE: pi.debT_TYPE || pi.debtType || null,
                        amount: pi.paymentAmount || pi.amount || 0,
                    })),
                };
                console.log(`[Priority 1B ${label}] Clearance payload for ${clearanceStagingId}:`, JSON.stringify(clrPayload));
                const clrResult = await platinumSubmitClearancePayment(clrPayload);
                console.log(`[Priority 1B ${label}] Submitted clearance payment for ${clearanceStagingId}`, clrResult);

                const clrReceiptIds = extractReceiptIds(clrResult);
                if (clrReceiptIds.length > 0) {
                    let receiptNo = `REC-${clrReceiptIds[0]}`;
                    try {
                        const receiptData = await fetchPosMultiReceiptPrint(String(clrReceiptIds[0]));
                        if (receiptData && receiptData.length > 0 && receiptData[0].receiptNo) {
                            receiptNo = receiptData[0].receiptNo;
                        }
                    } catch (e) {
                        console.warn(`[Priority 1B ${label}] Could not fetch receipt number`, e);
                    }

                    if (!finalReceiptNumber) {
                        finalReceiptNumber = receiptNo;
                        updateRecordReceiptNumber(record, finalReceiptNumber);
                    }

                    const splitEntry: SplitReceipt = { receiptNumber: receiptNo, receiptId: clrReceiptIds[0], paymentType: splitType, amount };

                    try {
                        await platinumPrintReceipt(clrReceiptIds);
                    } catch (e) {
                        console.warn(`[Priority 1B ${label}] Failed to print clearance receipt`, e);
                    }

                    try {
                        const clrAllocs = await fetchReceiptAllocations(String(clrReceiptIds[0]));
                        if (clrAllocs.length > 0) {
                            splitEntry.allocations = clrAllocs;
                            record.allocations = [...(record.allocations || []), ...clrAllocs];
                        }
                    } catch (e) {
                        console.warn(`[Priority 1B ${label}] Could not fetch clearance receipt allocations`, e);
                    }

                    record.splitReceipts!.push(splitEntry);
                    console.log(`[Priority 1B ${label}] Receipt ${receiptNo} added`);
                }
            };

            try {
                const clrTenderForItem = isMixedBasket ? item.amountToPay : clrGroupTender;
                const clrChangeForItem = isMixedBasket ? 0 : clrGroupChange;
                const clrPaymentTypeId = record.payment.card > 0 && record.payment.cash === 0 ? 3 : 1;
                await submitOneClearance(clrPaymentTypeId, item.amountToPay, clrTenderForItem, clrChangeForItem, 'FULL', record.payment.card > 0 ? 'card' : 'cash');
            } catch (e: any) {
                console.warn(`[Priority 1B] Failed to submit clearance payment for ${clearanceStagingId}`, e);
                toast({ title: "Clearance Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
            }

            for (const pi of paidItems) {
                const acctId = pi.account_ID || pi.accountId;
                if (acctId) {
                    try {
                        await rebuildFullAccount(Number(acctId));
                        console.log(`[Priority 1B] Rebuild triggered for account ${acctId}`);
                    } catch (e) {
                        console.warn(`[Priority 1B] Failed to rebuild account ${acctId}`, e);
                    }
                }
            }
        }
    }

    // --- PRIORITY 2: Direct Income / Miscellaneous Payments ---
    if (directIncomeItems.length > 0) {
        const incGroupTender = isMixedBasket ? incTender : totalTender;
        const incGroupChange = isMixedBasket ? incChange : totalChange;

        for (let idx = 0; idx < directIncomeItems.length; idx++) {
            const item = directIncomeItems[idx];
            const origData = item.originalData;
            const groupId = origData?.groupId;
            const scoaItemId = origData?.scoaItemId || origData?.id;
            const vatRate = origData?.vatRate || 15;
            const isVatable = vatRate > 0;
            const amountExVat = isVatable ? item.amountToPay / (1 + vatRate / 100) : item.amountToPay;
            const vatAmount = isVatable ? item.amountToPay - amountExVat : 0;

            if (!groupId || !scoaItemId) {
                console.warn(`[Priority 2] Skipping misc payment for "${item.description}" — missing groupId or scoaItemId`);
                continue;
            }

            const paidByName = (item.paidBy || 'Walk-in').trim();
            const paidByParts = paidByName.split(/\s+/);
            const lastName = paidByParts.length > 1 ? paidByParts.slice(1).join(' ') : paidByParts[0];
            const initials = paidByParts[0]?.charAt(0) || 'W';

            const submitOneMisc = async (paymentTypeId: number, amount: number, tender: number, change: number, label: string, splitType: 'cash' | 'card') => {
                const itemAmtExVat = isVatable ? amount / (1 + vatRate / 100) : amount;
                const itemVat = isVatable ? amount - itemAmtExVat : 0;
                const miscResult = await submitMiscPayment({
                    lastName,
                    initials,
                    miscellaneousPaymentGroup: Number(groupId),
                    scoaItem: Number(scoaItemId),
                    description: item.notes || item.description || origData?.description || '',
                    receiptDate: formattedReceiptDate,
                    totalAmount: amount,
                    vatAmount: Math.round(itemVat * 100) / 100,
                    amount: Math.round(itemAmtExVat * 100) / 100,
                    tenderAmount: tender,
                    changeAmount: change,
                    paymentType: paymentTypeId,
                    vatPercentage: vatRate,
                    isVatable,
                    userId: sessionUserId,
                    finYear,
                    cardNo: record.payment.cardReference || '',
                    expiryDate: '',
                    chequeNo: '',
                });
                console.log(`[Priority 2 ${label}] Submitted misc payment for SCOA item ${scoaItemId}`, miscResult);

                let miscReceiptId: number | null = null;
                if (miscResult?.ids && Array.isArray(miscResult.ids) && miscResult.ids.length > 0) {
                    miscReceiptId = miscResult.ids[0];
                } else {
                    miscReceiptId = miscResult?.receiptID || miscResult?.receiptId || miscResult?.id || null;
                }

                if (miscReceiptId) {
                    let receiptNo = `REC-${miscReceiptId}`;
                    try {
                        const miscReceiptData = await fetchPosMultiReceiptPrint(String(miscReceiptId));
                        if (miscReceiptData && miscReceiptData.length > 0 && miscReceiptData[0].receiptNo) {
                            receiptNo = miscReceiptData[0].receiptNo;
                        }
                    } catch (e) {
                        console.warn(`[Priority 2 ${label}] Could not fetch receipt number`, e);
                    }

                    if (!finalReceiptNumber) {
                        finalReceiptNumber = receiptNo;
                        updateRecordReceiptNumber(record, finalReceiptNumber);
                    }

                    const splitEntry: SplitReceipt = { receiptNumber: receiptNo, receiptId: miscReceiptId, paymentType: splitType, amount };

                    try {
                        await platinumPrintMiscellaneousReceipt({}, { id: String(miscReceiptId) });
                    } catch (e) {
                        console.warn(`[Priority 2 ${label}] Failed to print misc receipt`, e);
                    }

                    try {
                        const miscAllocs = await fetchReceiptAllocations(String(miscReceiptId));
                        if (miscAllocs.length > 0) {
                            splitEntry.allocations = miscAllocs;
                            record.allocations = [...(record.allocations || []), ...miscAllocs];
                        }
                    } catch (e) {
                        console.warn(`[Priority 2 ${label}] Could not fetch misc receipt allocations`, e);
                    }

                    record.splitReceipts!.push(splitEntry);
                    console.log(`[Priority 2 ${label}] Receipt ${receiptNo} added`);
                }
            };

            try {
                if (isSplitPayment) {
                    const cashPaid = Math.max(0, record.payment.cash - totalChange);
                    const cashPaidRatio = grandTotal > 0 ? cashPaid / grandTotal : 0;
                    const itemCash = Math.round(item.amountToPay * cashPaidRatio * 100) / 100;
                    const itemCard = Math.round((item.amountToPay - itemCash) * 100) / 100;
                    const itemCashTender = isMixedBasket ? itemCash : record.payment.cash;
                    const itemCashChange = isMixedBasket ? 0 : totalChange;

                    console.log(`[Priority 2 SPLIT] Item "${item.description}": Cash R${itemCash} (tender R${itemCashTender}), Card R${itemCard}`);

                    await submitOneMisc(1, itemCash, itemCashTender, itemCashChange, 'CASH', 'cash');

                    if (itemCard > 0) {
                        await submitOneMisc(3, itemCard, itemCard, 0, 'CARD', 'card');
                    }
                } else {
                    const miscPaymentTypeId = record.payment.card > 0 && record.payment.cash === 0 ? 3 : 1;
                    await submitOneMisc(miscPaymentTypeId, item.amountToPay, item.amountToPay, 0, 'SINGLE', record.payment.card > 0 ? 'card' : 'cash');
                }
            } catch (e: any) {
                console.warn(`[Priority 2] Failed to submit misc payment for ${item.description}`, e);
                toast({ title: "Direct Income Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
            }
        }
    }

    // --- PRIORITY 3: Electricity Prepaid Recharge ---
    if (electricityPrepaidItems.length > 0) {
        for (const item of electricityPrepaidItems) {
            console.log(`[Priority 3] Electricity prepaid recharge for ${item.reference}, amount: R${item.amountToPay}`);
        }
    }

    // --- PRIORITY 4: Water Prepaid Recharge ---
    if (waterPrepaidItems.length > 0) {
        for (const item of waterPrepaidItems) {
            console.log(`[Priority 4] Water prepaid recharge for ${item.reference}, amount: R${item.amountToPay}`);
        }
    }

    } finally {
        setTransactionProcessing(false);
        setCompletedPaymentSnapshot({
            cashAmount: payment.cash,
            cardAmount: payment.card,
            cardReference: payment.cardReference,
            tenderTotal: payment.cash + payment.card,
            changeDue,
        });
        clearTransaction();
        console.log('[Payment] Transaction complete — receipt modal stays open for user to print/review');
        setTimeout(() => {
            loadTransactionsFromApi().catch(e => 
                console.warn('[Transactions] Background refresh after payment failed:', e)
            );
        }, 2000);
    }
  };
  
  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setCurrentTransactionId(null);
    setCompletedPaymentSnapshot(null);
    clearTransaction();
    loadTransactionsFromApi().catch(() => {});
  };

  const submitDayEnd = (report: { cashOnHand: number, cardTotal: number }) => {
      console.log('Day End Report Submitted:', report);
      setDayEndStatus('RECONCILED'); // In a real app this would go to PENDING_APPROVAL
  };

  const returnDayEnd = (reason: string) => {
      setDayEndStatus('OPEN'); // In real app would be RETURNED status, but here we open it for editing
      setDayEndReturnReason(reason);
  };

  const cancelTransaction = async (id: string, reason: string) => {
      const tx = recentTransactions.find(t => t.id === id);
      if (!tx) return;
      if (tx.isReconciled === 1) return;

      const receiptId = id.startsWith('plt-') ? id.replace('plt-', '') : null;
      const isSupervisor = currentUser.role === 'SUPERVISOR';

      if (receiptId) {
          try {
              if (isSupervisor) {
                  await platinumAuthDayEndCancelReceipt({ receiptId: Number(receiptId), reason });
                  console.log(`[CancelTransaction] Receipt ${receiptId} cancelled directly by supervisor via Platinum API`);
              } else {
                  await platinumRequestCancelReceipt({
                      receiptId: Number(receiptId),
                      reason,
                      userId: platinumUser?.user_ID || Number(currentUser.id),
                  });
                  console.log(`[CancelTransaction] Receipt ${receiptId} cancellation requested via Platinum API`);
              }
          } catch (e: any) {
              console.error('[CancelTransaction] API cancel failed:', e);
              toast({
                  title: "Cancellation Failed",
                  description: e?.message || 'Failed to cancel receipt via API',
                  variant: "destructive",
              });
              return;
          }
      }

      const newStatus: TransactionStatus = isSupervisor ? 'CANCELLED' : 'PENDING_CANCELLATION';

      setRecentTransactions(prev => prev.map(t =>
          t.id === id ? { ...t, status: newStatus, cancellationReason: reason, cancellationRequestTime: Date.now() } : t
      ));

      setTimeout(() => {
          loadTransactionsFromApi().catch(() => {});
      }, 1500);
  };
  
  const approveCancellation = async (id: string, approved: boolean) => {
      const receiptId = id.startsWith('plt-') ? id.replace('plt-', '') : null;

      if (receiptId) {
          try {
              if (approved) {
                  await platinumApproveCancelReceipt({
                      receiptId: Number(receiptId),
                      userId: platinumUser?.user_ID || Number(currentUser.id),
                  });
                  console.log(`[ApproveCancellation] Receipt ${receiptId} approved via Platinum API`);
              } else {
                  await platinumDeclineCancelReceipt({
                      receiptId: Number(receiptId),
                      userId: platinumUser?.user_ID || Number(currentUser.id),
                  });
                  console.log(`[ApproveCancellation] Receipt ${receiptId} declined via Platinum API`);
              }
          } catch (e: any) {
              console.error('[ApproveCancellation] API call failed:', e);
              toast({
                  title: approved ? "Approval Failed" : "Decline Failed",
                  description: e?.message || `Failed to ${approved ? 'approve' : 'decline'} cancellation`,
                  variant: "destructive",
              });
              return;
          }
      }

      setRecentTransactions(prev => prev.map(t =>
          t.id === id ? { ...t, status: approved ? 'CANCELLED' as TransactionStatus : 'COMPLETED' as TransactionStatus } : t
      ));

      setTimeout(() => {
          loadTransactionsFromApi().catch(() => {});
      }, 1500);
  };
  
  return (
    <PosContext.Provider value={{
      currentUser,
      activeTransactionType,
      transactionItems: items,
      // ... (keep payment)
      payment: completedPaymentSnapshot && isReceiptModalOpen ? completedPaymentSnapshot : {
        cashAmount: payment.cash,
        cardAmount: payment.card,
        cardReference: payment.cardReference,
        tenderTotal,
        changeDue
      },
      searchQuery,
      isReceiptModalOpen,
      transactionProcessing,
      currentTransactionId,
      viewingItemId,
      recentTransactions,
      dayEndStatus,
      dayEndReturnReason,
      switchUser,
      setSearchQuery,
      addItem,
      removeItem,
      updateItemAmount,
      updateItemDetails,
      setViewingItem,
      setPaymentAmount,
      setCardReference,
      clearTransaction,
      completeTransaction,
      closeReceiptModal,
      submitDayEnd,
      returnDayEnd,
      cancelTransaction,
      approveCancellation,
      refreshTransactions: () => loadTransactionsFromApi(),
      activeSession,
      sessionLoading,
      startSession,
      endSession,
      sessionDetails,
      platinumCashierId,
      officeLimits,
      updateOfficeLimit,
      currentTransactionLimit,
      allowedPaymentOptions,
      allowedPaymentTypes,
      paymentOptionsSource,
      paymentTypesSource,
      isPaymentOptionAllowed,
      isPaymentTypeAllowed,
      viewMode,
      toggleViewMode,
      systemSettings,
      updateSystemSettings,
      referenceData,
      platinumUser,
      cashierRegistered,
      apiSessionActive,
      receiptDate,
      setReceiptDate
    }}>
      {children}
    </PosContext.Provider>
  );
};
