import { SearchResult } from '@/components/pos/search-component';
import { Account } from '@/lib/mock-data';
import { BankTransaction, AllocationLine } from '@/lib/direct-deposits-data';

/**
 * Validates if an allocation amount is valid.
 * Checks for:
 * 1. Valid number
 * 2. Positive amount
 * 3. Does not exceed transaction remaining balance
 */
export function validateAllocationAmount(
  amount: number,
  currentAllocatedTotal: number,
  transactionAmount: number
): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: "Invalid Amount" };
  }

  // Floating point safe comparison (epsilon 0.005)
  if ((currentAllocatedTotal + amount) > (transactionAmount + 0.005)) {
    const remaining = transactionAmount - currentAllocatedTotal;
    return { 
      valid: false, 
      error: `Cannot allocate R ${amount.toFixed(2)}. Remaining balance is R ${remaining.toFixed(2)}.` 
    };
  }

  return { valid: true };
}

/**
 * Calculates allocation totals and remaining balance
 */
export function calculateAllocationTotals(
  lines: AllocationLine[],
  transactionAmount: number
) {
  const allocatedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const remaining = transactionAmount - allocatedTotal;
  const isFullyAllocated = Math.abs(remaining) < 0.005;

  return { allocatedTotal, remaining, isFullyAllocated };
}

/**
 * Maps a search result to a standardized allocation target object
 */
export function mapSearchResultToAllocationTarget(result: SearchResult) {
  if (result.type === 'ACCOUNT') {
      const acc = result.data as any;
      return { 
          accountNo: acc.accountNo, 
          name: acc.name,
          description: `Payment to ${acc.name}`,
          allocationType: 'ACCOUNT' as const,
          accountId: acc.apiId || acc.accountId || acc.accountID || null,
      };
  } else if (result.type === 'PREPAID') {
      const acc = result.data as any;
      const prepaidType = acc.prepaidType || 'Electricity';
      return { 
          accountNo: acc.accountNo, 
          name: `${prepaidType} Meter: ${acc.prepaidMeterNo}`,
          description: `Prepaid ${prepaidType}: ${acc.prepaidMeterNo} (${acc.name})`,
          allocationType: 'PREPAID' as const,
          accountId: acc.apiId || acc.accountId || acc.accountID || null,
      }; 
  } else if (result.type === 'DIRECT') {
      const item = result.data;
      return { 
          accountNo: item.scoaItem, 
          name: item.description,
          description: `Direct Income: ${item.description}`,
          allocationType: 'DIRECT' as const,
          scoaItemId: item.scoaItemId ? Number(item.scoaItemId) : undefined,
          miscPaymentGroupId: item.miscPaymentGroupId ? Number(item.miscPaymentGroupId) : undefined,
      };
  } else if (result.type === 'GROUP') {
      const group = result.data as any;
      return {
          accountNo: group.id,
          name: group.name,
          description: `Group Payment: ${group.name}`,
          allocationType: 'GROUP' as const,
          groupId: group.id ? Number(group.id) : undefined,
      };
  } else if (result.type === 'CLEARANCE') {
      const clr = result.data as any;
      return {
          accountNo: clr.scheduleNo,
          name: `Clearance ${clr.scheduleNo}`,
          description: `Clearance Payment: ${clr.scheduleNo}`,
          allocationType: 'CLEARANCE' as const,
      };
  }
  
  return null;
}
