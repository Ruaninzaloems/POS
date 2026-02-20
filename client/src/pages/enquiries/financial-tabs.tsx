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
  getDeposits, getDepositAmount, getPaymentIncentive,
  getBilledVsPaidAmounts,
} from '@/lib/enquiries-service';
import { LoadingSkeleton, EmptyState, ErrorState, InfoField, SectionHeader, PaginatedTable, TabCard, FieldRow, getFinYearOptions, MONTHS } from './shared';

export function IncentivesTab({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPaymentIncentive(accountId);
      setData(result);
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
    item.description || item.incentiveType || item.code || item.incentive || item.enable
  );

  if (!hasIncentive) {
    return (
      <div className="p-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Incentive</h3>
          </div>
          <div className="py-12 px-5 flex flex-col items-center justify-center text-center">
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
    <div className="p-5 space-y-5">
      {items.filter((item: any) => item.description || item.incentiveType || item.code || item.incentive || item.enable).map((item: any, i: number) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Gift className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Incentive</h3>
            {item.enable && (
              <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">Active</Badge>
            )}
          </div>
          <div className="p-5">
            <FieldRow label="Description" value={item.description} icon={<Gift className="w-3.5 h-3.5" />} />
            <FieldRow label="Incentive Type" value={item.incentiveType || item.code} icon={<Activity className="w-3.5 h-3.5" />} />
            <FieldRow label="Incentive" value={item.incentive} icon={<Banknote className="w-3.5 h-3.5" />} />
            <FieldRow label="Financial Year" value={item.financialYear} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid From" value={item.validPeriodFrom ? new Date(item.validPeriodFrom).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="Valid To" value={item.validPeriodTo ? new Date(item.validPeriodTo).toLocaleDateString('en-ZA') : null} icon={<CalendarDays className="w-3.5 h-3.5" />} />
            <FieldRow label="CRN" value={item.crn} icon={<Shield className="w-3.5 h-3.5" />} />
            <FieldRow label="Enabled" value={item.enable ? 'Yes' : 'No'} icon={<Shield className="w-3.5 h-3.5" />} />
          </div>
        </div>
      ))}
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

  const totalAmt = typeof depositAmount === 'number' ? depositAmount : (depositAmount?.totalDeposit ?? depositAmount?.amount ?? 0);
  const totalDeposit = deposits.reduce((s, d) => s + (d.deposit ?? d.depositAmount ?? d.amount ?? 0), 0);
  const totalPaid = deposits.reduce((s, d) => s + (d.paidAmount ?? 0), 0);

  return (
    <div className="p-5 space-y-5" data-testid="deposits-tab">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">Total Deposit Amount</p>
            <p className={`text-3xl font-bold font-mono tracking-tight ${totalAmt < 0 ? 'text-red-300' : 'text-white'}`}>
              {fmt(totalAmt)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700">Deposit:</h3>
        </div>
        {deposits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-deposits">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Service Type</th>
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Receipt No / Journal Transaction ID</th>
                  <th className="text-left py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Date Captured</th>
                  <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Deposit Amount</th>
                  <th className="text-right py-3 px-5 text-[11px] uppercase tracking-wider text-blue-700 font-bold">Paid Amount</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((dep: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors" data-testid={`row-deposit-${i}`}>
                    <td className="py-3 px-5 text-slate-700 font-medium">{dep.serviceDesc || dep.serviceDescription || dep.description || '-'}</td>
                    <td className="py-3 px-5 text-slate-600 font-mono text-[13px]">{dep.docNumber || dep.receiptNo || dep.reference || ''}</td>
                    <td className="py-3 px-5 text-slate-600">{dep.dateCaptured ? new Date(dep.dateCaptured).toLocaleDateString('en-ZA') : dep.depositDate ? new Date(dep.depositDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.deposit ?? dep.depositAmount ?? dep.amount ?? 0)}</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-800 font-semibold">{fmt(dep.paidAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                  <td colSpan={3} className="py-3 px-5"></td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 text-[14px]">{fmt(totalDeposit)}</td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 text-[14px]">({fmt(Math.abs(totalPaid))})</td>
                </tr>
              </tfoot>
            </table>
          </div>
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

  const fmtAmt = (v: any) => v != null && v !== '' ? Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '0.00';
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
    <div className="p-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Payment Plans - Capital Cost</h3>
          {hasPlans && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{plans.length}</Badge>}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">Initial Down Payment That Was Required:</span>{' '}
            <span className="font-mono font-bold text-slate-900">{initialDownPayment}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="table-payment-plans">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
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
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors" data-testid={`plan-row-${i}`}>
                    <td className="py-2.5 px-3">
                      <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
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

        <div className="flex items-center justify-end gap-2 px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <span>Items per page: <span className="border rounded px-2 py-0.5 bg-white">50</span></span>
          <span>{hasPlans ? `1 - ${plans.length} of ${plans.length}` : '0 of 0'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Repayment Plan Status</h3>
          </div>
          <div className="p-5">
            {hasRepaymentData ? (
              <div className="space-y-3">
                {repaymentStatus.map((item: any, i: number) => {
                  const label = repaymentLabels[i] || `Status ${i + 1}`;
                  const value = typeof item === 'string' ? item : item?.status || item?.description || JSON.stringify(item);
                  const isActive = value && value !== 'N/A' && value !== 'None' && value !== '';
                  return (
                    <div key={i} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                      </div>
                      <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[11px] ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{value}</Badge>
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Remaining Capital</h3>
          </div>
          <div className="p-5">
            {hasCapital ? (
              typeof remainingCapital === 'object' ? (
                Object.entries(remainingCapital).filter(([k, v]) => !k.startsWith('_') && v != null && v !== 0).map(([key, val]) => (
                  <FieldRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={val as any} />
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl font-bold text-blue-700">R {Number(remainingCapital).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Payment Extensions</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{extensions.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-payment-extensions">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Date</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Extension Type</th>
                  <th className="text-right py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Amount</th>
                  <th className="text-left py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Payment History</h3>
          {hasPaymentAmounts && <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{paymentAmounts.length}</Badge>}
        </div>
        {hasPaymentAmounts ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-payment-amounts">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
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
                  <tr key={i} className={`border-b border-slate-100 hover:bg-indigo-50/30 transition-colors ${pa.cancelReson ? 'bg-red-50/30' : ''}`}>
                    <td className="py-2.5 px-3 font-mono font-medium">{pa.receiptNo || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{pa.receiptDate ? new Date(pa.receiptDate).toLocaleDateString('en-ZA') : '-'}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={`text-[10px] ${pa.paymentType === 'Cash' ? 'bg-green-50 text-green-700 border-green-200' : pa.paymentType === 'Credit Card' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
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
        ) : (
          <div className="py-8 px-5 flex flex-col items-center justify-center text-center">
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
    <div className="p-5 space-y-5" data-testid="payment-extension-history-panel">
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
      setDeductions(ded);
      setDebitOrders(dob);
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
    <div className="p-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Debit Order Deduction List</h3>
          {(deductions.length + debitOrders.length) > 0 && (
            <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{deductions.length + debitOrders.length} record{(deductions.length + debitOrders.length) !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-debit-order-deductions">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-center py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold w-[40px]">Nr</th>
                <th className="text-left py-2.5 px-2 text-[10px] uppercase tracking-wider text-slate-600 font-bold min-w-[80px]">Status</th>
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
                <tr><td colSpan={13} className="py-8 text-center text-slate-400 text-sm italic">No records to display.</td></tr>
              ) : [...deductions, ...debitOrders].map((d: any, i: number) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-teal-50/30 transition-colors" data-testid={`row-debit-${i}`}>
                  <td className="py-2 px-2 text-center text-slate-500 text-[13px]">{d.nr ?? d.number ?? i + 1}</td>
                  <td className="py-2 px-2">
                    <Badge variant={d.status === 'Active' || d.status === 'Successful' ? 'default' : 'secondary'} className="text-[10px]">
                      {d.status || d.deductionStatus || '-'}
                    </Badge>
                  </td>
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
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
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

  const totalBilled = data.reduce((s, d) => s + (d.billingAmount ?? d.billedAmount ?? d.amount ?? 0), 0);
  const totalPaid = data.reduce((s, d) => s + (d.paidAmount ?? d.paymentAmount ?? 0), 0);
  const maxVal = Math.max(...data.map(d => Math.max(Math.abs(d.billingAmount ?? d.billedAmount ?? d.amount ?? 0), Math.abs(d.paidAmount ?? d.paymentAmount ?? 0))), 1);

  return (
    <div className="p-5 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white tracking-wide">Billed vs Paid Amounts</h3>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            data-testid="select-billed-year"
          >
            {getFinYearOptions().map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-billed-vs-paid">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[140px]">Financial Year</th>
                <th className="text-left py-2.5 px-4 text-[11px] uppercase tracking-wider text-slate-600 font-bold min-w-[120px]">Month</th>
                <th className="text-right py-2.5 px-4 text-[11px] uppercase tracking-wider text-indigo-600 font-bold min-w-[140px]">Billing Amount</th>
                <th className="text-right py-2.5 px-4 text-[11px] uppercase tracking-wider text-rose-600 font-bold min-w-[140px]">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400 text-sm italic">No records to display.</td></tr>
              ) : data.map((d: any, i: number) => {
                const billed = d.billingAmount ?? d.billedAmount ?? d.amount ?? 0;
                const paid = d.paidAmount ?? d.paymentAmount ?? 0;
                return (
                  <tr key={i} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors" data-testid={`row-billed-${i}`}>
                    <td className="py-2.5 px-4 text-[13px] text-slate-700">{d.financialYear || selectedYear}</td>
                    <td className="py-2.5 px-4 text-[13px] font-medium text-slate-800">{d.month || d.billingMonth || d.period || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[13px] text-indigo-700 font-semibold">{fmt(billed)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono text-[13px] font-semibold ${paid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(paid)}</td>
                  </tr>
                );
              })}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-indigo-200 bg-indigo-50/50">
                  <td colSpan={2} className="py-2.5 px-4 font-bold text-slate-900 text-[13px]">Total</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700 text-[13px]">{fmt(totalBilled)}</td>
                  <td className={`py-2.5 px-4 text-right font-mono font-bold text-[13px] ${totalPaid < 0 ? 'text-red-600' : 'text-rose-600'}`}>{fmt(totalPaid)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <span className="text-xs text-slate-500">{data.length} of {data.length} records</span>
        </div>
      </div>

      {data.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-slate-600 to-slate-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Account History</h3>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-1 justify-center" style={{ height: '320px' }} data-testid="chart-billed-vs-paid">
              {data.map((d: any, i: number) => {
                const billed = Math.abs(d.billingAmount ?? d.billedAmount ?? d.amount ?? 0);
                const paid = Math.abs(d.paidAmount ?? d.paymentAmount ?? 0);
                const billedPct = maxVal > 0 ? (billed / maxVal) * 100 : 0;
                const paidPct = maxVal > 0 ? (paid / maxVal) * 100 : 0;
                const month = d.month || d.billingMonth || d.period || '';
                return (
                  <div key={i} className="flex flex-col items-center flex-1 max-w-[100px] group">
                    <div className="flex items-end gap-1 w-full justify-center" style={{ height: '260px' }}>
                      <div className="relative flex flex-col items-center justify-end" style={{ height: '100%', width: '35%' }}>
                        <div
                          className="w-full bg-indigo-400 hover:bg-indigo-500 rounded-t-sm transition-all duration-300 relative group/bar"
                          style={{ height: `${Math.max(billedPct * 0.95, 2)}%`, minHeight: '4px' }}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-slate-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                            R {fmt(billed)}
                          </div>
                        </div>
                      </div>
                      <div className="relative flex flex-col items-center justify-end" style={{ height: '100%', width: '35%' }}>
                        <div
                          className="w-full bg-rose-400 hover:bg-rose-500 rounded-t-sm transition-all duration-300 relative group/bar"
                          style={{ height: `${Math.max(paidPct * 0.95, 2)}%`, minHeight: '4px' }}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-slate-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                            R {fmt(paid)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 text-center font-medium truncate w-full">{month}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-indigo-400" />
                <span className="text-xs text-slate-600 font-medium">Billing Amount</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-rose-400" />
                <span className="text-xs text-slate-600 font-medium">Paid Amount</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Billed</span>
          </div>
          <div className="text-lg font-bold text-indigo-700 font-mono mt-1">R {fmt(totalBilled)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Paid</span>
          </div>
          <div className={`text-lg font-bold font-mono mt-1 ${totalPaid < 0 ? 'text-red-600' : 'text-rose-600'}`}>R {fmt(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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
  const [ratesDetails, setRatesDetails] = useState<any[]>([]);
  const [ratesHistory, setRatesHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rd, rh] = await Promise.all([
        getAccountRatesDetails(accountId).catch(() => []),
        getRatesRunHistory(accountId).catch(() => []),
      ]);
      setRatesDetails(rd);
      setRatesHistory(rh);
      loaded.current = true;
    } catch (e: any) {
      setError(e.message || 'Failed to load rates & valuations');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { if (!loaded.current) load(); }, [load]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!ratesDetails.length && !ratesHistory.length) return <EmptyState message="No rates & valuations data available" />;

  return (
    <div className="p-5 space-y-5">
      {ratesDetails.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 flex items-center gap-2">
            <Scale className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Account Rates Details</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{ratesDetails.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-details">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Category</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Market Value</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Rateable Value</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Rate</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                {ratesDetails.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3 font-medium">{r.category || r.rateCategory || '-'}</td>
                    <td className="py-2 px-3">{r.description || r.rateDescription || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono">{(r.marketValue ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{(r.rateableValue ?? r.ratableValue ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{r.rateInRand ?? r.rate ?? '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(r.monthlyAmount ?? r.amount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ratesHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-purple-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-white" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Rates Run History</h3>
            <Badge className="ml-auto bg-white/20 text-white border-white/30 text-[10px]">{ratesHistory.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-rates-run-history">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Run Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Period</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Description</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Amount</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ratesHistory.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{r.runDate ? new Date(r.runDate).toLocaleDateString('en-ZA') : r.date || '-'}</td>
                    <td className="py-2 px-3">{r.period || r.billingPeriod || '-'}</td>
                    <td className="py-2 px-3">{r.description || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{(r.amount ?? r.ratesAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
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
