import { describe, it, expect } from 'vitest';
import { validateAllocationAmount, calculateAllocationTotals, mapSearchResultToAllocationTarget } from '../client/src/lib/allocation-logic';

describe('validateAllocationAmount', () => {
  it('rejects NaN amounts', () => {
    const result = validateAllocationAmount(NaN, 0, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid Amount');
  });

  it('rejects zero amount', () => {
    const result = validateAllocationAmount(0, 0, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid Amount');
  });

  it('rejects negative amount', () => {
    const result = validateAllocationAmount(-50, 0, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid Amount');
  });

  it('accepts valid amount within transaction limit', () => {
    const result = validateAllocationAmount(500, 0, 1000);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts amount that exactly fills remaining balance', () => {
    const result = validateAllocationAmount(300, 700, 1000);
    expect(result.valid).toBe(true);
  });

  it('rejects amount that exceeds remaining balance', () => {
    const result = validateAllocationAmount(500, 700, 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot allocate');
    expect(result.error).toContain('R 500.00');
    expect(result.error).toContain('R 300.00');
  });

  it('handles floating point precision with epsilon tolerance', () => {
    const result = validateAllocationAmount(333.34, 666.66, 1000);
    expect(result.valid).toBe(true);
  });

  it('handles tiny remaining balance edge case', () => {
    const result = validateAllocationAmount(0.01, 999.99, 1000);
    expect(result.valid).toBe(true);
  });

  it('rejects when already fully allocated', () => {
    const result = validateAllocationAmount(0.01, 1000, 1000);
    expect(result.valid).toBe(false);
  });

  it('handles large transaction amounts correctly', () => {
    const result = validateAllocationAmount(50000, 0, 100000);
    expect(result.valid).toBe(true);
  });

  it('handles cent precision amounts', () => {
    const result = validateAllocationAmount(123.45, 876.55, 1000);
    expect(result.valid).toBe(true);
  });
});

describe('calculateAllocationTotals', () => {
  it('returns zero totals for empty lines array', () => {
    const result = calculateAllocationTotals([], 1000);
    expect(result.allocatedTotal).toBe(0);
    expect(result.remaining).toBe(1000);
    expect(result.isFullyAllocated).toBe(false);
  });

  it('calculates totals for single line', () => {
    const lines = [{ id: '1', accountNo: 'ACC1', name: 'Test', amount: 500, allocationType: 'ACCOUNT' as const }];
    const result = calculateAllocationTotals(lines, 1000);
    expect(result.allocatedTotal).toBe(500);
    expect(result.remaining).toBe(500);
    expect(result.isFullyAllocated).toBe(false);
  });

  it('calculates totals for multiple lines', () => {
    const lines = [
      { id: '1', accountNo: 'ACC1', name: 'A', amount: 300, allocationType: 'ACCOUNT' as const },
      { id: '2', accountNo: 'ACC2', name: 'B', amount: 400, allocationType: 'ACCOUNT' as const },
      { id: '3', accountNo: 'ACC3', name: 'C', amount: 200, allocationType: 'DIRECT' as const },
    ];
    const result = calculateAllocationTotals(lines, 1000);
    expect(result.allocatedTotal).toBe(900);
    expect(result.remaining).toBe(100);
    expect(result.isFullyAllocated).toBe(false);
  });

  it('identifies fully allocated transaction', () => {
    const lines = [
      { id: '1', accountNo: 'ACC1', name: 'A', amount: 600, allocationType: 'ACCOUNT' as const },
      { id: '2', accountNo: 'ACC2', name: 'B', amount: 400, allocationType: 'ACCOUNT' as const },
    ];
    const result = calculateAllocationTotals(lines, 1000);
    expect(result.allocatedTotal).toBe(1000);
    expect(result.remaining).toBe(0);
    expect(result.isFullyAllocated).toBe(true);
  });

  it('handles floating point precision for full allocation check', () => {
    const lines = [
      { id: '1', accountNo: 'ACC1', name: 'A', amount: 333.33, allocationType: 'ACCOUNT' as const },
      { id: '2', accountNo: 'ACC2', name: 'B', amount: 333.33, allocationType: 'ACCOUNT' as const },
      { id: '3', accountNo: 'ACC3', name: 'C', amount: 333.34, allocationType: 'ACCOUNT' as const },
    ];
    const result = calculateAllocationTotals(lines, 1000);
    expect(result.isFullyAllocated).toBe(true);
  });

  it('handles zero transaction amount', () => {
    const result = calculateAllocationTotals([], 0);
    expect(result.allocatedTotal).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.isFullyAllocated).toBe(true);
  });

  it('sums mixed allocation types correctly', () => {
    const lines = [
      { id: '1', accountNo: 'ACC1', name: 'Consumer', amount: 100.50, allocationType: 'ACCOUNT' as const },
      { id: '2', accountNo: 'CLR1', name: 'Clearance', amount: 200.25, allocationType: 'CLEARANCE' as const },
      { id: '3', accountNo: 'GRP1', name: 'Group', amount: 150.75, allocationType: 'GROUP' as const },
      { id: '4', accountNo: 'INC1', name: 'Direct', amount: 48.50, allocationType: 'DIRECT' as const },
    ];
    const result = calculateAllocationTotals(lines, 500);
    expect(result.allocatedTotal).toBe(500);
    expect(result.isFullyAllocated).toBe(true);
  });
});

describe('mapSearchResultToAllocationTarget', () => {
  it('maps ACCOUNT search result correctly', () => {
    const result = mapSearchResultToAllocationTarget({
      type: 'ACCOUNT',
      data: { accountNo: '000000012345', name: 'John Doe', apiId: 12345 },
    } as any);
    expect(result).not.toBeNull();
    expect(result!.accountNo).toBe('000000012345');
    expect(result!.name).toBe('John Doe');
    expect(result!.allocationType).toBe('ACCOUNT');
    expect(result!.description).toContain('Payment to');
  });

  it('maps PREPAID search result with meter info', () => {
    const result = mapSearchResultToAllocationTarget({
      type: 'PREPAID',
      data: { accountNo: '000000012345', name: 'Jane Doe', prepaidMeterNo: 'MTR-001', prepaidType: 'Electricity' },
    } as any);
    expect(result).not.toBeNull();
    expect(result!.allocationType).toBe('PREPAID');
    expect(result!.name).toContain('MTR-001');
    expect(result!.description).toContain('Prepaid Electricity');
  });

  it('maps DIRECT search result with SCOA item', () => {
    const result = mapSearchResultToAllocationTarget({
      type: 'DIRECT',
      data: { scoaItem: 'SCOA-100', description: 'Building Plans', scoaItemId: 100, miscPaymentGroupId: 5 },
    } as any);
    expect(result).not.toBeNull();
    expect(result!.allocationType).toBe('DIRECT');
    expect(result!.accountNo).toBe('SCOA-100');
    expect(result!.description).toContain('Direct Income');
  });

  it('maps CLEARANCE search result', () => {
    const result = mapSearchResultToAllocationTarget({
      type: 'CLEARANCE',
      data: { scheduleNo: 'CS-001' },
    } as any);
    expect(result).not.toBeNull();
    expect(result!.allocationType).toBe('CLEARANCE');
    expect(result!.accountNo).toBe('CS-001');
    expect(result!.description).toContain('Clearance Payment');
  });

  it('returns null for unknown type', () => {
    const result = mapSearchResultToAllocationTarget({
      type: 'UNKNOWN' as any,
      data: {},
    } as any);
    expect(result).toBeNull();
  });
});
