import { TransactionItem, TransactionType, TransactionRecord, TransactionStatus } from './pos-state';

export interface PaymentState {
  cash: number;
  card: number;
}

export interface TransactionTotals {
  rawTotal: number;
  totalToPay: number;
  tenderTotal: number;
  changeDue: number;
}

/**
 * Calculates all transaction totals including rounding and change due
 */
export function calculateTransactionTotals(
  items: TransactionItem[],
  payment: PaymentState
): TransactionTotals {
  const rawTotal = items.reduce((sum, item) => sum + item.amountToPay, 0);
  
  // Round UP to nearest 10c (0.10) to ensure no outstanding balance
  // Logic: 12.31 -> 12.40, 12.30 -> 12.30
  const totalToPay = Math.ceil(rawTotal * 10) / 10;
  
  const tenderTotal = payment.cash + payment.card;
  const changeDue = Math.max(0, payment.cash - (totalToPay - payment.card));
  
  return {
    rawTotal,
    totalToPay,
    tenderTotal,
    changeDue
  };
}

/**
 * Determines the active transaction type based on current items
 */
export function determineTransactionType(
  items: TransactionItem[],
  viewingItemId: string | null
): TransactionType {
  // If viewing a specific item, that takes precedence
  if (viewingItemId) {
      const item = items.find(i => i.id === viewingItemId);
      if (item) return item.type;
  }
  
  // If multiple items, it's multi-account
  if (items.length > 1) {
      return 'MULTI_ACCOUNT';
  }
  
  // Otherwise single item type or none
  if (items.length > 0) {
      return items[0].type;
  }
  
  return 'NONE';
}

/**
 * Creates a finalized transaction record
 */
export function createTransactionRecord(
  items: TransactionItem[],
  totalToPay: number,
  payment: PaymentState,
  cashierId: string
): TransactionRecord {
  return {
      id: crypto.randomUUID(),
      receiptNumber: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: Date.now(),
      items: [...items],
      totalAmount: totalToPay,
      payment: { ...payment },
      status: 'COMPLETED',
      cashierId: cashierId
  };
}
