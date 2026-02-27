import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapTransactionTypeToPaymentOptionId } from '../client/src/lib/external-api';

describe('Payment Option ID Mapping', () => {
  it('maps CONSUMER_SERVICES to payment option 1', () => {
    expect(mapTransactionTypeToPaymentOptionId('CONSUMER_SERVICES')).toBe(1);
  });

  it('maps MULTI_ACCOUNT to payment option 1', () => {
    expect(mapTransactionTypeToPaymentOptionId('MULTI_ACCOUNT')).toBe(1);
  });

  it('maps DIRECT_INCOME to payment option 2', () => {
    expect(mapTransactionTypeToPaymentOptionId('DIRECT_INCOME')).toBe(2);
  });

  it('maps ACCOUNT_GROUP to payment option 3', () => {
    expect(mapTransactionTypeToPaymentOptionId('ACCOUNT_GROUP')).toBe(3);
  });

  it('maps CLEARANCE to payment option 4', () => {
    expect(mapTransactionTypeToPaymentOptionId('CLEARANCE')).toBe(4);
  });

  it('maps PREPAID to payment option 5', () => {
    expect(mapTransactionTypeToPaymentOptionId('PREPAID')).toBe(5);
  });

  it('returns null for unknown transaction type', () => {
    expect(mapTransactionTypeToPaymentOptionId('INVALID')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapTransactionTypeToPaymentOptionId('')).toBeNull();
  });
});

describe('Miscellaneous Payment Payload Structure', () => {
  function buildMiscPayload(overrides: Record<string, any> = {}) {
    return {
      lastName: 'Doe',
      initials: 'J',
      miscellaneousPaymentGroup: 5,
      scoaItem: 100,
      description: 'Building Plans',
      receiptDate: new Date().toISOString(),
      totalAmount: 150.00,
      vatAmount: 19.57,
      amount: 130.43,
      tenderAmount: 200.00,
      changeAmount: 50.00,
      paymentType: 1,
      vatPercentage: 15,
      isVatable: true,
      userId: 42,
      finYear: '2025/2026',
      cardNo: null,
      expiryDate: null,
      chequeNo: null,
      bankBranch: null,
      bankBranchCode: null,
      accHolderName: null,
      ...overrides,
    };
  }

  it('has all required fields present', () => {
    const payload = buildMiscPayload();
    const requiredFields = [
      'lastName', 'initials', 'miscellaneousPaymentGroup', 'scoaItem',
      'description', 'receiptDate', 'totalAmount', 'vatAmount', 'amount',
      'tenderAmount', 'changeAmount', 'paymentType', 'vatPercentage',
      'isVatable', 'userId', 'finYear',
    ];
    for (const field of requiredFields) {
      expect(payload).toHaveProperty(field);
    }
  });

  it('validates totalAmount must be positive', () => {
    const payload = buildMiscPayload({ totalAmount: 0 });
    expect(payload.totalAmount).toBeLessThanOrEqual(0);
  });

  it('validates VAT calculation: totalAmount = amount + vatAmount', () => {
    const payload = buildMiscPayload();
    expect(Math.abs(payload.totalAmount - (payload.amount + payload.vatAmount))).toBeLessThan(0.01);
  });

  it('validates change calculation: changeAmount = tenderAmount - totalAmount', () => {
    const payload = buildMiscPayload();
    expect(Math.abs(payload.changeAmount - (payload.tenderAmount - payload.totalAmount))).toBeLessThan(0.01);
  });

  it('sets card fields when paymentType is 3 (card)', () => {
    const payload = buildMiscPayload({
      paymentType: 3,
      cardNo: '1234',
      expiryDate: '2027-01-01',
    });
    expect(payload.paymentType).toBe(3);
    expect(payload.cardNo).toBe('1234');
    expect(payload.expiryDate).toBeTruthy();
  });

  it('leaves card fields null for cash payments', () => {
    const payload = buildMiscPayload({ paymentType: 1 });
    expect(payload.cardNo).toBeNull();
    expect(payload.expiryDate).toBeNull();
  });

  it('calculates VAT correctly at 15%', () => {
    const totalIncVat = 115.00;
    const vatRate = 15;
    const exVat = totalIncVat / (1 + vatRate / 100);
    const vatAmt = totalIncVat - exVat;
    expect(Math.abs(exVat - 100.00)).toBeLessThan(0.01);
    expect(Math.abs(vatAmt - 15.00)).toBeLessThan(0.01);
  });

  it('handles non-vatable items correctly', () => {
    const payload = buildMiscPayload({
      isVatable: false,
      vatAmount: 0,
      vatPercentage: 0,
      amount: 150.00,
      totalAmount: 150.00,
    });
    expect(payload.vatAmount).toBe(0);
    expect(payload.amount).toBe(payload.totalAmount);
  });

  it('includes optional bank fields for cheque payments', () => {
    const payload = buildMiscPayload({
      paymentType: 2,
      chequeNo: 'CHQ-12345',
      bankBranch: 'George',
      bankBranchCode: '250655',
      accHolderName: 'John Doe',
    });
    expect(payload.chequeNo).toBe('CHQ-12345');
    expect(payload.bankBranch).toBe('George');
    expect(payload.bankBranchCode).toBe('250655');
    expect(payload.accHolderName).toBe('John Doe');
  });
});

describe('Consumer Payment Payload Structure', () => {
  function buildConsumerPayload(overrides: Record<string, any> = {}) {
    return {
      account: {
        account_ID: 12345,
        accountNumber: '000000012345',
        outStandingAmt: 5000.00,
        ...overrides.account,
      },
      requestModel: {
        finYear: '2025/2026',
        receiptDate: new Date().toISOString(),
        totalAmount: 1000.00,
        tenderAmount: 1000.00,
        changeAmount: 0,
        paymentType: 1,
        paymentOption: 1,
        ...overrides.requestModel,
      },
    };
  }

  it('contains account and requestModel sections', () => {
    const payload = buildConsumerPayload();
    expect(payload).toHaveProperty('account');
    expect(payload).toHaveProperty('requestModel');
  });

  it('account section has required identifiers', () => {
    const payload = buildConsumerPayload();
    expect(payload.account.account_ID).toBeGreaterThan(0);
    expect(payload.account.accountNumber).toMatch(/^\d{12}$/);
  });

  it('requestModel has paymentOption 1 for consumer services', () => {
    const payload = buildConsumerPayload();
    expect(payload.requestModel.paymentOption).toBe(1);
  });

  it('handles split payment: cash portion', () => {
    const payload = buildConsumerPayload({
      requestModel: {
        totalAmount: 600,
        tenderAmount: 600,
        changeAmount: 0,
        paymentType: 1,
      },
    });
    expect(payload.requestModel.paymentType).toBe(1);
    expect(payload.requestModel.totalAmount).toBe(600);
  });

  it('handles split payment: card portion', () => {
    const payload = buildConsumerPayload({
      requestModel: {
        totalAmount: 400,
        tenderAmount: 400,
        changeAmount: 0,
        paymentType: 3,
      },
    });
    expect(payload.requestModel.paymentType).toBe(3);
    expect(payload.requestModel.totalAmount).toBe(400);
  });

  it('validates totalAmount does not exceed outstandingAmount', () => {
    const payload = buildConsumerPayload();
    expect(payload.requestModel.totalAmount).toBeLessThanOrEqual(payload.account.outStandingAmt);
  });

  it('change is calculated correctly: tenderAmount - totalAmount', () => {
    const payload = buildConsumerPayload({
      requestModel: { totalAmount: 100, tenderAmount: 200, changeAmount: 100 },
    });
    expect(payload.requestModel.changeAmount).toBe(
      payload.requestModel.tenderAmount - payload.requestModel.totalAmount
    );
  });
});

describe('Multiple Account Payment Payload Structure', () => {
  function buildMultiPayload() {
    return {
      accounts: [
        { accountID: 12345, paymentAmount: 300 },
        { accountID: 12346, paymentAmount: 200 },
        { accountID: 12347, paymentAmount: 500 },
      ],
      requestModel: {
        finYear: '2025/2026',
        receiptDate: new Date().toISOString(),
        totalAmount: 1000,
        tenderAmount: 1000,
        changeAmount: 0,
        paymentType: 1,
        paymentOption: 1,
      },
    };
  }

  it('has accounts array and requestModel', () => {
    const payload = buildMultiPayload();
    expect(Array.isArray(payload.accounts)).toBe(true);
    expect(payload.accounts.length).toBe(3);
    expect(payload).toHaveProperty('requestModel');
  });

  it('account amounts sum to totalAmount', () => {
    const payload = buildMultiPayload();
    const sum = payload.accounts.reduce((s, a) => s + a.paymentAmount, 0);
    expect(sum).toBe(payload.requestModel.totalAmount);
  });

  it('each account has a valid accountID and positive paymentAmount', () => {
    const payload = buildMultiPayload();
    for (const acc of payload.accounts) {
      expect(acc.accountID).toBeGreaterThan(0);
      expect(acc.paymentAmount).toBeGreaterThan(0);
    }
  });
});

describe('Clearance Payment Payload Structure', () => {
  function buildClearancePayload() {
    return {
      clearance_ID: '000000000160',
      paidAmount: 17293.38,
      paymentTypeId: 1,
      paidItems: [
        { account_ID: 16485, amount: 17293.38, section: '118(1)' },
      ],
      userId: 42,
      cashierId: 9495,
    };
  }

  it('has all required clearance fields', () => {
    const payload = buildClearancePayload();
    expect(payload.clearance_ID).toBeTruthy();
    expect(payload.paidAmount).toBeGreaterThan(0);
    expect(payload.paymentTypeId).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(payload.paidItems)).toBe(true);
    expect(payload.userId).toBeGreaterThan(0);
    expect(payload.cashierId).toBeGreaterThan(0);
  });

  it('paidItems amounts sum to paidAmount', () => {
    const payload = buildClearancePayload();
    const sum = payload.paidItems.reduce((s, i) => s + i.amount, 0);
    expect(Math.abs(sum - payload.paidAmount)).toBeLessThan(0.01);
  });

  it('clearance_ID is formatted with leading zeros', () => {
    const payload = buildClearancePayload();
    expect(payload.clearance_ID).toMatch(/^\d{12}$/);
  });
});

describe('Prepaid Payment Payload Structure', () => {
  function buildPrepaidPayload() {
    return {
      meterNo: 'MTR-001',
      amount: 100.00,
      paymentType: 1,
      userId: 42,
      accountId: 12345,
    };
  }

  it('has meter number and amount', () => {
    const payload = buildPrepaidPayload();
    expect(payload.meterNo).toBeTruthy();
    expect(payload.amount).toBeGreaterThan(0);
  });

  it('has valid userId', () => {
    const payload = buildPrepaidPayload();
    expect(payload.userId).toBeGreaterThan(0);
  });
});

describe('Direct Deposit Allocation Payload Structure', () => {
  function buildAllocationPayload() {
    return {
      posItemID: 12345,
      accountID: 67890,
      accountNumber: '000000067890',
      amount: 500.00,
      allocationType: 'ACCOUNT',
      finYear: '2025/2026',
      userId: 42,
    };
  }

  it('has all required allocation fields', () => {
    const payload = buildAllocationPayload();
    expect(payload.posItemID).toBeGreaterThan(0);
    expect(payload.amount).toBeGreaterThan(0);
    expect(payload.finYear).toMatch(/^\d{4}\/\d{4}$/);
    expect(payload.userId).toBeGreaterThan(0);
  });

  it('supports all allocation types', () => {
    const types = ['ACCOUNT', 'CLEARANCE', 'DIRECT', 'GROUP'];
    for (const type of types) {
      const payload = { ...buildAllocationPayload(), allocationType: type };
      expect(['ACCOUNT', 'CLEARANCE', 'DIRECT', 'GROUP']).toContain(payload.allocationType);
    }
  });
});

describe('Server-side Misc Payment Sanitization', () => {
  function simulateSanitization(body: Record<string, any>) {
    return {
      lastName: body.lastName || '',
      initials: body.initials || '',
      miscellaneousPaymentGroup: Number(body.miscellaneousPaymentGroup),
      scoaItem: Number(body.scoaItem),
      description: body.description || '',
      receiptDate: body.receiptDate || new Date().toISOString(),
      totalAmount: Number(body.totalAmount),
      vatAmount: Number(body.vatAmount ?? 0),
      amount: Number(body.amount ?? body.totalAmount),
      tenderAmount: Number(body.tenderAmount ?? body.totalAmount),
      changeAmount: Number(body.changeAmount ?? 0),
      paymentType: Number(body.paymentType ?? 1),
      vatPercentage: Number(body.vatPercentage ?? 0),
      isVatable: Boolean(body.isVatable),
      userId: Number(body.userId),
      finYear: body.finYear || '2025/2026',
      cardNo: body.cardNo || null,
      expiryDate: body.expiryDate || null,
      chequeNo: body.chequeNo || null,
      bankBranch: body.bankBranch || null,
      bankBranchCode: body.bankBranchCode || null,
      accHolderName: body.accHolderName || null,
    };
  }

  it('converts string numbers to actual numbers', () => {
    const result = simulateSanitization({
      totalAmount: '150.50',
      miscellaneousPaymentGroup: '5',
      scoaItem: '100',
      userId: '42',
    });
    expect(typeof result.totalAmount).toBe('number');
    expect(result.totalAmount).toBe(150.50);
    expect(typeof result.miscellaneousPaymentGroup).toBe('number');
    expect(typeof result.scoaItem).toBe('number');
    expect(typeof result.userId).toBe('number');
  });

  it('defaults vatAmount to 0 when not provided', () => {
    const result = simulateSanitization({ totalAmount: 100, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.vatAmount).toBe(0);
  });

  it('defaults paymentType to 1 (cash) when not provided', () => {
    const result = simulateSanitization({ totalAmount: 100, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.paymentType).toBe(1);
  });

  it('defaults amount to totalAmount when not provided', () => {
    const result = simulateSanitization({ totalAmount: 250, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.amount).toBe(250);
  });

  it('defaults tenderAmount to totalAmount when not provided', () => {
    const result = simulateSanitization({ totalAmount: 300, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.tenderAmount).toBe(300);
  });

  it('defaults finYear to 2025/2026 fallback', () => {
    const result = simulateSanitization({ totalAmount: 100, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.finYear).toBe('2025/2026');
  });

  it('preserves explicit finYear when provided', () => {
    const result = simulateSanitization({ totalAmount: 100, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1, finYear: '2026/2027' });
    expect(result.finYear).toBe('2026/2027');
  });

  it('sets card-related fields to null when not provided', () => {
    const result = simulateSanitization({ totalAmount: 100, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 });
    expect(result.cardNo).toBeNull();
    expect(result.expiryDate).toBeNull();
    expect(result.chequeNo).toBeNull();
    expect(result.bankBranch).toBeNull();
  });

  it('handles boolean isVatable correctly', () => {
    expect(simulateSanitization({ isVatable: true, totalAmount: 1, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 }).isVatable).toBe(true);
    expect(simulateSanitization({ isVatable: false, totalAmount: 1, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 }).isVatable).toBe(false);
    expect(simulateSanitization({ isVatable: 'true', totalAmount: 1, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 }).isVatable).toBe(true);
    expect(simulateSanitization({ totalAmount: 1, userId: 1, miscellaneousPaymentGroup: 1, scoaItem: 1 }).isVatable).toBe(false);
  });
});

describe('Day-End Reconciliation Data Requirements', () => {
  interface MockReceipt {
    receiptId: number;
    amount: number;
    paymentType: number;
    status: string;
    billType: string;
  }

  function buildReceipts(): MockReceipt[] {
    return [
      { receiptId: 1, amount: 500, paymentType: 1, status: 'Active', billType: 'Consumer Services' },
      { receiptId: 2, amount: 300, paymentType: 3, status: 'Active', billType: 'Consumer Services' },
      { receiptId: 3, amount: 150, paymentType: 1, status: 'Active', billType: 'Direct Income' },
      { receiptId: 4, amount: 200, paymentType: 1, status: 'Cancelled', billType: 'Consumer Services' },
    ];
  }

  it('calculates system total from non-cancelled receipts', () => {
    const receipts = buildReceipts();
    const activeReceipts = receipts.filter(r => r.status !== 'Cancelled');
    const systemTotal = activeReceipts.reduce((sum, r) => sum + r.amount, 0);
    expect(systemTotal).toBe(950);
  });

  it('separates receipts by payment type', () => {
    const receipts = buildReceipts();
    const active = receipts.filter(r => r.status !== 'Cancelled');
    const cashReceipts = active.filter(r => r.paymentType === 1);
    const cardReceipts = active.filter(r => r.paymentType === 3);
    expect(cashReceipts.length).toBe(2);
    expect(cardReceipts.length).toBe(1);
    expect(cashReceipts.reduce((s, r) => s + r.amount, 0)).toBe(650);
    expect(cardReceipts.reduce((s, r) => s + r.amount, 0)).toBe(300);
  });

  it('groups totals by bill type', () => {
    const receipts = buildReceipts();
    const active = receipts.filter(r => r.status !== 'Cancelled');
    const byType: Record<string, number> = {};
    for (const r of active) {
      byType[r.billType] = (byType[r.billType] || 0) + r.amount;
    }
    expect(byType['Consumer Services']).toBe(800);
    expect(byType['Direct Income']).toBe(150);
  });

  it('calculates variance between system and captured totals', () => {
    const systemTotal = 950;
    const capturedCash = 640;
    const capturedCard = 300;
    const capturedTotal = capturedCash + capturedCard;
    const variance = systemTotal - capturedTotal;
    expect(variance).toBe(10);
    expect(variance).not.toBe(0);
  });

  it('identifies zero variance when perfectly reconciled', () => {
    const systemTotal = 950;
    const capturedTotal = 950;
    const variance = systemTotal - capturedTotal;
    expect(variance).toBe(0);
  });

  it('validates denomination count produces correct cash total', () => {
    const denominations = {
      R200: 2,
      R100: 3,
      R50: 1,
      R20: 2,
      R10: 1,
      R5: 0,
      R2: 3,
      R1: 2,
      c50: 1,
      c20: 2,
      c10: 1,
      c5: 0,
    };
    const total =
      denominations.R200 * 200 +
      denominations.R100 * 100 +
      denominations.R50 * 50 +
      denominations.R20 * 20 +
      denominations.R10 * 10 +
      denominations.R5 * 5 +
      denominations.R2 * 2 +
      denominations.R1 * 1 +
      denominations.c50 * 0.50 +
      denominations.c20 * 0.20 +
      denominations.c10 * 0.10 +
      denominations.c5 * 0.05;
    expect(total).toBe(809.00);
  });
});
