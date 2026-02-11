
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
  },
  // Add some allocated bulk transactions for the demo
  {
    id: "TXN-101",
    transactionDate: "2026-02-09",
    description: "BULK UPLOAD CONSUMER",
    amount: 50000.00,
    reference: "BULK-001",
    status: "ALLOCATED",
    allocatedAmount: 50000.00,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-102",
    transactionDate: "2026-02-09",
    description: "BULK UPLOAD CONSUMER",
    amount: 17219.06,
    reference: "BULK-002",
    status: "ALLOCATED",
    allocatedAmount: 17219.06,
    bankAccount: "FNB MAIN (***1234)"
  },
  {
    id: "TXN-103",
    transactionDate: "2026-02-10",
    description: "BULK IMPORT BATCH A",
    amount: 125000.00,
    reference: "BULK-003",
    status: "PROCESSING",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  },
  {
    id: "TXN-104",
    transactionDate: "2026-02-10",
    description: "BULK IMPORT BATCH B",
    amount: 45000.00,
    reference: "BULK-004",
    status: "PROCESSING",
    allocatedAmount: 0,
    bankAccount: "ABSA (***5678)"
  },
  {
    id: "TXN-105",
    transactionDate: "2026-02-10",
    description: "BULK IMPORT BATCH C",
    amount: 88500.00,
    reference: "BULK-005",
    status: "PROCESSING",
    allocatedAmount: 0,
    bankAccount: "NEDBANK (***9012)"
  },
  {
    id: "TXN-106",
    transactionDate: "2026-02-11",
    description: "BULK IMPORT BATCH D",
    amount: 12000.00,
    reference: "BULK-006",
    status: "ERROR",
    allocatedAmount: 0,
    bankAccount: "FNB MAIN (***1234)"
  }
];

const DEFAULT_MOCK_ALLOCATIONS: AllocationDraft[] = [
    {
        transactionId: "TXN-004",
        lines: [
            { id: "L-1", accountNo: "ACC-1005", amount: 1200.00, description: "Rates Payment" }
        ],
        status: "POSTED",
        updatedAt: "2023-10-21T10:00:00",
        method: "MANUAL",
        allocatedBy: "Sarah Jenkins",
        allocationDate: "2023-10-21T10:00:00",
        allocationType: 'DIRECT_PAYMENT'
    },
    {
        transactionId: "TXN-101",
        lines: [
            { id: "L-2", accountNo: "ACC-4872", amount: 50000.00, description: "Bulk Consumer Services" }
        ],
        status: "POSTED",
        updatedAt: "2026-02-09T14:22:52",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-09T14:22:52",
        bulkJobStatus: "Bulk allocations complete",
        allocationType: 'CSV_FILE',
        fileName: 'bulk_consumer_upload_feb.csv'
    },
    {
        transactionId: "TXN-102",
        lines: [
            { id: "L-3", accountNo: "ACC-22780", amount: 17219.06, description: "Bulk Consumer Services" }
        ],
        status: "POSTED",
        updatedAt: "2026-02-09T14:11:53",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-09T14:11:53",
        bulkJobStatus: "Bulk allocations complete",
        allocationType: 'CSV_FILE',
        fileName: 'bulk_consumer_upload_feb_part2.csv'
    },
    {
        transactionId: "TXN-103",
        lines: [],
        status: "PROCESSING",
        updatedAt: "2026-02-10T09:15:00",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-10T09:15:00",
        bulkJobStatus: "Processing",
        allocationType: 'CSV_FILE',
        fileName: 'import_batch_a.csv'
    },
    {
        transactionId: "TXN-104",
        lines: [],
        status: "PROCESSING",
        updatedAt: "2026-02-10T09:20:00",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-10T09:20:00",
        bulkJobStatus: "Performing rebuilds",
        allocationType: 'WATER_RECHARGE'
    },
    {
        transactionId: "TXN-105",
        lines: [],
        status: "PROCESSING",
        updatedAt: "2026-02-10T09:30:00",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-10T09:30:00",
        bulkJobStatus: "Completing reconciliation",
        allocationType: 'ELECTRICITY_RECHARGE'
    },
    {
        transactionId: "TXN-106",
        lines: [],
        status: "PROCESSING",
        updatedAt: "2026-02-11T10:00:00",
        method: "BULK",
        allocatedBy: "System Process",
        allocationDate: "2026-02-11T10:00:00",
        bulkJobStatus: "Error",
        allocationType: 'CSV_FILE',
        fileName: 'failed_batch_d.csv'
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
