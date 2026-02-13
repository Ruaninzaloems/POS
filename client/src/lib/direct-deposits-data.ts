
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
  accountNo: string; // Account to allocate to
  amount: number;
  description: string;
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
  fileUrl?: string; // Mock URL for viewing the file
}

const PERSISTENCE_KEY_TX = 'mock_bank_transactions_v1';
const PERSISTENCE_KEY_ALLOC = 'mock_allocations_v1';

const loadTransactions = (): BankTransaction[] => {
    try {
        const stored = localStorage.getItem(PERSISTENCE_KEY_TX);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

const loadAllocations = (): AllocationDraft[] => {
    try {
        const stored = localStorage.getItem(PERSISTENCE_KEY_ALLOC);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = typeof window !== 'undefined' ? loadTransactions() : [];
export const MOCK_ALLOCATIONS: AllocationDraft[] = typeof window !== 'undefined' ? loadAllocations() : [];

// Helpers to save back to storage
export const saveTransactions = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(PERSISTENCE_KEY_TX, JSON.stringify(MOCK_BANK_TRANSACTIONS));
    }
}

export const saveAllocations = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(PERSISTENCE_KEY_ALLOC, JSON.stringify(MOCK_ALLOCATIONS));
    }
}
