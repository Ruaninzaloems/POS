import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Account, DirectIncomeItem, ClearanceCostSchedule, AccountGroup, CashOffice } from './mock-data';
import { calculateTransactionTotals, determineTransactionType, createTransactionRecord } from './pos-logic';
import { fetchBanks, fetchGroups, fetchInstitutions, fetchConfigSettings, fetchCashOffices, fetchCashiers, fetchBillingConfig, fetchPlatinumUserInfo, ApiCashier, BillingConfig, PlatinumUserInfo, postMultipleAccountPaymentReceipt, rebuildFullAccount, submitMiscPayment, submitConsumerPayment, submitPrepaidPayment, platinumPrintReceipt, platinumPrintMiscellaneousReceipt, platinumSaveMultipleAccountPayment, platinumGetMultipleAccountPayment, fetchPosMultiReceiptPrint, fetchReceiptAllocations, platinumSubmitClearancePayment, getReceiptTransactionDetail, fetchReceiptList } from './external-api';

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

export interface SplitReceipt {
  receiptNumber: string;
  receiptId: number;
  paymentType: 'cash' | 'card';
  amount: number;
  allocations?: ReceiptAllocation[];
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
    tenderTotal: number;
    changeDue: number;
  };
  searchQuery: string;
  isReceiptModalOpen: boolean;
  transactionProcessing: boolean;
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
  clearTransaction: () => void;
  completeTransaction: () => void;
  closeReceiptModal: () => void;
  setViewingItem: (id: string | null) => void;
  submitDayEnd: (report: { cashOnHand: number, cardTotal: number }) => void;
  returnDayEnd: (reason: string) => void;
  cancelTransaction: (id: string, reason: string) => void;
  approveCancellation: (id: string, approved: boolean) => void;
  refreshTransactions: () => Promise<void>;
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
  const [payment, setPayment] = useState({ cash: 0, card: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [transactionProcessing, setTransactionProcessing] = useState(false);
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
  
  const [officeLimits, setOfficeLimits] = useState<Record<string, number>>({});

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
              const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Reference data loading timed out after 15 seconds')), 15000)
              );
              const dataPromise = Promise.all([
                  fetchBanks(),
                  fetchGroups(),
                  fetchInstitutions(),
                  fetchConfigSettings(),
                  fetchCashOffices(),
                  fetchCashiers(),
                  fetchBillingConfig(),
                  fetchPlatinumUserInfo()
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
        const res = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${platinumUser.user_ID}`);
        if (!res.ok) {
          setCashierRegistered(false);
          setSessionLoading(false);
          return;
        }
        const data = await res.json();
        setCashierRegistered(data.cashierRegistered === true);
        setPlatinumCashierId(data.cashierId || null);
        if (data.cashOnHandLimit && data.officeId) {
          setOfficeLimits(prev => ({ ...prev, [String(data.officeId)]: data.cashOnHandLimit }));
        }
        console.log("Platinum cashier status:", { registered: data.cashierRegistered, isActive: data.isActive, officeId: data.officeId, officeName: data.officeName });
      } catch (e) {
        console.warn("Failed to check active Platinum session", e);
        setCashierRegistered(false);
      } finally {
        setSessionLoading(false);
      }
    };
    checkActiveSession();
  }, [platinumUser]);

  const loadTransactionsFromApi = async (cashierId?: string) => {
    const userId = cashierId || currentUser.id;
    if (!userId || userId === 'CSH-00') return;

    try {
      const today = new Date();
      const fromDate = today.getFullYear() + '-' +
          String(today.getMonth() + 1).padStart(2, '0') + '-' +
          String(today.getDate()).padStart(2, '0') + 'T00:00:00';

      const result = await fetchReceiptList({
        cashierId: userId,
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
            },
            status: r.isCancelled === 1 ? 'CANCELLED' as TransactionStatus : 'COMPLETED' as TransactionStatus,
            cashierId: userId,
            cashierName: r.cashierName || '',
            cashOfficeName: r.cashOffice || '',
            paymentTypeName: r.paymentType || '',
            paymentOptionName: r.paymentOption || '',
            isReconciled: 0,
            cancellationReason: r.cancellationReason || undefined,
          };
        });

        setRecentTransactions(mapped);
        console.log(`[Transactions] Loaded ${mapped.length} transactions from Platinum API for cashier ${userId}`);
      } else {
        setRecentTransactions([]);
        console.log(`[Transactions] No transactions found for cashier ${userId} on ${fromDate}`);
      }
    } catch (e) {
      console.warn('[Transactions] Failed to load transactions from API:', e);
    }
  };

  useEffect(() => {
    if (activeSession && currentUser.id && currentUser.id !== 'CSH-00') {
      loadTransactionsFromApi(currentUser.id);
    }
  }, [activeSession, currentUser.id]);

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
      setPayment({ cash: 0, card: 0 });
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
     setItems(prev => {
        // Prevent duplicates for Accounts/Meters to avoid confusion in prototype
        if (prev.find(i => i.id === item.id)) return prev;
        
        // Prevent duplicate accounts/meters by reference UNLESS allowDuplicates is true
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

  const clearTransaction = () => {
    setItems([]);
    setPayment({ cash: 0, card: 0 });
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

    const record = createTransactionRecord(items, totalToPay, payment, currentUser.id, {
        cashierName: currentUser.name,
        cashOfficeName: sessionOfficeDesc,
    });
    
    setRecentTransactions(prev => [record, ...prev]);
    setIsReceiptModalOpen(true);
    setTransactionProcessing(true);

    let finYear = platinumUser?.finYear || '2025/2026';
    if (!finYear || finYear === '2025/2026') {
        try {
            const res = await fetch('/api/platinum/active-fin-year');
            if (res.ok) {
                const apiFinYear = await res.json();
                if (apiFinYear) finYear = apiFinYear;
            }
        } catch (e) {
            console.warn("Failed to fetch active fin year, using default", e);
        }
    }
    console.log(`[Priority 1] Using finYear: ${finYear} (platinumUser: ${platinumUser?.finYear})`);

    const isSplitPayment = record.payment.cash > 0 && record.payment.card > 0;
    const saDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
    const receiptDate = saDate.getFullYear() + '-' +
        String(saDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(saDate.getDate()).padStart(2, '0') + 'T' +
        String(saDate.getHours()).padStart(2, '0') + ':' +
        String(saDate.getMinutes()).padStart(2, '0') + ':' +
        String(saDate.getSeconds()).padStart(2, '0');

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

    let finalReceiptNumber = 'PENDING';
    record.splitReceipts = [];

    const accountTotal = accountItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const clearanceTotal = clearanceItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const directIncomeTotal = directIncomeItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const prepaidTotal = electricityPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0)
        + waterPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const grandTotal = record.totalAmount;
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
        const sessionCheck = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${sessionUserId}`);
        if (sessionCheck.ok) {
            const sessionData = await sessionCheck.json();
            console.log(`[Payment] Active session validated — isActive: ${sessionData.isActive}, cashierId: ${sessionData.cashierId}, officeId: ${sessionData.officeId}`);
            if (!sessionData.isActive) {
                console.error(`[Payment] Session is NOT active for userId ${sessionUserId}. Payment may fail.`);
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
            console.warn(`[Payment] Could not verify active session (status ${sessionCheck.status}), proceeding with payment`);
        }
    } catch (e: any) {
        console.warn(`[Payment] Failed to verify active session:`, e?.message || e);
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

    const processAccReceiptResult = async (receiptIds: number[], paymentLabel: string, paymentType: 'cash' | 'card', paymentAmount: number) => {
        if (receiptIds.length === 0) {
            console.warn(`[Priority 1 ${paymentLabel}] No receipt IDs returned — receipt print skipped`);
            return;
        }
        let receiptNo = `REC-${receiptIds[0]}`;
        let receiptDetail: any = null;

        try {
            const receiptData = await fetchPosMultiReceiptPrint(String(receiptIds[0]));
            if (receiptData && receiptData.length > 0) {
                const rd = receiptData[0];
                if (rd.receiptNo) {
                    receiptNo = rd.receiptNo;
                    console.log(`[Priority 1 ${paymentLabel}] Receipt number from multi-receipt-print: ${receiptNo}`);
                }
                receiptDetail = {
                    receiptNo: rd.receiptNo,
                    cashierName: rd.cashierName,
                    cashOffice: rd.cashOfficeName,
                    tenderAmount: rd.tenderAmount,
                    changeAmount: rd.changeAmount,
                    outstandingAmount: rd.outstandingAmount,
                    paymentType: rd.billType || (rd.paymentTypeId === 1 ? 'Cash' : rd.paymentTypeId === 2 ? 'Card' : 'Cash'),
                    paymentOption: rd.payMode || 'Consumer Services',
                    accountId: rd.accountId,
                    oldAccountCode: rd.oldAccountCode,
                    sgNumber: rd.sgNumber,
                    accAddress: rd.accAddress,
                    accName: rd.accName,
                    receiptDate: rd.receiptDate,
                    paymentDate: rd.paymentDate,
                    isCancelled: rd.isCancelled,
                };
                console.log(`[Priority 1 ${paymentLabel}] Receipt detail from multi-receipt-print:`, JSON.stringify(receiptDetail).substring(0, 500));
            }
        } catch (e) {
            console.warn(`[Priority 1 ${paymentLabel}] Could not fetch multi-receipt-print`, e);
        }

        if (receiptNo.startsWith('REC-')) {
            try {
                const htmlDetail = await getReceiptTransactionDetail(receiptIds[0]);
                if (htmlDetail) {
                    const detailReceiptNo = htmlDetail?.receiptNo || htmlDetail?.ReceiptNo || htmlDetail?.receiptNumber || htmlDetail?.ReceiptNumber;
                    if (detailReceiptNo) {
                        receiptNo = detailReceiptNo;
                        console.log(`[Priority 1 ${paymentLabel}] Receipt number from transaction detail: ${receiptNo}`);
                    }
                }
            } catch (e) {
                console.warn(`[Priority 1 ${paymentLabel}] Could not fetch receipt transaction detail`, e);
            }
        }

        if (!finalReceiptNumber || finalReceiptNumber === 'PENDING') {
            finalReceiptNumber = receiptNo;
            updateRecordReceiptNumber(record, finalReceiptNumber);
        }

        const splitEntry: SplitReceipt = { receiptNumber: receiptNo, receiptId: receiptIds[0], paymentType, amount: paymentAmount };

        if (receiptDetail) {
            splitEntry.receiptDetail = receiptDetail;
        }

        try {
            const allocs = await fetchReceiptAllocations(String(receiptIds[0]));
            if (allocs.length > 0) {
                splitEntry.allocations = allocs;
                record.allocations = [...(record.allocations || []), ...allocs];
                console.log(`[Priority 1 ${paymentLabel}] Receipt allocations:`, allocs);
            }
        } catch (e) {
            console.warn(`[Priority 1 ${paymentLabel}] Could not fetch receipt allocations`, e);
        }

        record.splitReceipts!.push(splitEntry);

        if (receiptDetail && !record.receiptDetail) {
            record.receiptDetail = receiptDetail;
        }

        console.log(`[Priority 1 ${paymentLabel}] Receipt ${receiptNo} added to split receipts`);
    };

    try {
    // --- PRIORITY 1: Consumer Services / Account Payments ---
    if (accountItems.length > 0) {
        const saveAccounts = accountItems
            .filter(item => item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID)
            .map(item => {
                const raw = item.originalData?._rawSearchResult;
                const orig = raw ? { ...item.originalData, ...raw } : (item.originalData || {});
                const acctId = Number(orig.account_ID || orig.apiId || orig.accountID || orig.accountId);
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
                    outStandingAmt: orig.outStandingAmt ?? orig.outstandingAmount ?? orig.balance ?? 0,
                    billId: orig.billId ?? 0,
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
                };
            });

        console.log(`[Priority 1] Save payload:`, JSON.stringify(saveAccounts[0], null, 2));

        const isSingleAccount = accountItems.length === 1;

        if (saveAccounts.length > 0) {
            try {
                await platinumSaveMultipleAccountPayment(saveAccounts, { userId: String(sessionUserId) });
                console.log(`[Priority 1] Saved ${saveAccounts.length} account(s) for payment (userId: ${sessionUserId})`);
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
                        item => String(item.originalData?.account_ID ?? item.originalData?.accountID) === String(acct.account_ID)
                    ) || accountItems[i];
                    const itemPayment = paymentAmountOverride !== undefined && localItem
                        ? Math.round((localItem.amountToPay / accountTotal) * paymentAmountOverride * 100) / 100
                        : (localItem?.amountToPay ?? acct.outStandingAmt ?? 0);
                    const acctOutstanding = acct.outStandingAmt ?? localItem?.originalData?.outStandingAmt ?? 0;
                    perAccountPayments.push({ acct, localItem, itemPayment, acctOutstanding });
                }

                for (let i = 0; i < perAccountPayments.length; i++) {
                    const { acct, itemPayment, acctOutstanding } = perAccountPayments[i];

                    const requestModel = {
                        finYear,
                        receiptDate,
                        totalAmount: itemPayment,
                        tenderAmount: i === 0 ? tenderAmt : itemPayment,
                        changeAmount: i === 0 ? changeAmt : 0,
                        paymentType: paymentTypeId,
                        paymentOption: paymentOptionId,
                        outStandingAmount: acctOutstanding,
                        cardNumber: '',
                        expiryDate: '',
                        chequeNumber: '',
                        chequeDate: null,
                        processingMonth: null,
                        accountHolderName: acct.name || '',
                        bankName: '',
                        bankBranchCode: '',
                        cutOffID: acct.cutOffID ?? 0,
                        debtArrangementId: acct.debtArrangementId ?? 0,
                    };

                    console.log(`[Priority 1 ${label}] Submitting consumer payment for account ${acct.account_ID} (${acct.name}), amount: R${itemPayment}, outstanding: R${acctOutstanding}`);

                    const result = await submitConsumerPayment(sessionUserId, {
                        account: acct,
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

                return { isSuccess: true, ids: allReceiptIds };
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

                try {
                    const cashResult = await submitConsumerPayments(accCashActual, accCashTender, accCashChange, 1, 1, 'CASH', accCashActual);
                    console.log(`[Priority 1 CASH] Submitted cash payment`, cashResult);
                    const cashReceiptIds = extractReceiptIds(cashResult);
                    await processAccReceiptResult(cashReceiptIds, 'CASH', 'cash', accCashActual);
                } catch (e: any) {
                    console.warn(`[Priority 1 CASH] Failed to submit cash payment`, e);
                    toast({ title: "Cash Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                }

                if (accCardActual > 0) {
                    try {
                        await platinumSaveMultipleAccountPayment(saveAccounts, { userId: String(sessionUserId) });
                        const cardResult = await submitConsumerPayments(accCardActual, accCardActual, 0, 2, 2, 'CARD', accCardActual);
                        console.log(`[Priority 1 CARD] Submitted card payment`, cardResult);
                        const cardReceiptIds = extractReceiptIds(cardResult);
                        await processAccReceiptResult(cardReceiptIds, 'CARD', 'card', accCardActual);
                    } catch (e: any) {
                        console.warn(`[Priority 1 CARD] Failed to submit card payment`, e);
                        toast({ title: "Card Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                    }
                }
            } else {
                const paymentTypeId = record.payment.card > 0 ? 2 : 1;
                try {
                    const submitResult = await submitConsumerPayments(accountTotal, accTender, accChange, paymentTypeId, paymentTypeId, 'ACC');
                    console.log(`[Priority 1] Submitted payment`, submitResult);
                    const receiptIds = extractReceiptIds(submitResult);
                    await processAccReceiptResult(receiptIds, 'SINGLE', record.payment.card > 0 ? 'card' : 'cash', accountTotal);
                } catch (e: any) {
                    console.warn(`[Priority 1] Failed to submit payment`, e);
                    toast({ title: "Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
                }
            }

            for (const item of accountItems) {
                const accountId = item.originalData?.account_ID || item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId;
                if (accountId) {
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
                        console.log(`[Priority 1] Rebuild triggered for account ${accountId}`);
                    } catch (e) {
                        console.warn(`[Priority 1] Failed to rebuild account ${accountId}`, e);
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
            const clearanceId = origData.clearanceId || origData.scheduleNo || item.reference;
            const paidItems = origData.paidItems || [];
            const accountHolderName = item.paidBy || origData.linkedAccounts?.[0]?.name || 'Walk-in';

            const submitOneClearance = async (paymentTypeId: number, amount: number, tender: number, change: number, label: string, splitType: 'cash' | 'card') => {
                const clrResult = await platinumSubmitClearancePayment({
                    userId: sessionUserId,
                    paymentTypeId,
                    cashierId: sessionUserId,
                    receiptDate,
                    tenderAmount: tender,
                    changeAmount: change,
                    paidAmount: amount,
                    outstandingAmount: item.amountDue || amount,
                    clearance_ID: Number(clearanceId),
                    accountHolderName,
                    chequeNo: '',
                    bankId: 0,
                    branchId: 0,
                    cardNo: '',
                    cardExpiryDate: '',
                    paySection1181Only: false,
                    section1181Amount: 0,
                    paidItems: paidItems.map((pi: any) => ({
                        ...pi,
                        paymentAmount: Math.round((pi.paymentAmount || pi.amount || 0) * (amount / (item.amountToPay || 1)) * 100) / 100,
                    })),
                });
                console.log(`[Priority 1B ${label}] Submitted clearance payment for ${clearanceId}`, clrResult);

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

                    if (!finalReceiptNumber || finalReceiptNumber === 'PENDING') {
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
                if (isSplitPayment) {
                    const cashPaid = Math.max(0, record.payment.cash - totalChange);
                    const cashPaidRatio = grandTotal > 0 ? cashPaid / grandTotal : 0;
                    const itemCash = Math.round(item.amountToPay * cashPaidRatio * 100) / 100;
                    const itemCard = Math.round((item.amountToPay - itemCash) * 100) / 100;
                    const itemCashTender = isMixedBasket ? itemCash : record.payment.cash;
                    const itemCashChange = isMixedBasket ? 0 : totalChange;

                    console.log(`[Priority 1B SPLIT] Clearance ${clearanceId}: Cash R${itemCash} (tender R${itemCashTender}), Card R${itemCard}`);

                    await submitOneClearance(1, itemCash, itemCashTender, itemCashChange, 'CASH', 'cash');
                    if (itemCard > 0) {
                        await submitOneClearance(2, itemCard, itemCard, 0, 'CARD', 'card');
                    }
                } else {
                    const paymentTypeId = record.payment.card > 0 ? 2 : 1;
                    await submitOneClearance(paymentTypeId, item.amountToPay, clrGroupTender, clrGroupChange, 'SINGLE', record.payment.card > 0 ? 'card' : 'cash');
                }
            } catch (e: any) {
                console.warn(`[Priority 1B] Failed to submit clearance payment for ${clearanceId}`, e);
                toast({ title: "Clearance Payment Posting Failed", description: e?.message || 'Unknown error', variant: "destructive" });
            }

            for (const pi of paidItems) {
                if (pi.accountId) {
                    try {
                        await rebuildFullAccount(Number(pi.accountId));
                        console.log(`[Priority 1B] Rebuild triggered for account ${pi.accountId}`);
                    } catch (e) {
                        console.warn(`[Priority 1B] Failed to rebuild account ${pi.accountId}`, e);
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
                    receiptDate,
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

                    if (!finalReceiptNumber || finalReceiptNumber === 'PENDING') {
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
                        await submitOneMisc(2, itemCard, itemCard, 0, 'CARD', 'card');
                    }
                } else {
                    const paymentTypeId = record.payment.card > 0 ? 2 : 1;
                    await submitOneMisc(paymentTypeId, item.amountToPay, item.amountToPay, 0, 'SINGLE', record.payment.card > 0 ? 'card' : 'cash');
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
        setTimeout(() => {
            loadTransactionsFromApi(currentUser.id).catch(e => 
                console.warn('[Transactions] Background refresh after payment failed:', e)
            );
        }, 2000);
    }
  };
  
  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    clearTransaction();
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

      if (receiptId) {
          try {
              const res = await fetch('/api/platinum/auth-day-end/cancel-receipt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ receiptId: Number(receiptId), reason }),
              });
              if (!res.ok) {
                  const errData = await res.json().catch(() => null);
                  throw new Error(errData?.message || `HTTP ${res.status}`);
              }
              console.log(`[CancelTransaction] Receipt ${receiptId} cancelled via Platinum API`);
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

      const isSupervisor = currentUser.role === 'SUPERVISOR';
      const newStatus: TransactionStatus = isSupervisor ? 'CANCELLED' : 'PENDING_CANCELLATION';

      setRecentTransactions(prev => prev.map(t =>
          t.id === id ? { ...t, status: newStatus, cancellationReason: reason, cancellationRequestTime: Date.now() } : t
      ));

      setTimeout(() => {
          loadTransactionsFromApi(currentUser.id).catch(() => {});
      }, 1500);
  };
  
  const approveCancellation = (id: string, approved: boolean) => {
      setRecentTransactions(prev => prev.map(t =>
          t.id === id ? { ...t, status: approved ? 'CANCELLED' as TransactionStatus : 'COMPLETED' as TransactionStatus } : t
      ));

      setTimeout(() => {
          loadTransactionsFromApi(currentUser.id).catch(() => {});
      }, 1500);
  };
  
  return (
    <PosContext.Provider value={{
      currentUser,
      activeTransactionType,
      transactionItems: items,
      // ... (keep payment)
      payment: {
        cashAmount: payment.cash,
        cardAmount: payment.card,
        tenderTotal,
        changeDue
      },
      searchQuery,
      isReceiptModalOpen,
      transactionProcessing,
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
      clearTransaction,
      completeTransaction,
      closeReceiptModal,
      submitDayEnd,
      returnDayEnd,
      cancelTransaction,
      approveCancellation,
      refreshTransactions: () => loadTransactionsFromApi(currentUser.id),
      activeSession,
      sessionLoading,
      startSession,
      endSession,
      sessionDetails,
      platinumCashierId,
      officeLimits,
      updateOfficeLimit,
      currentTransactionLimit,
      viewMode,
      toggleViewMode,
      systemSettings,
      updateSystemSettings,
      referenceData,
      platinumUser,
      cashierRegistered
    }}>
      {children}
    </PosContext.Provider>
  );
};
