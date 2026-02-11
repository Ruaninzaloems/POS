import { ACCOUNTS, CASHIERS } from "./mock-data";

export interface Receipt {
    id: string;
    receiptNo: string;
    accountId: string;
    paymentType: "Cash" | "Card" | "EFT" | "Cheque";
    paymentOption: string;
    receiptDate: string;
    staged: boolean;
    amount: number;
    tenderAmount: number;
    changeAmount: number;
    cashierName: string;
    cashBook: string;
    cashierOffice: string;
    status: 'ISSUED' | 'CANCELLED';
    cancellationReason?: string;
    reference?: string; // e.g. Cheque No, Card No
}

// Generate some realistic mock receipts
const generateMockReceipts = (): Receipt[] => {
    const receipts: Receipt[] = [];
    const cashBooks = [
        "ABSA Bank - Direct Deposit 4051",
        "FNB Main Account 1234",
        "Main Cash Float 001"
    ];
    const offices = [
        "Tzaneen - Main Cash Office",
        "Traffic Dept - Cash Office"
    ];

    // Helper to pick random item
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    
    // Generate 20 receipts
    for (let i = 1; i <= 20; i++) {
        const isCancelled = Math.random() < 0.15; // 15% cancelled
        const account = pick(ACCOUNTS);
        const cashier = pick(CASHIERS);
        const amount = Math.floor(Math.random() * 5000) + 100;
        
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Last 30 days
        
        receipts.push({
            id: `RCT-${1000 + i}`,
            receiptNo: `REC${date.getFullYear()}${10000 + i}`,
            accountId: account.accountNo,
            paymentType: pick(["Cash", "Card", "EFT"]),
            paymentOption: pick(["Consumer Services", "Traffic Fines", "Building Plan", "License Renewal"]),
            receiptDate: date.toISOString(),
            staged: false,
            amount: amount,
            tenderAmount: amount, // Simplified for now
            changeAmount: 0,
            cashierName: cashier.name,
            cashBook: pick(cashBooks),
            cashierOffice: pick(offices),
            status: isCancelled ? 'CANCELLED' : 'ISSUED',
            cancellationReason: isCancelled ? pick(["Duplicate Entry", "Customer Request", "Incorrect Amount", "System Error"]) : undefined
        });
    }

    // Hardcode some from the screenshot for fidelity
    receipts.push({
        id: "RCT-9991",
        receiptNo: "EFT08082025/8790",
        accountId: "000000059905",
        paymentType: "EFT",
        paymentOption: "Consumer Services",
        receiptDate: "2025-08-08T00:00:00",
        staged: false,
        amount: 2000.00,
        tenderAmount: 2000.00,
        changeAmount: 0.00,
        cashierName: "Mahlo Tshegofatso Nolithando",
        cashBook: "ABSA Bank - Direct Deposit 4051",
        cashierOffice: "Tzaneen - Main Cash Office",
        status: 'ISSUED'
    });
    
    receipts.push({
        id: "RCT-9992",
        receiptNo: "EFT10102025/26631",
        accountId: "000000059905",
        paymentType: "EFT",
        paymentOption: "Consumer Services",
        receiptDate: "2025-10-10T00:00:00",
        staged: false,
        amount: 39192.13,
        tenderAmount: 39192.13,
        changeAmount: 0.00,
        cashierName: "Ngobeni Ndzalo",
        cashBook: "ABSA Bank - Direct Deposit 4051",
        cashierOffice: "Tzaneen - Main Cash Office",
        status: 'ISSUED'
    });

    return receipts.sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime());
};

export const MOCK_RECEIPTS = generateMockReceipts();
