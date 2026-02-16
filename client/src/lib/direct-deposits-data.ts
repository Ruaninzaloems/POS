
export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference: string;
  status: 'UNMATCHED' | 'DRAFT' | 'ALLOCATED' | 'REVERSED' | 'PROCESSING' | 'ERROR';
  allocatedAmount: number;
  bankAccount: string;
}

export interface AllocationLine {
  id: string;
  accountNo: string;
  amount: number;
  description: string;
  allocationType?: 'ACCOUNT' | 'PREPAID' | 'DIRECT' | 'GROUP' | 'CLEARANCE' | 'CASHBOOK';
  accountId?: number;
  groupId?: number;
  miscPaymentGroupId?: number;
  scoaItemId?: number;
  voteId?: number;
}

export interface AllocationDraft {
  transactionId: string;
  lines: AllocationLine[];
  status: 'DRAFT' | 'POSTED' | 'PROCESSING';
  updatedAt: string;
  method: 'MANUAL' | 'BULK';
  allocatedBy: string;
  allocationDate: string;
  bulkJobStatus?: 'Processing' | 'Performing rebuilds' | 'Completing reconciliation' | 'Bulk allocations complete' | 'Error';
  allocationType?: 'DIRECT_PAYMENT' | 'CLEARANCE_PAYMENT' | 'ACCOUNT_PAYMENT' | 'ELECTRICITY_RECHARGE' | 'WATER_RECHARGE' | 'CSV_FILE';
  fileName?: string;
  fileUrl?: string;
}

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [];
export const MOCK_ALLOCATIONS: AllocationDraft[] = [];

export const saveTransactions = () => {};
export const saveAllocations = () => {};
