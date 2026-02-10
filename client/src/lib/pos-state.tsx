import React, { createContext, useContext, useState, useMemo } from 'react';
import { Account, DirectIncomeItem, ClearanceCostSchedule, ACCOUNTS, DIRECT_INCOME_ITEMS, ACCOUNT_GROUPS, CLEARANCES, AccountGroup } from './mock-data';

export type TransactionType = 
  | 'CONSUMER_SERVICES' 
  | 'MULTI_ACCOUNT' 
  | 'ACCOUNT_GROUP' 
  | 'PREPAID' 
  | 'DIRECT_INCOME' 
  | 'CLEARANCE'
  | 'NONE';

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
}

interface PosActions {
  setSearchQuery: (query: string) => void;
  addItem: (item: TransactionItem) => void;
  removeItem: (id: string) => void;
  updateItemAmount: (id: string, amount: number) => void;
  setPaymentAmount: (type: 'cash' | 'card', amount: number) => void;
  clearTransaction: () => void;
  completeTransaction: () => void;
  closeReceiptModal: () => void;
}

const PosContext = createContext<(PosState & PosActions) | null>(null);

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within a PosProvider');
  return context;
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [payment, setPayment] = useState({ cash: 0, card: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);

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
    setIsReceiptModalOpen(true);
  };
  
  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    clearTransaction();
  };
  
  return (
    <PosContext.Provider value={{
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
      viewingItemId, // Add this
      setSearchQuery,
      addItem,
      removeItem,
      updateItemAmount,
      setViewingItem, // Add this
      setPaymentAmount,
      clearTransaction,
      completeTransaction,
      closeReceiptModal
    }}>
      {children}
    </PosContext.Provider>
  );
};
