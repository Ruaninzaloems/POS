import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Account, DirectIncomeItem, ClearanceCostSchedule, ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, AccountGroup, CASHIERS, MOCK_TRANSACTIONS, CASH_OFFICES, CashOffice } from './mock-data';
import { calculateTransactionTotals, determineTransactionType, createTransactionRecord } from './pos-logic';
import { fetchBanks, fetchGroups, fetchInstitutions, fetchConfigSettings, fetchCashOffices, fetchCashiers, fetchBillingConfig, ApiCashier, BillingConfig, createSessionApi, endSessionApi, createTransactionApi, postMultipleAccountPaymentReceipt, rebuildFullAccount, submitMiscPayment, submitConsumerPayment, submitMultiplePayment, submitPrepaidPayment, platinumPrintReceipt, platinumPrintMiscellaneousReceipt, platinumSaveMultipleAccountPayment } from './external-api';

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
  cashierId: string; // Add cashierId to track who made it
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
  viewingItemId: string | null;
  recentTransactions: TransactionRecord[];
  dayEndStatus: DayEndStatus;
  dayEndReturnReason?: string;
  activeSession: boolean;
  startSession: (officeId: string, floatAmount: number, officeName?: string) => void;
  endSession: () => void;
  sessionDetails?: {
      startTime: number;
      officeId: string;
      floatAmount: number;
  };
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
  const [currentUser, setCurrentUser] = useState<CashierProfile>(CASHIERS[0]);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [payment, setPayment] = useState({ cash: 0, card: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
  const [dayEndStatus, setDayEndStatus] = useState<DayEndStatus>('OPEN');
  const [dayEndReturnReason, setDayEndReturnReason] = useState<string>('');
  
  // Session State
  const [activeSession, setActiveSession] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<{startTime: number; officeId: string; floatAmount: number} | undefined>(undefined);
  
  // Initialize limits from mock data
  const [officeLimits, setOfficeLimits] = useState<Record<string, number>>(() => {
    const limits: Record<string, number> = {};
    CASH_OFFICES.forEach(office => {
        limits[office.id] = office.maxTransactionLimit || 5000;
    });
    return limits;
  });

  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [systemSettings, setSystemSettings] = useState({
      enableDenominationCounting: false
  });

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
              const [banks, groups, institutions, settings, cashOffices, cashiers, billingConfig] = await Promise.all([
                  fetchBanks(),
                  fetchGroups(),
                  fetchInstitutions(),
                  fetchConfigSettings(),
                  fetchCashOffices(),
                  fetchCashiers(),
                  fetchBillingConfig()
              ]);
              
              setReferenceData({
                  banks: banks || [],
                  groups: groups || [],
                  institutions: institutions || [],
                  settings: settings || [],
                  cashOffices: cashOffices || [],
                  cashiers: cashiers || [],
                  billingConfig: billingConfig || null
              });
              
              console.log("Reference Data Loaded:", { banks, groups, institutions, settings, cashOffices, cashiers, billingConfig });
          } catch (error: any) {
              console.error("Failed to load reference data", error);
              toast({
                  title: "Connection Error",
                  description: `Failed to load data from API. Using mock data. Error: ${error.message || 'Unknown network error'}`,
                  variant: "destructive"
              });
          }
      };
      
      loadData();
  }, []);

  const currentTransactionLimit = useMemo(() => {
      if (!sessionDetails?.officeId) return 5000; // Default fallback
      return officeLimits[sessionDetails.officeId] || 5000;
  }, [sessionDetails?.officeId, officeLimits]);

  // Sync with global mock transactions on mount and updates
  useEffect(() => {
    // Filter transactions relevant to current view if needed, or show all for prototype
    // For Supervisor, show all. For Cashier, maybe just theirs? 
    // For simplicity in prototype, we show all but highlight ownership
    setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
  }, [currentUser]); // Re-fetch when user switches

  // Update currentUser when cashiers are loaded from API to replace mock data
  useEffect(() => {
      if (referenceData.cashiers.length > 0) {
          const apiCashier = referenceData.cashiers[0];
          setCurrentUser({
              id: apiCashier.id,
              name: apiCashier.name,
              role: 'CASHIER', // Default role since API might not return it
              cashOffice: apiCashier.cashOfficeId || 'Unknown',
              float: apiCashier.float
          });
      }
  }, [referenceData.cashiers]);

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

      // Fallback to mock cashiers
      const cashier = CASHIERS.find(c => c.id === cashierId);
      if (cashier) {
          setCurrentUser({
              ...cashier,
              name: name || cashier.name,
              cashOffice: cashOffice || cashier.cashOffice,
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
      // In a real app, we would load that cashier's active session here
      // For prototype, we'll just reset the session slightly to simulate a switch
      setItems([]);
      setSearchQuery('');
      setDayEndStatus('OPEN');
      setDayEndReturnReason('');
      setRecentTransactions([]);
      setPayment({ cash: 0, card: 0 });
      setActiveSession(false); // Require new session start on switch
      setSessionDetails(undefined);
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'desktop' ? 'mobile' : 'desktop');
  };

  const updateSystemSettings = (settings: Partial<typeof systemSettings>) => {
      setSystemSettings(prev => ({ ...prev, ...settings }));
  };

  const [dbSessionId, setDbSessionId] = useState<string | null>(null);

  const startSession = async (officeId: string, floatAmount: number, officeName?: string) => {
      setActiveSession(true);
      setSessionDetails({
          startTime: Date.now(),
          officeId,
          floatAmount
      });

      try {
          const office = CASH_OFFICES.find(o => o.id === officeId);
          const session = await createSessionApi({
              cashierId: currentUser.id,
              cashierName: currentUser.name,
              cashOfficeId: officeId,
              cashOfficeName: officeName || office?.name,
              floatAmount,
          });
          setDbSessionId(session.id);
      } catch (e) {
          console.warn("Failed to persist session to backend", e);
      }
  };

  const endSession = async () => {
      if (dbSessionId) {
          try {
              await endSessionApi(dbSessionId);
          } catch (e) {
              console.warn("Failed to end session in backend", e);
          }
      }
      setActiveSession(false);
      setSessionDetails(undefined);
      setDbSessionId(null);
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

  const completeTransaction = async () => {
    const record = createTransactionRecord(items, totalToPay, payment, currentUser.id);
    
    MOCK_TRANSACTIONS.push(record);
    setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
    setIsReceiptModalOpen(true);

    try {
        await createTransactionApi({
            receiptNumber: record.receiptNumber,
            sessionId: dbSessionId,
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            cashOfficeId: sessionDetails?.officeId,
            totalAmount: record.totalAmount,
            cashAmount: record.payment.cash,
            cardAmount: record.payment.card,
            tenderAmount: record.payment.cash + record.payment.card,
            changeAmount: Math.max(0, (record.payment.cash + record.payment.card) - record.totalAmount),
            paymentType: record.payment.card > 0 ? 'Card' : 'Cash',
            status: record.status,
            items: record.items,
        });
    } catch (e) {
        console.warn("Failed to persist transaction to backend", e);
        toast({
            title: "Warning",
            description: "Transaction recorded locally but failed to save to database. Please notify your supervisor.",
            variant: "destructive",
        });
    }

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

    // --- PRIORITY 1: Consumer Services / Account Payments ---
    if (accountItems.length > 0) {
        const receiptId = record.receiptNumber.replace(/\D/g, '') || '0';

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
                        totalAmount: accountItems.reduce((sum, i) => sum + i.amountToPay, 0),
                        tenderAmount: record.payment.cash + record.payment.card,
                        changeAmount: Math.max(0, (record.payment.cash + record.payment.card) - record.totalAmount),
                        paymentType: paymentTypeId,
                        paymentOption: paymentTypeId,
                    },
                });
                console.log(`[Priority 1] Submitted multiple payment`, submitResult);

                let receiptIds: number[] = [];
                if (Array.isArray(submitResult)) {
                    receiptIds = submitResult
                        .map((r: any) => r.receiptID || r.receiptId || r.id)
                        .filter((id: any) => id != null)
                        .map(Number);
                } else if (submitResult && typeof submitResult === 'object') {
                    const rid = submitResult.receiptID || submitResult.receiptId || submitResult.id;
                    if (rid != null) receiptIds = [Number(rid)];
                }

                if (receiptIds.length > 0) {
                    try {
                        await platinumPrintReceipt(receiptIds);
                        console.log(`[Priority 1] Created/printed receipt for IDs: ${receiptIds.join(', ')}`);
                    } catch (e) {
                        console.warn(`[Priority 1] Failed to print receipt`, e);
                    }
                } else {
                    console.warn(`[Priority 1] No receipt IDs returned from submit — receipt print skipped`);
                }
            } catch (e) {
                console.warn(`[Priority 1] Failed to submit multiple payment`, e);
                toast({
                    title: "Payment Posting Warning",
                    description: "Account payment saved locally but could not be posted to billing system. Please inform your supervisor.",
                });
            }

            for (const item of accountItems) {
                const accountId = item.originalData?.account_ID || item.originalData?.apiId || item.originalData?.accountID || item.originalData?.accountId;
                if (accountId) {
                    try {
                        await postMultipleAccountPaymentReceipt(currentUser.id, accountId, receiptId);
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
        for (const item of directIncomeItems) {
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
                        tenderAmount: record.payment.cash + record.payment.card,
                        changeAmount: Math.max(0, (record.payment.cash + record.payment.card) - record.totalAmount),
                        paymentType: paymentTypeId,
                        vatPercentage: vatRate,
                        isVatable,
                        userId: Number(currentUser.id),
                        finYear,
                    });
                    console.log(`[Priority 2] Submitted misc payment for SCOA item ${scoaItemId}`, miscResult);

                    const miscReceiptId = miscResult?.receiptID || miscResult?.receiptId || miscResult?.id;
                    if (miscReceiptId) {
                        try {
                            await platinumPrintMiscellaneousReceipt({}, { id: String(miscReceiptId) });
                            console.log(`[Priority 2] Created/printed misc receipt ID: ${miscReceiptId}`);
                        } catch (e) {
                            console.warn(`[Priority 2] Failed to print misc receipt ${miscReceiptId}`, e);
                        }
                    }
                } catch (e) {
                    console.warn(`[Priority 2] Failed to submit misc payment for ${item.description}`, e);
                    toast({
                        title: "Direct Income Warning",
                        description: `Payment for "${item.description}" saved locally but could not be posted to billing system. Receipt was still generated.`,
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
      if (dayEndStatus === 'RECONCILED') return;
      
      const isSupervisor = currentUser.role === 'SUPERVISOR';
      const newStatus = isSupervisor ? 'CANCELLED' : 'PENDING_CANCELLATION';
      
      // Update Global Mock
      const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
      if (idx !== -1) {
          MOCK_TRANSACTIONS[idx].status = newStatus;
          MOCK_TRANSACTIONS[idx].cancellationReason = reason;
          MOCK_TRANSACTIONS[idx].cancellationRequestTime = Date.now();
      }

      // Update Local State
      setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
  };
  
  const approveCancellation = (id: string, approved: boolean) => {
      // Update Global Mock
      const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
      if (idx !== -1) {
          MOCK_TRANSACTIONS[idx].status = approved ? 'CANCELLED' : 'COMPLETED';
      }
      
      // Update Local State
      setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
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
      startSession,
      endSession,
      sessionDetails,
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
