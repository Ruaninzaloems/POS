import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Account, DirectIncomeItem, ClearanceCostSchedule, ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, AccountGroup, CASHIERS, MOCK_TRANSACTIONS, CASH_OFFICES, CashOffice } from './mock-data';
import { calculateTransactionTotals, determineTransactionType, createTransactionRecord } from './pos-logic';

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
  startSession: (officeId: string, floatAmount: number) => void;
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
}

interface PosActions {
  switchUser: (cashierId: string) => void;
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

  // Derived state (Logic extracted to pos-logic.ts)
  const { totalToPay, tenderTotal, changeDue } = calculateTransactionTotals(items, payment);
  
  // Determine active transaction type (Logic extracted to pos-logic.ts)
  const activeTransactionType = determineTransactionType(items, viewingItemId);

  const switchUser = (cashierId: string) => {
      const cashier = CASHIERS.find(c => c.id === cashierId);
      if (cashier) {
          setCurrentUser(cashier);
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
      }
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'desktop' ? 'mobile' : 'desktop');
  };

  const updateSystemSettings = (settings: Partial<typeof systemSettings>) => {
      setSystemSettings(prev => ({ ...prev, ...settings }));
  };

  const startSession = (officeId: string, floatAmount: number) => {
      setActiveSession(true);
      setSessionDetails({
          startTime: Date.now(),
          officeId,
          floatAmount
      });
      // Optionally update currentUser's office to match selection
  };

  const endSession = () => {
      setActiveSession(false);
      setSessionDetails(undefined);
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

  const completeTransaction = () => {
    // Create record (Logic extracted to pos-logic.ts)
    const record = createTransactionRecord(items, totalToPay, payment, currentUser.id);
    
    // Add to Global Mock
    MOCK_TRANSACTIONS.push(record);
    
    setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
    setIsReceiptModalOpen(true);
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
      updateSystemSettings
    }}>
      {children}
    </PosContext.Provider>
  );
};
