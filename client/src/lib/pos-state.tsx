import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { Account, DirectIncomeItem, ClearanceCostSchedule, ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, AccountGroup, CASHIERS, MOCK_TRANSACTIONS } from './mock-data';

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
}

interface PosActions {
  switchUser: (cashierId: string) => void;
  setSearchQuery: (query: string) => void;
  addItem: (item: TransactionItem) => void;
  removeItem: (id: string) => void;
  updateItemAmount: (id: string, amount: number) => void;
  setPaymentAmount: (type: 'cash' | 'card', amount: number) => void;
  clearTransaction: () => void;
  completeTransaction: () => void;
  closeReceiptModal: () => void;
  setViewingItem: (id: string | null) => void;
  submitDayEnd: (report: { cashOnHand: number, cardTotal: number }) => void;
  returnDayEnd: (reason: string) => void;
  cancelTransaction: (id: string) => void;
  approveCancellation: (id: string, approved: boolean) => void;
}

const PosContext = createContext<(PosState & PosActions) | null>(null);

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within a PosProvider');
  return context;
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CashierProfile>(CASHIERS[0]);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [payment, setPayment] = useState({ cash: 0, card: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
  const [dayEndStatus, setDayEndStatus] = useState<DayEndStatus>('OPEN');
  const [dayEndReturnReason, setDayEndReturnReason] = useState<string>('');

  // Sync with global mock transactions on mount and updates
  useEffect(() => {
    // Filter transactions relevant to current view if needed, or show all for prototype
    // For Supervisor, show all. For Cashier, maybe just theirs? 
    // For simplicity in prototype, we show all but highlight ownership
    setRecentTransactions([...MOCK_TRANSACTIONS].sort((a, b) => b.timestamp - a.timestamp));
  }, [currentUser]); // Re-fetch when user switches

  // Derived state
  const rawTotal = items.reduce((sum, item) => sum + item.amountToPay, 0);
  // Round to nearest 10c (0.10)
  // Logic: 
  // 12.34 -> 12.30
  // 12.35 -> 12.40
  // 12.36 -> 12.40
  const totalToPay = Math.round(rawTotal * 10) / 10;
  
  const tenderTotal = payment.cash + payment.card;
  const changeDue = Math.max(0, payment.cash - (totalToPay - payment.card));
  
  // Determine active transaction type
  // If viewing a specific item, that takes precedence
  // Otherwise if multiple items, it's multi-account
  // Otherwise single item type or none
  let activeTransactionType: TransactionType = 'NONE';
  
  if (viewingItemId) {
      const item = items.find(i => i.id === viewingItemId);
      if (item) activeTransactionType = item.type;
  } else if (items.length > 1) {
      activeTransactionType = 'MULTI_ACCOUNT';
  } else if (items.length > 0) {
      activeTransactionType = items[0].type;
  }

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
      }
  };

  const addItem = (item: TransactionItem) => {
     setItems(prev => {
        // Prevent duplicates for Accounts/Meters to avoid confusion in prototype
        if (prev.find(i => i.id === item.id)) return prev;
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
    // Create record
    const record: TransactionRecord = {
        id: crypto.randomUUID(),
        receiptNumber: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: Date.now(),
        items: [...items],
        totalAmount: totalToPay,
        payment: { ...payment },
        status: 'COMPLETED',
        cashierId: currentUser.id
    };
    
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

  const cancelTransaction = (id: string) => {
      if (dayEndStatus === 'RECONCILED') return;
      
      const isSupervisor = currentUser.role === 'SUPERVISOR';
      const newStatus = isSupervisor ? 'CANCELLED' : 'PENDING_CANCELLATION';
      
      // Update Global Mock
      const idx = MOCK_TRANSACTIONS.findIndex(t => t.id === id);
      if (idx !== -1) {
          MOCK_TRANSACTIONS[idx].status = newStatus;
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
      setViewingItem,
      setPaymentAmount,
      clearTransaction,
      completeTransaction,
      closeReceiptModal,
      submitDayEnd,
      returnDayEnd,
      cancelTransaction,
      approveCancellation
    }}>
      {children}
    </PosContext.Provider>
  );
};
