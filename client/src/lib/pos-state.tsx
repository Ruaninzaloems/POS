import React, { createContext, useContext, useState, useMemo } from 'react';
import { Account, DirectIncomeItem, ClearanceCostSchedule, ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, AccountGroup, CASHIERS } from './mock-data';

export type TransactionType = 
  | 'CONSUMER_SERVICES' 
  | 'MULTI_ACCOUNT' 
  | 'ACCOUNT_GROUP' 
  | 'PREPAID' 
  | 'DIRECT_INCOME' 
  | 'CLEARANCE'
  | 'NONE';

export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'RECONCILED';
export type DayEndStatus = 'OPEN' | 'PENDING_APPROVAL' | 'RETURNED' | 'RECONCILED' | 'NOT_SUBMITTED';

export interface CashierProfile {
    id: string;
    name: string;
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

  // Derived state
  const totalToPay = items.reduce((sum, item) => sum + item.amountToPay, 0);
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
        status: 'COMPLETED'
    };
    
    setRecentTransactions(prev => [record, ...prev]);
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
      
      setRecentTransactions(prev => prev.map(tx => 
          tx.id === id ? { ...tx, status: 'CANCELLED' } : tx
      ));
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
      cancelTransaction
    }}>
      {children}
    </PosContext.Provider>
  );
};
