
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

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [
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
  }
];

export const MOCK_ALLOCATIONS: AllocationDraft[] = [
    {
        transactionId: "TXN-004",
        lines: [
            { id: "L-1", accountNo: "ACC-1005", amount: 1200.00, description: "Rates Payment" }
        ],
        status: "POSTED",
        updatedAt: "2023-10-21T10:00:00"
    }
];
