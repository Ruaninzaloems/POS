
export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  reference: string;
  status: 'UNMATCHED' | 'DRAFT' | 'ALLOCATED' | 'REVERSED';
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
  status: 'DRAFT' | 'POSTED';
  updatedAt: string;
}

// Helper to manage mock persistence
const PERSISTENCE_KEY_TX = 'mock_bank_transactions_v1';
const PERSISTENCE_KEY_ALLOC = 'mock_allocations_v1';

// Load from storage or default
const loadTransactions = (): BankTransaction[] => {
    try {
        const stored = localStorage.getItem(PERSISTENCE_KEY_TX);
        return stored ? JSON.parse(stored) : DEFAULT_MOCK_TRANSACTIONS;
    } catch (e) {
        return DEFAULT_MOCK_TRANSACTIONS;
    }
}

const loadAllocations = (): AllocationDraft[] => {
    try {
        const stored = localStorage.getItem(PERSISTENCE_KEY_ALLOC);
        return stored ? JSON.parse(stored) : DEFAULT_MOCK_ALLOCATIONS;
    } catch (e) {
        return DEFAULT_MOCK_ALLOCATIONS;
    }
}

const DEFAULT_MOCK_TRANSACTIONS: BankTransaction[] = [
  {
    id: "TXN-001",
    transactionDate: "2023-10-25",
    description: "EFT PAYMENT - J SMITH",
    amount: 1500.00,
    reference: "ACC1002",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-002",
    transactionDate: "2023-10-26",
    description: "DIRECT DEP - BODY CORP",
    amount: 5400.50,
    reference: "GRP001",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-003",
    transactionDate: "2023-10-24",
    description: "UNKNOWN DEPOSIT REF: 999",
    amount: 250.00,
    reference: "UNKNOWN",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  },
  {
    id: "TXN-004",
    transactionDate: "2023-10-20",
    description: "RATES PAYMENT",
    amount: 1200.00,
    reference: "ACC1005",
    status: "ALLOCATED",
    allocatedAmount: 1200.00,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-005",
    transactionDate: "2023-10-27",
    description: "WATER BILL PAYMENT",
    amount: 450.00,
    reference: "WATER",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-006",
    transactionDate: "2023-10-27",
    description: "DEP REF: 12345",
    amount: 890.50,
    reference: "12345",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  },
  {
    id: "TXN-007",
    transactionDate: "2023-10-28",
    description: "S CONNOR RATES",
    amount: 500.00,
    reference: "S CONNOR",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-008",
    transactionDate: "2023-10-28",
    description: "PAYMENT FOR TWO ACCS",
    amount: 3000.00,
    reference: "ACC1002/3",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  },
  {
    id: "TXN-009",
    transactionDate: "2023-10-29",
    description: "INVOICE 8821 SETTLEMENT",
    amount: 15000.00,
    reference: "INV 8821",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "NEDBANK (***9012)"
  },
  {
    id: "TXN-010",
    transactionDate: "2023-10-29",
    description: "ERF 4921 TAXES",
    amount: 2200.00,
    reference: "ERF 4921",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-011",
    transactionDate: "2023-10-30",
    description: "TRAFFIC FINE J DOE",
    amount: 500.00,
    reference: "FINE 123",
    status: "UNMATCHED",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  }
];

const DEFAULT_MOCK_ALLOCATIONS: AllocationDraft[] = [
    {
        transactionId: "TXN-004",
        lines: [
            { id: "L-1", accountNo: "ACC-1005", amount: 1200.00, description: "Rates Payment" }
        ],
        status: "POSTED",
        updatedAt: "2023-10-21T10:00:00"
    }
];

// In-memory mutable arrays that initialize from storage (if in browser)
export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = typeof window !== 'undefined' ? loadTransactions() : DEFAULT_MOCK_TRANSACTIONS;
export const MOCK_ALLOCATIONS: AllocationDraft[] = typeof window !== 'undefined' ? loadAllocations() : DEFAULT_MOCK_ALLOCATIONS;

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
