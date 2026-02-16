import { TransactionItem, TransactionType, TransactionRecord, TransactionStatus } from './pos-state';

export interface PaymentState {
  cash: number;
  card: number;
  cardReference: string;
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
  cashierId: string,
  extras?: { cashierName?: string; cashOfficeName?: string }
): TransactionRecord {
  // Sort items: Account payments first, Prepaid last
  const sortedItems = [...items].sort((a, b) => {
      const getPriority = (type: string) => {
          switch (type) {
              case 'CONSUMER_SERVICES': return 1;
              case 'CLEARANCE': return 2;
              case 'DIRECT_INCOME': return 3;
              case 'ACCOUNT_GROUP': return 4;
              case 'PREPAID': return 10; // Prepaid always last
              default: return 5;
          }
      };
      return getPriority(a.type) - getPriority(b.type);
  });

  const paymentTypeName = payment.cash > 0 && payment.card > 0 ? 'Split' : payment.card > 0 ? 'Card' : 'Cash';
  const uniqueTypes = Array.from(new Set(sortedItems.map(i => i.type)));
  let paymentOptionName: string;
  if (uniqueTypes.length > 1) {
      const labels: string[] = [];
      if (uniqueTypes.includes('CONSUMER_SERVICES')) labels.push('Consumer Services');
      if (uniqueTypes.includes('CLEARANCE')) labels.push('Clearance');
      if (uniqueTypes.includes('DIRECT_INCOME')) labels.push('Direct Income');
      if (uniqueTypes.includes('PREPAID')) labels.push('Prepaid');
      if (uniqueTypes.includes('ACCOUNT_GROUP')) labels.push('Account Group');
      paymentOptionName = labels.join(' / ') || 'Multiple';
  } else {
      paymentOptionName = uniqueTypes[0] === 'CONSUMER_SERVICES' ? 'Consumer Services'
          : uniqueTypes[0] === 'CLEARANCE' ? 'Clearance'
          : uniqueTypes[0] === 'DIRECT_INCOME' ? 'Direct Income'
          : uniqueTypes[0] === 'PREPAID' ? 'Prepaid'
          : uniqueTypes[0] === 'ACCOUNT_GROUP' ? 'Account Group'
          : 'Consumer Services';
  }

  return {
      id: crypto.randomUUID(),
      receiptNumber: `PENDING`,
      timestamp: Date.now(),
      items: sortedItems,
      totalAmount: totalToPay,
      payment: { ...payment },
      status: 'COMPLETED',
      cashierId: cashierId,
      cashierName: extras?.cashierName || '',
      cashOfficeName: extras?.cashOfficeName || '',
      paymentTypeName,
      paymentOptionName,
      isReconciled: 0
  };
}
