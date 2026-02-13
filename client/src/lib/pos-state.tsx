import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Account, DirectIncomeItem, ClearanceCostSchedule, AccountGroup, MOCK_TRANSACTIONS, CashOffice } from './mock-data';
import { calculateTransactionTotals, determineTransactionType, createTransactionRecord } from './pos-logic';
import { fetchBanks, fetchGroups, fetchInstitutions, fetchConfigSettings, fetchCashOffices, fetchCashiers, fetchBillingConfig, fetchPlatinumUserInfo, ApiCashier, BillingConfig, PlatinumUserInfo, postMultipleAccountPaymentReceipt, rebuildFullAccount, submitMiscPayment, submitConsumerPayment, submitMultiplePayment, submitPrepaidPayment, platinumPrintReceipt, platinumPrintMiscellaneousReceipt, platinumSaveMultipleAccountPayment, fetchPosMultiReceiptPrint } from './external-api';

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
  isReconciled: number;
  cancellationReason?: string;
  cancellationRequestTime?: number;
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
          setSessionLoading(false);
          return;
        }
        const data = await res.json();
        if (data.active && data.officeId) {
          setPlatinumCashierId(data.cashierId);
          setActiveSession(true);
          setSessionDetails({
            startTime: Date.now(),
            officeId: String(data.officeId),
            officeDesc: data.officeName || '',
            floatAmount: data.cashFloat || 0,
          });
          setCurrentUser(prev => ({
            ...prev,
            cashOffice: data.officeName || prev.cashOffice,
            float: data.cashFloat || prev.float,
          }));
          if (data.cashOnHandLimit) {
            setOfficeLimits(prev => ({ ...prev, [String(data.officeId)]: data.cashOnHandLimit }));
          }
          console.log("Active Platinum session restored:", data);
        } else {
          setPlatinumCashierId(data.cashierId || null);
        }
      } catch (e) {
        console.warn("Failed to check active Platinum session", e);
      } finally {
        setSessionLoading(false);
      }
    };
    checkActiveSession();
  }, [platinumUser]);

  useEffect(() => {
    const cashierTxs = MOCK_TRANSACTIONS.filter(t => t.cashierId === currentUser.id);
    setRecentTransactions([...cashierTxs].sort((a, b) => b.timestamp - a.timestamp));
  }, [currentUser]);

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

      try {
          const ensureRes = await fetch('/api/platinum/auth/ensure-cashier', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ officeId: Number(officeId) }),
          });
          const ensureData = await ensureRes.json();
          if (ensureData.success) {
              console.log("Platinum cashier setup confirmed:", ensureData.message);
          } else if (ensureData.needsSetup) {
              console.warn("Cashier not mapped in Platinum:", ensureData.message);
              toast({
                  title: "Cashier Not Mapped",
                  description: `User ${currentUser.name} (ID: ${currentUser.id}) is not registered as a cashier in the billing system. Payments cannot be posted until cashier mapping is completed.`,
                  variant: "destructive",
              });
          }
      } catch (e) {
          console.warn("Failed to check cashier setup in Platinum", e);
      }
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
    const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === record.id);
    if (idx >= 0) MOCK_TRANSACTIONS[idx] = record;
    const cashierTxs = MOCK_TRANSACTIONS.filter(t => t.cashierId === currentUser.id);
    setRecentTransactions([...cashierTxs].sort((a, b) => b.timestamp - a.timestamp));
  };

  const completeTransaction = async () => {
    const record = createTransactionRecord(items, totalToPay, payment, currentUser.id);
    
    MOCK_TRANSACTIONS.push(record);
    const cashierTxs = MOCK_TRANSACTIONS.filter(t => t.cashierId === currentUser.id);
    setRecentTransactions([...cashierTxs].sort((a, b) => b.timestamp - a.timestamp));
    setIsReceiptModalOpen(true);
    setTransactionProcessing(true);

    let finYear = '2025/2026';
    try {
        const res = await fetch('/api/platinum/active-fin-year');
        if (res.ok) finYear = await res.json();
    } catch (e) {
        console.warn("Failed to fetch active fin year, using default", e);
    }

    const paymentTypeId = record.payment.card > 0 ? 2 : 1;
    const receiptDate = new Date().toISOString();

    const accountItems = record.items.filter(item =>
        item.type === 'CONSUMER_SERVICES' || item.type === 'MULTI_ACCOUNT' || item.type === 'ACCOUNT_GROUP'
    );
    const directIncomeItems = record.items.filter(item => item.type === 'DIRECT_INCOME');
    const electricityPrepaidItems = record.items.filter(item =>
        item.type === 'PREPAID' && (item.originalData?.prepaidType === 'Electricity' || !item.originalData?.prepaidType)
    );
    const waterPrepaidItems = record.items.filter(item =>
        item.type === 'PREPAID' && item.originalData?.prepaidType === 'Water'
    );

    let finalReceiptNumber = 'PENDING';

    const accountTotal = accountItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const directIncomeTotal = directIncomeItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const prepaidTotal = electricityPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0)
        + waterPrepaidItems.reduce((sum, i) => sum + i.amountToPay, 0);
    const grandTotal = record.totalAmount;
    const totalTender = record.payment.cash + record.payment.card;
    const totalChange = Math.max(0, totalTender - grandTotal);

    const groupTotals = [
        { key: 'ACC', total: accountTotal },
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
    const incTender = groupTenders['INC'] ?? 0;
    const incChange = groupChanges['INC'] ?? 0;

    console.log(`[Payment Split] Grand total: R${grandTotal}, Tender: R${totalTender}, Change: R${totalChange}`);
    console.log(`[Payment Split] ACC portion: R${accountTotal} (tender: R${accTender}, change: R${accChange})`);
    console.log(`[Payment Split] INC portion: R${directIncomeTotal} (tender: R${incTender}, change: R${incChange})`);
    console.log(`[Payment Split] Prepaid portion: R${prepaidTotal}`);

    try {
    // --- PRIORITY 1: Consumer Services / Account Payments ---
    if (accountItems.length > 0) {
        const saveAccounts = accountItems
            .filter(item => item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID)
            .map(item => {
                const orig = item.originalData || {};
                const acctId = Number(orig.account_ID || orig.apiId || orig.accountID || orig.accountId);
                return {
                    isSelected: true,
                    account_ID: acctId,
                    accountNumber: orig.accountNumber || '',
                    statusDesc: orig.statusDesc || 'Active',
                    accountDesc: orig.accountDesc || '',
                    name: orig.name || orig.accountHolder || item.reference || '',
                    deliveryAddress: orig.deliveryAddress || orig.address || '',
                    erfNumber: orig.erfNumber || '',
                    town: orig.town || '',
                    streetName: orig.streetName || '',
                    activeServices: orig.activeServices ?? null,
                    closedServices: orig.closedServices ?? null,
                    typeOfUseDesc: orig.typeOfUseDesc || '',
                    zoneDesc: orig.zoneDesc || '',
                    outStandingAmt: orig.outStandingAmt ?? orig.outstandingAmount ?? orig.balance ?? 0,
                    billId: orig.billId ?? null,
                    oldAccountCode: orig.oldAccountCode || '',
                    id: orig.id ?? null,
                };
            });

        const submitAccounts = accountItems
            .filter(item => item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID)
            .map(item => {
                const orig = item.originalData || {};
                return {
                    capturerID: Number(currentUser.id),
                    accountID: Number(orig.account_ID || orig.apiId || orig.accountID || orig.accountId),
                    oldAccountCode: orig.oldAccountCode || orig.accountNumber || '',
                    name: orig.name || orig.accountHolder || item.reference || '',
                    sgNumber: orig.sgNumber || '',
                    address: orig.deliveryAddress || orig.address || '',
                    outstandingAmount: orig.outStandingAmt ?? orig.outstandingAmount ?? orig.balance ?? 0,
                    accountStatus: orig.statusDesc || 'Active',
                    accountType: orig.typeOfUseDesc || '',
                    paymentAmount: item.amountToPay,
                    accountNumber: orig.accountNumber || '',
                    receiptID: null,
                };
            });

        if (saveAccounts.length > 0) {
            try {
                await platinumSaveMultipleAccountPayment(saveAccounts, { userId: String(currentUser.id) });
                console.log(`[Priority 1] Saved ${saveAccounts.length} account(s) for multiple payment`);
            } catch (e) {
                console.warn(`[Priority 1] Failed to save multiple account payment`, e);
            }

            try {
                const submitResult = await submitMultiplePayment(Number(currentUser.id), {
                    accounts: submitAccounts,
                    requestModel: {
                        finYear,
                        receiptDate,
                        totalAmount: accountTotal,
                        tenderAmount: accTender,
                        changeAmount: accChange,
                        paymentType: paymentTypeId,
                        paymentOption: paymentTypeId,
                    },
                });
                console.log(`[Priority 1] Submitted multiple payment`, submitResult);

                let receiptIds: number[] = [];
                if (submitResult?.ids && Array.isArray(submitResult.ids) && submitResult.ids.length > 0) {
                    receiptIds = submitResult.ids.map(Number);
                } else if (Array.isArray(submitResult)) {
                    receiptIds = submitResult
                        .map((r: any) => r.receiptID || r.receiptId || r.id)
                        .filter((id: any) => id != null)
                        .map(Number);
                } else if (submitResult && typeof submitResult === 'object') {
                    const rid = submitResult.receiptID || submitResult.receiptId || submitResult.id;
                    if (rid != null) receiptIds = [Number(rid)];
                }

                if (receiptIds.length > 0) {
                    finalReceiptNumber = `REC-${receiptIds[0]}`;

                    try {
                        const receiptData = await fetchPosMultiReceiptPrint(String(receiptIds[0]));
                        if (receiptData && receiptData.length > 0 && receiptData[0].receiptNo) {
                            finalReceiptNumber = receiptData[0].receiptNo;
                            console.log(`[Priority 1] Actual receipt number from billing: ${finalReceiptNumber}`);
                        }
                    } catch (e) {
                        console.warn(`[Priority 1] Could not fetch formatted receipt number, using ID fallback`, e);
                    }

                    updateRecordReceiptNumber(record, finalReceiptNumber);
                    console.log(`[Priority 1] Receipt number: ${finalReceiptNumber}`);

                    try {
                        await platinumPrintReceipt(receiptIds);
                        console.log(`[Priority 1] Created/printed receipt for IDs: ${receiptIds.join(', ')}`);
                    } catch (e) {
                        console.warn(`[Priority 1] Failed to print receipt`, e);
                    }
                } else {
                    console.warn(`[Priority 1] No receipt IDs returned from submit — receipt print skipped`);
                }
            } catch (e: any) {
                console.warn(`[Priority 1] Failed to submit multiple payment`, e);
                const errorMsg = e?.message || 'Unknown error';
                toast({
                    title: "Payment Posting Failed",
                    description: `Account payment could not be posted to billing system: ${errorMsg}`,
                    variant: "destructive",
                });
            }

            const updatedReceiptId = record.receiptNumber.replace(/\D/g, '') || '0';
            for (const item of accountItems) {
                const accountId = item.originalData?.account_ID || item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId;
                if (accountId) {
                    try {
                        await postMultipleAccountPaymentReceipt(currentUser.id, accountId, updatedReceiptId);
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

    // --- PRIORITY 2: Direct Income / Miscellaneous Payments ---
    if (directIncomeItems.length > 0) {
        const incGroupTender = isMixedBasket ? incTender : totalTender;
        const incGroupChange = isMixedBasket ? incChange : totalChange;
        let incAllocatedTender = 0;

        for (let idx = 0; idx < directIncomeItems.length; idx++) {
            const item = directIncomeItems[idx];
            const isLastIncItem = idx === directIncomeItems.length - 1;
            const origData = item.originalData;
            const groupId = origData?.groupId;
            const scoaItemId = origData?.scoaItemId || origData?.id;
            const vatRate = origData?.vatRate || 15;
            const isVatable = vatRate > 0;
            const amountExVat = isVatable ? item.amountToPay / (1 + vatRate / 100) : item.amountToPay;
            const vatAmount = isVatable ? item.amountToPay - amountExVat : 0;

            if (groupId && scoaItemId) {
                try {
                    const paidByName = (item.paidBy || 'Walk-in').trim();
                    const paidByParts = paidByName.split(/\s+/);
                    const lastName = paidByParts.length > 1 ? paidByParts.slice(1).join(' ') : paidByParts[0];
                    const initials = paidByParts[0]?.charAt(0) || 'W';
                    let itemTender: number;
                    let itemChange: number;
                    if (isLastIncItem) {
                        itemTender = Math.round((incGroupTender - incAllocatedTender) * 100) / 100;
                        itemChange = Math.max(0, Math.round((itemTender - item.amountToPay) * 100) / 100);
                    } else {
                        itemTender = item.amountToPay;
                        itemChange = 0;
                        incAllocatedTender += itemTender;
                    }

                    const miscResult = await submitMiscPayment({
                        lastName,
                        initials,
                        miscellaneousPaymentGroup: Number(groupId),
                        scoaItem: Number(scoaItemId),
                        description: item.notes || item.description || origData?.description || '',
                        receiptDate,
                        totalAmount: item.amountToPay,
                        vatAmount: Math.round(vatAmount * 100) / 100,
                        amount: Math.round(amountExVat * 100) / 100,
                        tenderAmount: itemTender,
                        changeAmount: itemChange,
                        paymentType: paymentTypeId,
                        vatPercentage: vatRate,
                        isVatable,
                        userId: Number(currentUser.id),
                        finYear,
                    });
                    console.log(`[Priority 2] Submitted misc payment for SCOA item ${scoaItemId}`, miscResult);

                    let miscReceiptId: number | null = null;
                    if (miscResult?.ids && Array.isArray(miscResult.ids) && miscResult.ids.length > 0) {
                        miscReceiptId = miscResult.ids[0];
                    } else {
                        miscReceiptId = miscResult?.receiptID || miscResult?.receiptId || miscResult?.id || null;
                    }

                    if (miscReceiptId) {
                        finalReceiptNumber = `REC-${miscReceiptId}`;

                        try {
                            const miscReceiptData = await fetchPosMultiReceiptPrint(String(miscReceiptId));
                            if (miscReceiptData && miscReceiptData.length > 0 && miscReceiptData[0].receiptNo) {
                                finalReceiptNumber = miscReceiptData[0].receiptNo;
                                console.log(`[Priority 2] Actual receipt number from billing: ${finalReceiptNumber}`);
                            }
                        } catch (e) {
                            console.warn(`[Priority 2] Could not fetch formatted receipt number`, e);
                        }

                        updateRecordReceiptNumber(record, finalReceiptNumber);
                        console.log(`[Priority 2] Receipt number: ${finalReceiptNumber}`);

                        try {
                            await platinumPrintMiscellaneousReceipt({}, { id: String(miscReceiptId) });
                            console.log(`[Priority 2] Created/printed misc receipt ID: ${miscReceiptId}`);
                        } catch (e) {
                            console.warn(`[Priority 2] Failed to print misc receipt ${miscReceiptId}`, e);
                        }
                    } else {
                        console.warn(`[Priority 2] No receipt ID returned from misc payment submit`);
                    }
                } catch (e: any) {
                    console.warn(`[Priority 2] Failed to submit misc payment for ${item.description}`, e);
                    const errorMsg = e?.message || 'Unknown error';
                    toast({
                        title: "Direct Income Posting Failed",
                        description: `Payment for "${item.description}" could not be posted to billing system: ${errorMsg}`,
                        variant: "destructive",
                    });
                }
            } else {
                console.warn(`[Priority 2] Skipping misc payment for "${item.description}" — missing groupId or scoaItemId`);
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

  const cancelTransaction = (id: string, reason: string) => {
      const tx = MOCK_TRANSACTIONS.find(t => t.id === id);
      if (!tx) return;

      if (tx.isReconciled === 1) return;
      
      const isSupervisor = currentUser.role === 'SUPERVISOR';
      const newStatus = isSupervisor ? 'CANCELLED' : 'PENDING_CANCELLATION';
      
      const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
      if (idx !== -1) {
          MOCK_TRANSACTIONS[idx].status = newStatus;
          MOCK_TRANSACTIONS[idx].cancellationReason = reason;
          MOCK_TRANSACTIONS[idx].cancellationRequestTime = Date.now();
      }

      const cashierTxs = MOCK_TRANSACTIONS.filter(t => t.cashierId === currentUser.id);
      setRecentTransactions([...cashierTxs].sort((a, b) => b.timestamp - a.timestamp));
  };
  
  const approveCancellation = (id: string, approved: boolean) => {
      const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
      if (idx !== -1) {
          MOCK_TRANSACTIONS[idx].status = approved ? 'CANCELLED' : 'COMPLETED';
      }
      
      const cashierTxs = MOCK_TRANSACTIONS.filter(t => t.cashierId === currentUser.id);
      setRecentTransactions([...cashierTxs].sort((a, b) => b.timestamp - a.timestamp));
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
      referenceData
    }}>
      {children}
    </PosContext.Provider>
  );
};
