import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Gift, CreditCard, Landmark, RefreshCw, ChevronDown, ChevronUp,
  Scale, FileText, Banknote, Receipt, Activity, CalendarDays, Shield, Clock,
  BarChart3, TrendingUp, TrendingDown, Search
} from 'lucide-react';
import {
  getPaymentPlansByAccountId, getPaymentPlanRemainingCapital,
  getRepaymentPlanStatus, getPaymentExtensionSearchResults, getPaymentAmountByAccountIds,
  getDebitOrderDeductionByAccount, getDebitOrderDeduction,
  getAccountRatesDetails, getRatesRunHistory,
  getSupplementaryValuations, getValuationById, getValuationImportById,
  getRebateTransactionDetail,
  getDeposits, getDepositAmount, getPaymentIncentive, getPaymentIncentiveJournals,
  getBilledVsPaidAmounts,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, InfoField, SectionHeader, PaginatedTable, TabCard, FieldRow, getFinYearOptions, MONTHS } from './shared';

export function IncentivesTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const fmtAmt = (v: any) => {
    if (v == null || v === '') return '0.00';
    const n = Number(v);
    return isNaN(n) ? '0.00' : n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, journalResult] = await Promise.all([
        getPaymentIncentive(accountId),
        getPaymentIncentiveJournals(accountId).catch(() => []),
      ]);
      setData(result);
      setJournals(Array.isArray(journalResult) ? journalResult : journalResult ? [journalResult] : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load incentive data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const items = Array.isArray(data) ? data : data ? [data] : [];
  const hasIncentive = items.length > 0 && items.some((item: any) =>
    item.description || item.incentiveType || item.code || item.incentive || item.incentiveAmount || item.enable
  );

  if (!hasIncentive) {
    return (
      <div className="p-3 sm:p-5">
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Payment Incentive</h3>
          </div>
          <div className="py-12 px-3 sm:px-5 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-4">
              <Gift className="w-7 h-7 text-purple-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No Payment Incentive</p>
            <p className="text-xs text-slate-400 mt-1">There are no active payment incentives on this account</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      {items.filter((item: any) => item.description || item.incentiveType || item.code || item.incentive || item.incentiveAmount || item.enable).map((item: any, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Payment Incentive</h3>
            {item.enable && (
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">Active</Badge>
            )}
          </div>
          <div className="p-3 sm:p-5">
            <FieldRow label="Description" value={item.description} icon={<Gift className="w-3.5 h-3.5" />} />
            <FieldRow label="Incentive Type" value={item.incentiveType || item.code} icon={<Activity className="w-3.5 h-3.5" />} />
            <FieldRow label="Incentive Amount" value={item.incentiveAmount != null || item.incentive != null ? `R ${fmtAmt(item.incentiveAmount ?? item.incentive)}` : null} icon={<Banknote className="w-3.5 h-3.5" />} />
            <FieldRow label="Financial Year" value={item.financialYear} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid From" value={item.validPeriodFrom ? new Date(item.validPeriodFrom).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid To" value={item.validPeriodTo ? new Date(item.validPeriodTo).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="CRN" value={item.crn} icon={<Shield className="w-3.5 h-3.5" />} />
            <FieldRow label="Enabled" value={item.enable ? 'Yes' : 'No'} icon={<Shield className="w-3.5 h-3.5" />} />
          </div>
        </div>
      ))}

      {journals.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Incentive Journals</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{journals.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-incentive-journals-mobile">
            {journals.map((j: any, i: number) => (
              <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`row-journal-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{j.journalDate || j.date || j.transactionDate ? new Date(j.journalDate || j.date || j.transactionDate).toLocaleDateString('en-ZA') : '-'}</span>
                  <Badge variant="outline" className="text-[10px]">{j.status || j.journalStatus || '-'}</Badge>
                </div>
                <div className="text-xs text-slate-700 font-medium">{j.description || j.journalDescription || '-'}</div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-semibold">{fmtAmt(j.journalAmount ?? j.amount ?? j.incentiveAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-slate-600">{j.reference || j.journalReference || j.docNumber || '-'}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-incentive-journals">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Date</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Description</th>
                  <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Journal Amount</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Reference</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((j: any, i: number) => (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-purple-50/30 transition-colors" data-testid={`row-journal-${i}`}>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{j.journalDate || j.date || j.transactionDate ? new Date(j.journalDate || j.date || j.transactionDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2 px-3 text-slate-700">{j.description || j.journalDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{fmtAmt(j.journalAmount ?? j.amount ?? j.incentiveAmount ?? 0)}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{j.reference || j.journalReference || j.docNumber || '-'}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{j.status || j.journalStatus || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function DepositsTab({ accountId }: { accountId: number }) {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depsResult, amtResult] = await Promise.all([
        getDeposits(accountId).catch(() => []),
        getDepositAmount(accountId).catch(() => null),
      ]);
      setDeposits(Array.isArray(depsResult) ? depsResult : []);
      setDepositAmount(amtResult);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load deposit data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalAmt = typeof depositAmount === 'number' ? depositAmount : Number(depositAmount?.totalDeposit ?? depositAmount?.amount ?? 0) || 0;
  const totalDeposit = deposits.reduce((s, d) => s + (Number(d.deposit ?? d.depositAmount ?? d.amount ?? 0) || 0), 0);
  const totalPaid = deposits.reduce((s, d) => s + (Number(d.paidAmount ?? 0) || 0), 0);

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="deposits-tab">
      <div className="bg-gradient-to-br from-[var(--pos-accent)] via-[var(--pos-accent-dark)] to-[var(--pos-accent-dark)] rounded-xl p-4 sm:p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[var(--pos-accent-light)] text-xs font-medium uppercase tracking-wider">Total Deposit Amount</p>
            <p className={`text-3xl font-bold font-mono tracking-tight ${totalAmt < 0 ? 'text-red-300' : 'text-white'}`}>
              {fmt(totalAmt)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-[#F7F7F7]/50">
          <h3 className="text-xs sm:text-sm font-bold text-slate-700">Deposit:</h3>
        </div>
        {deposits.length > 0 ? (
          <>
            <div className="sm:hidden p-2 space-y-2">
              {deposits.map((dep: any, i: number) => (
                <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`row-deposit-mobile-${i}`}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Service Type</span>
                    <span className="text-slate-800 font-semibold text-right">{dep.serviceDesc || dep.serviceDescription || dep.description || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Receipt No</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{dep.receiptNo || dep.docNumber || dep.reference || ''}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Receipt Date</span>
                    <span className="text-slate-800 font-semibold text-right">{dep.receiptDate || dep.dateCaptured || dep.depositDate ? new Date(dep.receiptDate || dep.dateCaptured || dep.depositDate).toLocaleDateString('en-ZA') : '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Payment Type</span>
                    <span className="text-slate-800 font-semibold text-right">{dep.paymentType || dep.paymentMethod || dep.type || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Deposit Amount</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{fmt(dep.deposit ?? dep.depositAmount ?? dep.amount ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Cashier</span>
                    <span className="text-slate-800 font-semibold text-right">{dep.cashierName || dep.cashier || dep.capturedBy || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Paid Amount</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{fmt(dep.paidAmount ?? 0)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t-2 border-[#BFBFBF] pt-2 px-1 flex justify-between text-xs font-bold text-[#2E2E2E]">
                <span>Total</span>
                <div className="flex gap-4 font-mono">
                  <span>{fmt(totalDeposit)}</span>
                  <span>({fmt(Math.abs(totalPaid))})</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-deposits">
                <thead>
                  <tr className="border-b border-[#D6D6D6] bg-white">
                    <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Service Type</th>
                    <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Receipt No</th>
                    <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Receipt Date</th>
                    <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Payment Type</th>
                    <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Deposit Amount</th>
                    <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Cashier</th>
                    <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold">Paid Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((dep: any, i: number) => (
                    <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/40 transition-colors" data-testid={`row-deposit-${i}`}>
                      <td className="py-3 px-5 text-slate-700 font-medium">{dep.serviceDesc || dep.serviceDescription || dep.description || '-'}</td>
                      <td className="py-3 px-5 text-slate-600 font-mono text-[13px]">{dep.receiptNo || dep.docNumber || dep.reference || ''}</td>
                      <td className="py-3 px-5 text-slate-600">{dep.receiptDate || dep.dateCaptured || dep.depositDate ? new Date(dep.receiptDate || dep.dateCaptured || dep.depositDate).toLocaleDateString('en-ZA') : '-'}</td>
                      <td className="py-3 px-5 text-slate-600">{dep.paymentType || dep.paymentMethod || dep.type || '-'}</td>
                      <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.deposit ?? dep.depositAmount ?? dep.amount ?? 0)}</td>
                      <td className="py-3 px-5 text-slate-600">{dep.cashierName || dep.cashier || dep.capturedBy || '-'}</td>
                      <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.paidAmount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#BFBFBF] bg-[#F7F7F7]">
                    <td colSpan={4} className="py-3 px-5"></td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-[#2E2E2E] text-[14px]">{fmt(totalDeposit)}</td>
                    <td className="py-3 px-5"></td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-[#2E2E2E] text-[14px]">({fmt(Math.abs(totalPaid))})</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <Landmark className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No deposit records found for this account</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentPlansTab({ accountId }: { accountId: number }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [remainingCapital, setRemainingCapital] = useState<any>(null);
  const [repaymentStatus, setRepaymentStatus] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pl, rc, rs, ext, pa] = await Promise.all([
        getPaymentPlansByAccountId(accountId).catch(() => []),
        getPaymentPlanRemainingCapital(accountId).catch(() => null),
        getRepaymentPlanStatus(accountId).catch(() => []),
        getPaymentExtensionSearchResults(accountId).catch(() => []),
        getPaymentAmountByAccountIds(accountId).catch(() => []),
      ]);
      setPlans(Array.isArray(pl) ? pl : pl ? [pl] : []);
      setRemainingCapital(rc);
      const statusArr = Array.isArray(rs) ? rs : rs ? [rs] : [];
      setRepaymentStatus(statusArr);
      setExtensions(Array.isArray(ext) ? ext : ext ? [ext] : []);
      setPaymentAmounts(Array.isArray(pa) ? pa : pa ? [pa] : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load payment plans');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmtAmt = (v: any) => { if (v == null || v === '') return '0.00'; const n = Number(v); return isNaN(n) ? '0.00' : n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-ZA') : '-';
  const hasPlans = plans.length > 0;
  const hasExtensions = extensions.length > 0;
  const hasPaymentAmounts = paymentAmounts.length > 0;
  const repaymentLabels = ['Interest Waiver', 'Rebate'];
  const hasRepaymentData = repaymentStatus.length > 0;
  const hasCapital = remainingCapital && (typeof remainingCapital !== 'object' || Object.values(remainingCapital).some((v: any) => v != null && v !== 0));

  const initialDownPayment = plans.length > 0
    ? fmtAmt(plans[0]?.initialDownPayment ?? plans[0]?.downPayment ?? plans[0]?.depositAmount ?? 0)
    : '0.00';

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Payment Plans - Capital Cost</h3>
          {hasPlans && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{plans.length}</Badge>}
        </div>

        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-[#F7F7F7] border-b border-[#D6D6D6]">
          <p className="text-xs sm:text-sm text-slate-700">
            <span className="font-semibold">Initial Down Payment That Was Required:</span>{' '}
            <span className="font-mono font-bold text-[#2E2E2E]">{initialDownPayment}</span>
          </p>
        </div>

        <div className="sm:hidden p-2 space-y-2">
          {hasPlans ? plans.map((p: any, i: number) => {
            const isActive = p.status === 'Active' || p.isActive;
            return (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`plan-card-${i}`}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Status</span>
                  <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-500 border-[#D6D6D6]'}`}>
                    {p.status || p.planStatus || (p.isActive ? 'Active' : 'Inactive')}
                  </Badge>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Capital Cost Type</span>
                  <span className="text-slate-800 font-semibold text-right">{p.capitalCostType || p.planType || p.paymentPlanType || p.description || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Service Type</span>
                  <span className="text-slate-800 font-semibold text-right">{p.serviceType || p.additionalBillingType || p.billingType || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Contract Number</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{p.contractNumber || p.contractNo || p.agreementNo || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Capital Amount</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(p.capitalAmount ?? p.amount ?? p.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Period</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{p.period ?? p.numberOfInstalments ?? p.termMonths ?? '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Instalment Amount</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(p.instalmentAmount ?? p.instalment ?? p.monthlyAmount)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Commencement Date</span>
                  <span className="text-slate-800 font-semibold text-right">{fmtDate(p.commencementDate ?? p.startDate ?? p.effectiveDate)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Expected End Date</span>
                  <span className="text-slate-800 font-semibold text-right">{fmtDate(p.expectedEndDate ?? p.endDate ?? p.expiryDate)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Remaining Capital</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(p.remainingCapitalAmount ?? p.remainingCapital ?? p.outstandingAmount)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Remaining Period</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{p.remainingPeriod ?? p.remainingInstalments ?? p.remainingMonths ?? '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Total Payments</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(p.totalPaymentsReceived ?? p.totalPaid ?? p.paymentsReceived)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Instalment Counter</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{p.instalmentCounter ?? p.paidInstalments ?? p.instalmentsPaid ?? '-'}</span>
                </div>
              </div>
            );
          }) : (
            <div className="py-10 text-center text-slate-400 text-sm">No records to display.</div>
          )}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-payment-plans">
            <thead>
              <tr className="bg-[#F2F4F7] border-b-2 border-[#D6D6D6]">
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Status</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Capital Cost Type</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Service Type / Additional Billing Type</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Contract Number</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Capital Amount</th>
                <th className="text-center py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Period</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Instalment Amount</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Commencement Date</th>
                <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Expected End Date</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Remaining Capital Amount</th>
                <th className="text-center py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Remaining Period</th>
                <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Total Payments Received</th>
                <th className="text-center py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Instalment Counter</th>
              </tr>
            </thead>
            <tbody>
              {hasPlans ? plans.map((p: any, i: number) => {
                const isActive = p.status === 'Active' || p.isActive;
                return (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors" data-testid={`plan-row-${i}`}>
                    <td className="py-2.5 px-3">
                      <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-500 border-[#D6D6D6]'}`}>
                        {p.status || p.planStatus || (p.isActive ? 'Active' : 'Inactive')}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{p.capitalCostType || p.planType || p.paymentPlanType || p.description || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{p.serviceType || p.additionalBillingType || p.billingType || '-'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{p.contractNumber || p.contractNo || p.agreementNo || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">{fmtAmt(p.capitalAmount ?? p.amount ?? p.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{p.period ?? p.numberOfInstalments ?? p.termMonths ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmtAmt(p.instalmentAmount ?? p.instalment ?? p.monthlyAmount)}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(p.commencementDate ?? p.startDate ?? p.effectiveDate)}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(p.expectedEndDate ?? p.endDate ?? p.expiryDate)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmtAmt(p.remainingCapitalAmount ?? p.remainingCapital ?? p.outstandingAmount)}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{p.remainingPeriod ?? p.remainingInstalments ?? p.remainingMonths ?? '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmtAmt(p.totalPaymentsReceived ?? p.totalPaid ?? p.paymentsReceived)}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{p.instalmentCounter ?? p.paidInstalments ?? p.instalmentsPaid ?? '-'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400 text-sm">No records to display.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-[#F7F7F7] border-t border-[#D6D6D6] text-xs text-slate-500">
          <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
          <span>{hasPlans ? `1 - ${plans.length} of ${plans.length}` : '0 of 0'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Repayment Plan Status</h3>
          </div>
          <div className="p-3 sm:p-5">
            {hasRepaymentData ? (
              <div className="space-y-3">
                {repaymentStatus.map((item: any, i: number) => {
                  const label = repaymentLabels[i] || `Status ${i + 1}`;
                  const value = typeof item === 'string' ? item : item?.status || item?.description || JSON.stringify(item);
                  const isActive = value && value !== 'N/A' && value !== 'None' && value !== '';
                  return (
                    <div key={i} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#F7F7F7] border border-[#E5E5E5]">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                      </div>
                      <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[11px] ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-[#F2F4F7] text-slate-500 border-[#D6D6D6]'}`}>{value}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No repayment plan status available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Remaining Capital</h3>
          </div>
          <div className="p-3 sm:p-5">
            {hasCapital ? (
              typeof remainingCapital === 'object' ? (
                Object.entries(remainingCapital).filter(([k, v]) => !k.startsWith('_') && v != null && v !== 0).map(([key, val]) => (
                  <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl font-bold text-[var(--pos-accent)]">R {Number(remainingCapital).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-slate-400 mt-1">Outstanding Capital Balance</p>
                </div>
              )
            ) : (
              <div className="py-6 text-center">
                <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No remaining capital on account</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasExtensions && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Payment Extensions</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{extensions.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2" data-testid="table-payment-extensions-mobile">
            {extensions.map((ext: any, i: number) => (
              <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{fmtDate(ext.extensionDate ?? ext.date)}</span>
                  <Badge variant="outline" className="text-[10px]">{ext.status || '-'}</Badge>
                </div>
                <div className="text-xs text-slate-700 font-medium">{ext.extensionType || ext.type || ext.description || '-'}</div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-semibold">{fmtAmt(ext.amount ?? ext.extensionAmount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-payment-extensions">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Date</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Extension Type</th>
                  <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Amount</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext: any, i: number) => (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-amber-50/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtDate(ext.extensionDate ?? ext.date)}</td>
                    <td className="py-2.5 px-3 text-slate-700">{ext.extensionType || ext.type || ext.description || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{fmtAmt(ext.amount ?? ext.extensionAmount)}</td>
                    <td className="py-2.5 px-3"><Badge variant="outline" className="text-[10px]">{ext.status || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Banknote className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Payment History</h3>
          {hasPaymentAmounts && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{paymentAmounts.length}</Badge>}
        </div>
        {hasPaymentAmounts ? (
          <>
            <div className="sm:hidden p-2 space-y-2">
              {paymentAmounts.map((pa: any, i: number) => (
                <div key={i} className={`border border-[#D6D6D6] rounded-lg p-3 space-y-1.5 ${pa.cancelReson ? 'bg-red-50/30' : ''}`}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Receipt No</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{pa.receiptNo || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Date</span>
                    <span className="text-slate-800 font-semibold text-right">{pa.receiptDate ? new Date(pa.receiptDate).toLocaleDateString('en-ZA') : '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Payment Type</span>
                    <Badge variant="outline" className={`text-[10px] ${pa.paymentType === 'Cash' ? 'bg-green-50 text-green-700 border-green-200' : pa.paymentType === 'Credit Card' ? 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]' : 'bg-[#F7F7F7] text-slate-600 border-[#D6D6D6]'}`}>
                      {pa.paymentType || '-'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Amount</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{fmtAmt(pa.amount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Cashier</span>
                    <span className="text-slate-800 font-semibold text-right">{pa.cashier || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Cash Book</span>
                    <span className="text-slate-800 font-semibold text-right">{pa.cashBook || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Card/Cheque</span>
                    <span className="text-slate-800 font-semibold text-right font-mono">{pa.cardChequeDetail || '-'}</span>
                  </div>
                  {pa.cancelReson && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Cancel Reason</span>
                      <span className="text-red-600 font-semibold text-right">{pa.cancelReson}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs" data-testid="table-payment-amounts">
                <thead>
                  <tr className="bg-[#F2F4F7] border-b border-[#D6D6D6]">
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Receipt No</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Date</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Payment Type</th>
                    <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Amount</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Cashier</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Cash Book</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Card/Cheque</th>
                    <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Cancel Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentAmounts.map((pa: any, i: number) => (
                    <tr key={i} className={`border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)] transition-colors ${pa.cancelReson ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 px-3 font-mono font-medium">{pa.receiptNo || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{pa.receiptDate ? new Date(pa.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={`text-[10px] ${pa.paymentType === 'Cash' ? 'bg-green-50 text-green-700 border-green-200' : pa.paymentType === 'Credit Card' ? 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]' : 'bg-[#F7F7F7] text-slate-600 border-[#D6D6D6]'}`}>
                          {pa.paymentType || '-'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmtAmt(pa.amount)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{pa.cashier || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{pa.cashBook || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{pa.cardChequeDetail || '-'}</td>
                      <td className="py-2.5 px-3">{pa.cancelReson ? <span className="text-red-600 font-medium">{pa.cancelReson}</span> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-8 px-3 sm:px-5 flex flex-col items-center justify-center text-center">
            <Banknote className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-xs text-slate-400">No payment records found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentExtensionHistoryTab({ accountId }: { accountId: number }) {
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevAccountId = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPaymentExtensionSearchResults(accountId);
      setExtensions(Array.isArray(result) ? result : result ? [result] : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load payment extension history');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (prevAccountId.current !== accountId) {
      prevAccountId.current = accountId;
      load();
    }
  }, [accountId, load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const formatDate = (v: any) => {
    if (!v) return '';
    try { const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ZA'); } catch { return String(v); }
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5" data-testid="payment-extension-history-panel">
      <h3 className="text-base font-bold text-slate-800">Payment Extension History</h3>
      <PaginatedTable
        data={extensions}
        tableId="payment-extension-history"
        columns={[
          { key: 'extensionStatus', label: 'Extension Status', render: (r: any) => r.extensionStatus || r.status || r.statusDesc || '' },
          { key: 'extensionDescription', label: 'Extension Description', render: (r: any) => r.extensionDescription || r.description || r.extensionType || r.type || '' },
          { key: 'commencementDate', label: 'Commencement Date', render: (r: any) => formatDate(r.commencementDate || r.startDate) },
          { key: 'terminationDate', label: 'Termination Date', render: (r: any) => formatDate(r.terminationDate || r.endDate) },
          { key: 'capturedBy', label: 'Captured By', render: (r: any) => r.capturedBy || r.capturerName || r.capturer || '' },
          { key: 'captureDate', label: 'Capture Date', render: (r: any) => formatDate(r.captureDate || r.dateCaptured) },
        ]}
      />
    </div>
  );
}

export function DebitOrdersTab({ accountId }: { accountId: number }) {
  const [deductions, setDeductions] = useState<any[]>([]);
  const [debitOrders, setDebitOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ded, dob] = await Promise.all([
        getDebitOrderDeductionByAccount(accountId).catch(() => []),
        getDebitOrderDeduction(accountId).catch(() => []),
      ]);
      setDeductions(Array.isArray(ded) ? ded : ded ? [ded] : []);
      setDebitOrders(Array.isArray(dob) ? dob : dob ? [dob] : []);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load debit order data');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-ZA') : '-';

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Debit Order Deduction List</h3>
          {(deductions.length + debitOrders.length) > 0 && (
            <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{deductions.length + debitOrders.length} record{(deductions.length + debitOrders.length) !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="sm:hidden p-2 space-y-2">
          {(deductions.length + debitOrders.length) === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm italic">No records to display.</div>
          ) : [...deductions, ...debitOrders].map((d: any, i: number) => (
            <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`row-debit-mobile-${i}`}>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Nr</span>
                <span className="text-slate-800 font-semibold text-right">{d.nr ?? d.number ?? i + 1}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Status</span>
                <Badge variant={d.status === 'Active' || d.status === 'Successful' ? 'default' : 'secondary'} className="text-[10px]">
                  {d.status || d.deductionStatus || '-'}
                </Badge>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Bank Name</span>
                <span className="text-slate-800 font-semibold text-right">{d.bankName || d.bank || '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Branch Code</span>
                <span className="text-slate-800 font-semibold text-right font-mono">{d.branchCode || d.branchNumber || '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Account Number</span>
                <span className="text-slate-800 font-semibold text-right font-mono">{d.accountNumber || d.bankAccountNumber || d.bankAccount || '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Deduction Day</span>
                <span className="text-slate-800 font-semibold text-right">{d.deductionDay ?? d.dayOfDeduction ?? '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Service Type</span>
                <span className="text-slate-800 font-semibold text-right">{d.serviceType || d.serviceDescription || d.accountType || '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Maximum Amount</span>
                <span className="text-slate-800 font-semibold text-right font-mono">{fmt(d.maximumAmount ?? d.amount ?? d.deductionAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Total Max Amount</span>
                <span className="text-slate-800 font-semibold text-right font-mono">{fmt(d.totalMaximumAmount ?? d.debitOrderAmount ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Ageing</span>
                <span className="text-slate-800 font-semibold text-right">{d.ageing ?? d.aging ?? '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Commencement</span>
                <span className="text-slate-800 font-semibold text-right">{fmtDate(d.commencementDate ?? d.startDate)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Deduction Date</span>
                <span className="text-slate-800 font-semibold text-right">{fmtDate(d.deductionDate ?? d.date)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Date Captured</span>
                <span className="text-slate-800 font-semibold text-right">{fmtDate(d.dateCaptured ?? d.capturedDate ?? d.createdDate)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Captured By</span>
                <span className="text-slate-800 font-semibold text-right">{d.capturedBy ?? d.createdBy ?? '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Termination Date</span>
                <span className="text-slate-800 font-semibold text-right">{fmtDate(d.terminationDate)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Termination Reason</span>
                <span className="text-slate-800 font-semibold text-right">{d.terminationReason ?? '-'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Terminated By</span>
                <span className="text-slate-800 font-semibold text-right">{d.terminatedBy ?? '-'}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-debit-order-deductions">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold w-[40px]">Nr</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Status</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Bank Name</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">Branch Code</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[110px]">Account Number</th>
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Deduction Day</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Service Type</th>
                <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Maximum Amount</th>
                <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Total Maximum Amount</th>
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[60px]">Ageing</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[110px]">Commencement Date</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Deduction Date</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Date Captured</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[90px]">Captured By</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[110px]">Termination Date</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Termination Reason</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[100px]">Terminated By</th>
              </tr>
            </thead>
            <tbody>
              {(deductions.length + debitOrders.length) === 0 ? (
                <tr><td colSpan={17} className="py-8 text-center text-slate-400 text-sm italic">No records to display.</td></tr>
              ) : [...deductions, ...debitOrders].map((d: any, i: number) => (
                <tr key={i} className="border-b border-[#E5E5E5] hover:bg-teal-50/30 transition-colors" data-testid={`row-debit-${i}`}>
                  <td className="py-2 px-2 text-center text-slate-500 text-[13px]">{d.nr ?? d.number ?? i + 1}</td>
                  <td className="py-2 px-2">
                    <Badge variant={d.status === 'Active' || d.status === 'Successful' ? 'default' : 'secondary'} className="text-[10px]">
                      {d.status || d.deductionStatus || '-'}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-[13px] text-slate-700">{d.bankName || d.bank || '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600 font-mono">{d.branchCode || d.branchNumber || '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600 font-mono">{d.accountNumber || d.bankAccountNumber || d.bankAccount || '-'}</td>
                  <td className="py-2 px-2 text-center text-[13px] text-slate-600">{d.deductionDay ?? d.dayOfDeduction ?? '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-700">{d.serviceType || d.serviceDescription || d.accountType || '-'}</td>
                  <td className="py-2 px-2 text-right font-mono text-[13px]">{fmt(d.maximumAmount ?? d.amount ?? d.deductionAmount ?? 0)}</td>
                  <td className="py-2 px-2 text-right font-mono text-[13px]">{fmt(d.totalMaximumAmount ?? d.debitOrderAmount ?? 0)}</td>
                  <td className="py-2 px-2 text-center text-[13px] text-slate-600">{d.ageing ?? d.aging ?? '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(d.commencementDate ?? d.startDate)}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(d.deductionDate ?? d.date)}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(d.dateCaptured ?? d.capturedDate ?? d.createdDate)}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600">{d.capturedBy ?? d.createdBy ?? '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-600">{fmtDate(d.terminationDate)}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-500">{d.terminationReason ?? '-'}</td>
                  <td className="py-2 px-2 text-[13px] text-slate-500">{d.terminatedBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 sm:px-5 py-2.5 bg-[#F7F7F7] border-t border-[#D6D6D6] flex items-center justify-end">
          <span className="text-xs text-slate-500">{deductions.length + debitOrders.length} record{(deductions.length + debitOrders.length) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

export function BilledVsPaidTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(getFinYearOptions()[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBilledVsPaidAmounts(accountId, selectedYear);
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load billed vs paid data');
    } finally {
      setLoading(false);
    }
  }, [accountId, selectedYear]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const fmt = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v) || 0;
    return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getBilled = (d: any) => Number(d.totalBillAmount ?? d.billingAmount ?? d.billedAmount ?? d.amount ?? 0) || 0;
  const getPaid = (d: any) => Number(d.paidAmount ?? d.paymentAmount ?? 0) || 0;
  const getMonth = (d: any) => d.processingMonth || d.month || d.billingMonth || d.period || '-';

  const totalBilled = data.reduce((s, d) => s + getBilled(d), 0);
  const totalPaid = data.reduce((s, d) => s + getPaid(d), 0);
  const maxVal = Math.max(...data.map(d => Math.max(Math.abs(getBilled(d)), Math.abs(getPaid(d)))), 1);

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-white" />
          <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Billed vs Paid Amounts</h3>
        </div>
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-[#F7F7F7] border-b border-[#D6D6D6] flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-sm border border-[#BFBFBF] rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-[var(--pos-accent-tint)] focus:border-[var(--pos-accent)] outline-none"
            data-testid="select-billed-year"
          >
            {getFinYearOptions().map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>

        <div className="sm:hidden p-2 space-y-2">
          {data.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm italic">No records to display.</div>
          ) : data.map((d: any, i: number) => {
            const billed = getBilled(d);
            const paid = getPaid(d);
            return (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`row-billed-mobile-${i}`}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Financial Year</span>
                  <span className="text-slate-800 font-semibold text-right">{d.financialYear || selectedYear}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Month</span>
                  <span className="text-slate-800 font-semibold text-right">{getMonth(d)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--pos-accent)] font-medium">Billing Amount</span>
                  <span className="text-[var(--pos-accent)] font-semibold text-right font-mono">{fmt(billed)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-rose-600 font-medium">Paid Amount</span>
                  <span className={`font-semibold text-right font-mono ${paid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(paid)}</span>
                </div>
              </div>
            );
          })}
          {data.length > 0 && (
            <div className="border-t-2 border-[#D6D6D6] pt-2 px-1 space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#2E2E2E]">Total Billed</span>
                <span className="text-[var(--pos-accent)] font-mono">{fmt(totalBilled)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#2E2E2E]">Total Paid</span>
                <span className={`font-mono ${totalPaid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(totalPaid)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-billed-vs-paid">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                <th className="text-left py-2.5 px-4 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[140px]">Financial Year</th>
                <th className="text-left py-2.5 px-4 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Month</th>
                <th className="text-right py-2.5 px-4 text-[11px] uppercase tracking-wider text-[var(--pos-accent)] font-bold min-w-[140px]">Billing Amount</th>
                <th className="text-right py-2.5 px-4 text-[11px] uppercase tracking-wider text-rose-600 font-bold min-w-[140px]">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400 text-sm italic">No records to display.</td></tr>
              ) : data.map((d: any, i: number) => {
                const billed = getBilled(d);
                const paid = getPaid(d);
                return (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)] transition-colors" data-testid={`row-billed-${i}`}>
                    <td className="py-2.5 px-4 text-[13px] text-slate-700">{d.financialYear || selectedYear}</td>
                    <td className="py-2.5 px-4 text-[13px] font-medium text-slate-800">{getMonth(d)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[13px] text-[var(--pos-accent)] font-semibold">{fmt(billed)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-[13px] font-semibold ${paid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(paid)}</td>
                  </tr>
                );
              })}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#D6D6D6] bg-[var(--pos-accent-tint)]">
                  <td colSpan={2} className="py-2.5 px-4 font-bold text-[#2E2E2E] text-[13px]">Total</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[var(--pos-accent)] text-[13px]">{fmt(totalBilled)}</td>
                  <td className={`py-2.5 px-4 text-right font-mono font-bold text-[13px] ${totalPaid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(totalPaid)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="px-3 sm:px-5 py-2.5 bg-[#F7F7F7] border-t border-[#D6D6D6] flex items-center justify-end">
          <span className="text-xs text-slate-500">{data.length} of {data.length} records</span>
        </div>
      </div>

      {data.length > 0 && (() => {
        const chartData = data.map(d => ({
          month: getMonth(d),
          billed: Math.abs(getBilled(d)),
          paid: Math.abs(getPaid(d)),
        }));
        const chartMax = Math.max(...chartData.map(c => Math.max(c.billed, c.paid)), 1);
        const niceMax = (() => {
          const mag = Math.pow(10, Math.floor(Math.log10(chartMax)));
          const norm = chartMax / mag;
          const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
          return niceNorm * mag;
        })();
        const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => f * niceMax);
        const chartHeight = 280;

        return (
          <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-white" />
                <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Monthly Billing vs Payments</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[var(--pos-accent)]" />
                  <span className="text-[10px] text-slate-300 font-medium">Billed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                  <span className="text-[10px] text-slate-300 font-medium">Paid</span>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="flex" data-testid="chart-billed-vs-paid">
                <div className="flex flex-col justify-between pr-2 sm:pr-3 flex-shrink-0" style={{ height: `${chartHeight}px` }}>
                  {gridLines.slice().reverse().map((val, gi) => (
                    <span key={gi} className="text-[10px] text-slate-400 font-mono leading-none text-right" style={{ minWidth: '50px' }}>
                      {val >= 1000 ? `R ${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `R ${val.toFixed(0)}`}
                    </span>
                  ))}
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-0">
                    {gridLines.map((val, gi) => (
                      <div
                        key={gi}
                        className="absolute left-0 right-0 border-t border-[#E5E5E5]"
                        style={{ bottom: `${(val / niceMax) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="relative flex items-end justify-around h-full gap-1 sm:gap-2" style={{ height: `${chartHeight}px` }}>
                    {chartData.map((c, i) => {
                      const billedH = niceMax > 0 ? (c.billed / niceMax) * chartHeight : 0;
                      const paidH = niceMax > 0 ? (c.paid / niceMax) * chartHeight : 0;
                      return (
                        <div key={i} className="flex flex-col items-center flex-1 max-w-[90px]" style={{ height: '100%', justifyContent: 'flex-end' }}>
                          <div className="flex items-end gap-[6px] sm:gap-[8px] w-full justify-center">
                            <div className="group/billed relative" style={{ width: '38%' }}>
                              <div
                                className="w-full rounded-t-[3px] transition-all duration-500 ease-out cursor-pointer"
                                style={{
                                  height: `${Math.max(billedH, 3)}px`,
                                  background: 'linear-gradient(180deg, #818cf8 0%, #6366f1 100%)',
                                  boxShadow: '0 1px 3px rgba(99, 102, 241, 0.3)',
                                }}
                              />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/billed:block z-30 pointer-events-none">
                                <div className="bg-[var(--pos-accent)] text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-lg">
                                  <div className="font-semibold">R {fmt(c.billed)}</div>
                                </div>
                                <div className="w-2 h-2 bg-[var(--pos-accent)] rotate-45 mx-auto -mt-1" />
                              </div>
                            </div>
                            <div className="group/paid relative" style={{ width: '38%' }}>
                              <div
                                className="w-full rounded-t-[3px] transition-all duration-500 ease-out cursor-pointer"
                                style={{
                                  height: `${Math.max(paidH, 3)}px`,
                                  background: 'linear-gradient(180deg, #6ee7b7 0%, #34d399 100%)',
                                  boxShadow: '0 1px 3px rgba(52, 211, 153, 0.3)',
                                }}
                              />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/paid:block z-30 pointer-events-none">
                                <div className="bg-emerald-700 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap shadow-lg">
                                  <div className="font-semibold">R {fmt(c.paid)}</div>
                                </div>
                                <div className="w-2 h-2 bg-emerald-700 rotate-45 mx-auto -mt-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around mt-2 border-t border-[#D6D6D6] pt-2">
                    {chartData.map((c, i) => (
                      <div key={i} className="flex-1 max-w-[80px] text-center">
                        <div className="text-[11px] font-semibold text-slate-700 truncate">{c.month.substring(0, 3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#F7F7F7] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[var(--pos-accent)]" />
            </div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Billed</span>
          </div>
          <div className="text-lg font-bold text-[var(--pos-accent)] font-mono mt-1">R {fmt(totalBilled)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Paid</span>
          </div>
          <div className={`text-lg font-bold font-mono mt-1 ${totalPaid < 0 ? 'text-red-600' : 'text-rose-600'}`}>R {fmt(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalBilled - totalPaid > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <Banknote className={`w-4 h-4 ${totalBilled - totalPaid > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Balance</span>
          </div>
          <div className={`text-lg font-bold font-mono mt-1 ${totalBilled - totalPaid > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>R {fmt(totalBilled - totalPaid)}</div>
        </div>
      </div>
    </div>
  );
}

export function RatesValuationsTab({ accountId, propertyId }: { accountId: number; propertyId?: number }) {
  const [ratesDetails, setRatesDetails] = useState<any>(null);
  const [ratesHistory, setRatesHistory] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [valuationData, setValuationData] = useState<any>(null);
  const [valuationImport, setValuationImport] = useState<any>(null);
  const [selectedFinYear, setSelectedFinYear] = useState(getFinYearOptions()[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const propId = propertyId || accountId;
  const fmt = (v: any) => { if (v == null || v === '') return '0.00'; const n = Number(v); return isNaN(n) ? '0.00' : n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-ZA') : '-';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rd, rh, sv, vById, vImport] = await Promise.allSettled([
        getAccountRatesDetails(accountId, selectedFinYear),
        getRatesRunHistory(accountId, selectedFinYear),
        getSupplementaryValuations(propId),
        getValuationById(propId),
        getValuationImportById(propId),
      ]);
      if (rd.status === 'fulfilled' && rd.value && !rd.value._error) setRatesDetails(rd.value);
      if (rh.status === 'fulfilled') setRatesHistory(Array.isArray(rh.value) ? rh.value : []);
      if (sv.status === 'fulfilled') setValuations(Array.isArray(sv.value) ? sv.value : []);
      if (vById.status === 'fulfilled' && vById.value && !vById.value._error) setValuationData(vById.value);
      if (vImport.status === 'fulfilled' && vImport.value && !vImport.value._error) setValuationImport(vImport.value);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load rates & valuations');
    } finally {
      setLoading(false);
    }
  }, [accountId, propId, selectedFinYear]);

  useEffect(() => { load(); }, [load]);

  const hasRatesObj = ratesDetails && (ratesDetails.annualPropertyRates || ratesDetails.installment || ratesDetails.rebateAmount);
  const hasAny = hasRatesObj || ratesHistory.length > 0 || valuations.length > 0 || valuationData || valuationImport;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!hasAny) return <EmptyState message="No rates & valuations data available" />;

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <label className="text-xs font-semibold text-slate-600">Financial Year:</label>
        <select
          value={selectedFinYear}
          onChange={(e) => { setSelectedFinYear(e.target.value); loaded.current = false; }}
          className="text-xs border border-[#BFBFBF] rounded px-2 py-1.5 bg-white"
          data-testid="select-rates-finyear"
        >
          {getFinYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {valuations.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Landmark className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Property Valuations</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{valuations.length}</Badge>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {valuations.map((v: any, i: number) => (
              <div key={i} className="p-4 hover:bg-[var(--pos-accent-tint)]/30 transition-colors" data-testid={`valuation-item-${i}`}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] font-semibold">{v.type || 'General'}</Badge>
                  <Badge className={`text-[10px] ${v.valuationStatus === 'Active' ? 'bg-green-600' : 'bg-slate-500'}`}>{v.valuationStatus || '-'}</Badge>
                  {v.reason && <Badge variant="outline" className="text-[10px]">{v.reason}</Badge>}
                  {v.financialYear && <span className="text-[10px] text-slate-500 ml-auto">FY: {v.financialYear}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Stand Market Value</div>
                    <div className="font-mono font-bold text-slate-800">R {fmt(v.standMarketValue)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Improvement Value</div>
                    <div className="font-mono font-bold text-slate-800">R {fmt(v.improvementValue)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Stand Size</div>
                    <div className="font-mono text-slate-800">{v.standSize ?? '-'} m&sup2;</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Land Size</div>
                    <div className="font-mono text-slate-800">{v.landSize ?? '-'} ha</div>
                  </div>
                  {Number(v.agriculturalValue || 0) > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Agricultural Value</div>
                      <div className="font-mono text-slate-800">R {fmt(v.agriculturalValue)}</div>
                    </div>
                  )}
                  {v.standValue > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Stand Value</div>
                      <div className="font-mono text-slate-800">R {fmt(v.standValue)}</div>
                    </div>
                  )}
                  {v.exemptValue > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Exempt Value</div>
                      <div className="font-mono text-green-700">R {fmt(v.exemptValue)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Zone</div>
                    <div className="text-slate-800">{v.zoneDesc || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Type of Use</div>
                    <div className="text-slate-800">{v.typeOfUseDesc || '-'}</div>
                  </div>
                  <div className="col-span-2 sm:col-span-3 md:col-span-4">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Rates Tariff Code</div>
                    <div className="text-slate-800 text-xs">{v.ratesTariffCode || '-'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-[#E5E5E5] text-[10px] text-slate-500">
                  <span>Roll No: {v.rollNumber || '-'}</span>
                  <span>Roll Date: {fmtDate(v.rollDate)}</span>
                  <span>Expected Expiry: {fmtDate(v.expectedExpiryDate)}</span>
                  {v.address && <span className="font-medium text-slate-700">Address: {v.address}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRatesObj && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Scale className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Rates Summary ({selectedFinYear})</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Annual Property Rates</div>
                <div className="text-lg font-bold font-mono text-slate-800">R {fmt(ratesDetails.annualPropertyRates)}</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Instalment</div>
                <div className="text-lg font-bold font-mono text-slate-800">R {fmt(ratesDetails.installment)}</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Frequency</div>
                <div className="text-lg font-bold text-slate-800">{ratesDetails.frequency || 'Monthly'}</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Remaining Instalments</div>
                <div className="text-lg font-bold font-mono text-slate-800">{ratesDetails.remainingInstallments ?? '-'}</div>
              </div>
              <div className="bg-[#F7F7F7] rounded-lg p-3 border border-[#D6D6D6]">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Remaining Amount</div>
                <div className="text-lg font-bold font-mono text-slate-800">R {fmt(ratesDetails.remaingAmount ?? ratesDetails.remainingAmount)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-[10px] uppercase tracking-wider text-green-600 font-semibold mb-1">Rebate Amount</div>
                <div className="text-lg font-bold font-mono text-green-700">R {fmt(ratesDetails.rebateAmount)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {valuationData && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Valuation Roll Data</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(valuationData).filter(([k]) => !k.startsWith('_')).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="font-mono text-slate-800">{typeof val === 'number' ? fmt(val) : (val || '-')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {valuationImport && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Valuation Import Data</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {Object.entries(valuationImport).filter(([k]) => !k.startsWith('_')).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="font-mono text-slate-800">{typeof val === 'number' ? fmt(val) : (val || '-')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {ratesHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-white" />
            <h3 className="text-xs sm:text-sm font-semibold text-white tracking-wide">Rates Run History</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{ratesHistory.length}</Badge>
          </div>
          <div className="sm:hidden p-2 space-y-2">
            {ratesHistory.map((r: any, i: number) => (
              <div key={i} className="border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Run Date</span>
                  <span className="text-slate-800 font-semibold text-right">{fmtDate(r.runDate || r.date)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Period</span>
                  <span className="text-slate-800 font-semibold text-right">{r.period || r.billingPeriod || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Description</span>
                  <span className="text-slate-800 font-semibold text-right">{r.description || '-'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Amount</span>
                  <span className="text-slate-800 font-semibold text-right font-mono">{fmt(r.amount ?? r.ratesAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Status</span>
                  <Badge variant="outline" className="text-[10px]">{r.status || '-'}</Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-run-history">
              <thead>
                <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Run Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ratesHistory.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{fmtDate(r.runDate || r.date)}</td>
                    <td className="py-2 px-3">{r.period || r.billingPeriod || '-'}</td>
                    <td className="py-2 px-3">{r.description || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{fmt(r.amount ?? r.ratesAmount ?? 0)}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{r.status || '-'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
