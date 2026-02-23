import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import {
    RefreshCw, Loader2, Users, AlertTriangle, Bell, ChevronDown, ChevronRight,
    Receipt, Droplets, BookOpen, Landmark, Building2, Home, BarChart3,
    Wallet, Package, ShieldCheck, ChevronsLeft, ChevronsRight, ChevronLeft,
    TrendingUp, Gauge, Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    platinumGetPosCount, platinumGetAlertCounts, platinumGetNotificationCounts,
    platinumGetAccountCount, platinumGetConsumptionCount, platinumGetDebtCount,
    platinumGetBillingCount, platinumGetPropertyCount, platinumGetIndigentSubsidyCount,
    platinumGetJournalCount, platinumGetRebateCount, platinumGetAssetsCount,
    platinumGetNotificationAccountItemCounts, platinumGetNotificationConsumptionItemCounts,
    platinumGetNotificationDebtItemCounts, platinumGetSubsidyItemCounts,
    platinumGetPosTabItemDetailsCount, platinumGetPropertyTabItemDetailsCount,
    platinumGetRebateTabItemDetailsCount, platinumGetBillingTabItemDetailsCount,
    platinumGetBillingPaymentByTypeOfUse, platinumGetDebtArrangementSummaryChart,
    platinumGetMeterReadingProgressChart, platinumDashboardGenericTable,
} from '@/lib/external-api';

interface CategoryConfig {
    key: string;
    label: string;
    icon: React.ReactNode;
    gradient: string;
    badgeBg: string;
    countFn: () => Promise<any>;
    itemCountFn?: () => Promise<any>;
}

interface SubItem {
    key: string;
    label: string;
    count: number;
    color?: string;
    endpoint?: string;
}

const CATEGORIES: CategoryConfig[] = [
    { key: 'account', label: 'Account', icon: <Users className="w-4 h-4" />, gradient: 'from-blue-500 to-blue-600', badgeBg: 'bg-blue-500', countFn: platinumGetAccountCount, itemCountFn: platinumGetNotificationAccountItemCounts },
    { key: 'indigentsubsidy', label: 'Indigent Subsidy', icon: <ShieldCheck className="w-4 h-4" />, gradient: 'from-teal-500 to-teal-600', badgeBg: 'bg-teal-500', countFn: platinumGetIndigentSubsidyCount, itemCountFn: platinumGetSubsidyItemCounts },
    { key: 'consumption', label: 'Consumption', icon: <Droplets className="w-4 h-4" />, gradient: 'from-cyan-500 to-cyan-600', badgeBg: 'bg-cyan-500', countFn: platinumGetConsumptionCount, itemCountFn: platinumGetNotificationConsumptionItemCounts },
    { key: 'journal', label: 'Journal', icon: <BookOpen className="w-4 h-4" />, gradient: 'from-violet-500 to-violet-600', badgeBg: 'bg-violet-500', countFn: platinumGetJournalCount },
    { key: 'debt', label: 'Debt', icon: <Wallet className="w-4 h-4" />, gradient: 'from-red-500 to-red-600', badgeBg: 'bg-red-500', countFn: platinumGetDebtCount, itemCountFn: platinumGetNotificationDebtItemCounts },
    { key: 'billing', label: 'Billing', icon: <Landmark className="w-4 h-4" />, gradient: 'from-amber-500 to-amber-600', badgeBg: 'bg-amber-500', countFn: platinumGetBillingCount, itemCountFn: platinumGetBillingTabItemDetailsCount },
    { key: 'property', label: 'Property', icon: <Home className="w-4 h-4" />, gradient: 'from-emerald-500 to-emerald-600', badgeBg: 'bg-emerald-500', countFn: platinumGetPropertyCount, itemCountFn: platinumGetPropertyTabItemDetailsCount },
    { key: 'pos', label: 'POS', icon: <Receipt className="w-4 h-4" />, gradient: 'from-indigo-500 to-indigo-600', badgeBg: 'bg-indigo-500', countFn: platinumGetPosCount, itemCountFn: platinumGetPosTabItemDetailsCount },
    { key: 'rebate', label: 'Rebate', icon: <Building2 className="w-4 h-4" />, gradient: 'from-pink-500 to-pink-600', badgeBg: 'bg-pink-500', countFn: platinumGetRebateCount, itemCountFn: platinumGetRebateTabItemDetailsCount },
    { key: 'graphs', label: 'Graphs', icon: <BarChart3 className="w-4 h-4" />, gradient: 'from-purple-500 to-purple-600', badgeBg: 'bg-purple-500', countFn: async () => null },
    { key: 'assets', label: 'Assets', icon: <Package className="w-4 h-4" />, gradient: 'from-slate-500 to-slate-600', badgeBg: 'bg-slate-500', countFn: platinumGetAssetsCount },
];

function extractItems(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.items) return Array.isArray(data.items) ? data.items : [];
    if (data.value) return Array.isArray(data.value) ? data.value : [];
    if (data.results) return Array.isArray(data.results) ? data.results : [];
    if (data.data) return Array.isArray(data.data) ? data.data : [];
    if (data.rows) return Array.isArray(data.rows) ? data.rows : [];
    return [];
}

function safeNum(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (Array.isArray(val)) return val.reduce((sum: number, item: any) => sum + (Number(item.value || item.count || 0)), 0);
    if (typeof val === 'object') return Number(val.count ?? val.value ?? val.total ?? 0);
    return Number(val) || 0;
}

const SUB_ITEM_ENDPOINT_MAP: Record<string, string> = {
    directDepositsAllocation: '/api/BillingDashboard/get-direct-deposits-allocation-table-data',
    thirdPartyPaymentPending: '/api/BillingDashboard/get-third-party-payment-pending-table-data',
    debtArrangementNotPaid: '/api/BillingDashboard/get-debt-arrangement-not-paid-table-data',
    cashierReconcile: '/api/BillingDashboard/get-cashier-reconcile-table-data',
    pendingCashierReconcile: '/api/BillingDashboard/get-cashier-reconcile-table-data',
    returnCashierReconcile: '/api/BillingDashboard/get-return-cashier-reconcile-table-data',
    cashierReconcileSurplus: '/api/BillingDashboard/get-cashier-reconcile-surplus-table-data',
    cashierReconcileShortage: '/api/BillingDashboard/get-cashier-reconcile-shortage-table-data',
    depositTableData: '/api/BillingDashboard/get-deposit-table-data',
    postDatedCheque: '/api/BillingDashboard/get-post-dated-cheque-search-table-data',
    additionalBilling: '/api/BillingDashboard/get-additional-billing-table-data',
    billingRunProgress: '/api/BillingDashboard/get-billing-run-progress-table-data',
    billingCyclePreparation: '/api/BillingDashboard/get-billing-cycle-preparation-alerts-table-data',
    billingCycleDue: '/api/BillingDashboard/get-billing-cycle-due-alerts',
    partitionsWithoutOwner: '/api/BillingDashboard/get-consolidation-property-details-table-data',
    accountsNotLinkedToServices: '/api/BillingDashboard/get-not-linked-service-table-data',
    propertyPartitionsNotLinkedToAccounts: '/api/BillingDashboard/get-property-partitions-not-linked-to-accounts-table-data',
    linkedInactivePartitions: '/api/BillingDashboard/get-linked-inactive-partitions-table-data',
    propertyRatesAccountExceptions: '/api/BillingDashboard/get-property-registration-alert-table-data',
    statusChangeDeclined: '/api/BillingDashboard/get-status-change-declined-table-data',
    serviceStatusChangeDeclined: '/api/BillingDashboard/get-status-change-declined-table-data',
    tariffChangeDeclined: '/api/BillingDashboard/get-tariff-change-request-declined-table-data',
    tariffChangeRequestDeclined: '/api/BillingDashboard/get-tariff-change-request-declined-table-data',
    notIncludedInMoc: '/api/BillingDashboard/get-not-included-moc-table-data',
    interestWaiverDeclined: '/api/BillingDashboard/get-interest-waiver-declined-table-data',
    interestWaiverTerminationDeclined: '/api/BillingDashboard/get-interest-waiver-termination-application-declined-table-data',
    meterBooksForBillingCycleDue: '/api/BillingDashboard/get-billing-cycle-due-alerts',
    metersNotLinkedToServices: '/api/BillingDashboard/get-report-meters',
    metersNotLinkedToRouteFile: '/api/BillingDashboard/get-meters-not-linked-to-route-file',
    meterBooksNotLinkedToCycle: '/api/BillingDashboard/get-meterbooks-not-linked-to-cycle',
    meterBookWithNoRouteFile: '/api/BillingDashboard/get-meterbook-with-no-route-file',
    meterMovedNotSequenced: '/api/BillingDashboard/get-not-sequenced-meters',
    meterBooksAreOutstanding: '/api/BillingDashboard/get-report-meters',
    meterRemovalDeclined: '/api/BillingDashboard/get-meter-removal-declined-alerts',
    meterRemovalReadingsRequired: '/api/BillingDashboard/get-meter-removal-readings-required',
    meterPendingStatus: '/api/BillingDashboard/get-meter-pending-status',
    firstAndFinalOutstanding: '/api/BillingDashboard/get-first-and-final-outstanding',
    firstAndFinalReadingsRequired: '/api/BillingDashboard/get-first-and-final-readings-required',
    firstAndFinalDeclined: '/api/BillingDashboard/get-first-and-final-declined-alerts',
    finalReadingApprovalPending: '/api/BillingDashboard/get-final-reading-approval-pending-meter-change',
    finalServicesWithNoMeterReading: '/api/BillingDashboard/get-final-services-with-no-meter-reading',
    journalsPendingReview: '/api/BillingDashboard/get-journals-pending-review',
    declinedJournals: '/api/BillingDashboard/get-declined-journals',
    badDebtReconciliation: '/api/BillingDashboard/get-bad-debt-reconciliation',
    cutoffHistory: '/api/BillingDashboard/get-cutoff-history',
    repaymentPlanApprovedNotActivated: '/api/BillingDashboard/get-repayment-plan-approved-not-activated',
    repaymentPlanAwaitingAuthorisation: '/api/BillingDashboard/get-repayment-plan-awaiting-authorisation',
    repaymentPlanDeclined: '/api/BillingDashboard/get-repayment-plan-declined',
    repaymentPlansAwaitingTermination: '/api/BillingDashboard/get-repayment-plans-awaiting-termination-authorisation',
    unpaidTransactions: '/api/BillingDashboard/get-unpaid-transactions',
    clearanceStagingSection1181Declined: '/api/BillingDashboard/get-clearance-staging-section-118-1-declined-table-data',
    clearanceStagingSection1181Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-1-waiting-table-data',
    clearanceStagingSection1184Declined: '/api/BillingDashboard/get-clearance-staging-section-118-4-declined-table-data',
    clearanceStagingSection1184Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-4-waiting-table-data',
    clearedClearanceList: '/api/BillingDashboard/get-cleared-clearance-list-table-data',
    transferOwnershipDeclined: '/api/BillingDashboard/get-transfer-ownership-declined-table-data',
    subdivisionDeclined: '/api/BillingDashboard/get-subdivision-declined-table-data',
    declinedValuations: '/api/BillingDashboard/get-declined-valuations-table-data',
    unitIncompleteWorkflow: '/api/BillingDashboard/get-unit-incomplete-workflow-capture-table-data',
    assetsMeterInstallation: '/api/BillingDashboard/get-assets-meter-installation-notification-table-data',
    municipalityAlert: '/api/BillingDashboard/get-municipality-alert-table-data',
    configAlert: '/api/BillingDashboard/get-config-alert-table-data',
    employeeDeduction: '/api/BillingDashboard/get-employee-deduction-alerts',
    awaitingVerification: '/api/BillingDashboard/get-awating-verification',
    automaticDisqualification: '/api/BillingDashboard/get-automatic-disqualification',
    attpApplicationAuthorization: '/api/BillingDashboard/get-attp-applicatoin-authorization-details',
    attpApplicationTermination: '/api/BillingDashboard/get-attp-applicatoin-termination-details',
    awaitingApplicationDeclined: '/api/BillingDashboard/get-awaiting-application-declined-details',
    rebateTerminationDeclined: '/api/BillingDashboard/get-rebate-termination-request-declined-table-data',
    paymentExtensionExpiring: '/api/BillingDashboard/get-unpaid-transactions',
};

function resolveEndpoint(key: string): string | undefined {
    if (SUB_ITEM_ENDPOINT_MAP[key]) return SUB_ITEM_ENDPOINT_MAP[key];
    const lower = key.toLowerCase();
    for (const [mapKey, endpoint] of Object.entries(SUB_ITEM_ENDPOINT_MAP)) {
        if (lower.includes(mapKey.toLowerCase()) || mapKey.toLowerCase().includes(lower)) {
            return endpoint;
        }
    }
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const guessedEndpoint = `/api/BillingDashboard/get-${kebab}-table-data`;
    return guessedEndpoint;
}

function parseSubItems(data: any): SubItem[] {
    if (!data) return [];
    if (typeof data === 'object' && !Array.isArray(data)) {
        return Object.entries(data)
            .filter(([_, v]) => v !== null && v !== undefined)
            .map(([key, value]) => ({
                key,
                label: key.replace(/([A-Z])/g, ' $1').replace(/count$/i, '').replace(/^./, s => s.toUpperCase()).trim(),
                count: typeof value === 'number' ? value : safeNum(value),
                endpoint: resolveEndpoint(key),
            }));
    }
    if (Array.isArray(data)) {
        return data.map((item: any) => ({
            key: item.key || item.name || item.id || '',
            label: item.label || item.name || item.description || item.key || '',
            count: Number(item.value ?? item.count ?? 0),
            color: item.color,
            endpoint: item.endpoint || resolveEndpoint(item.key || item.name || ''),
        }));
    }
    return [];
}

function AnimatedCounter({ value, className = '' }: { value: number; className?: string }) {
    const [displayed, setDisplayed] = useState(0);
    useEffect(() => {
        if (value === 0) { setDisplayed(0); return; }
        const duration = 600;
        const start = Date.now();
        const startVal = displayed;
        const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayed(Math.round(startVal + (value - startVal) * eased));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <span className={className}>{displayed.toLocaleString()}</span>;
}

function SubItemDetailTable({ endpoint }: { endpoint: string }) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 10;
    const { toast } = useToast();

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const pager = { page: p, pageSize, orderby: null, shortDirection: null };
            const data = await platinumDashboardGenericTable(endpoint, pager);
            const rows = extractItems(data);
            setItems(rows);
            setTotalCount(data?.totalCount ?? data?.totalRecords ?? data?.count ?? rows.length);
        } catch (e: any) {
            toast({ title: 'Error loading data', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [endpoint, toast]);

    useEffect(() => { load(page); }, [page, load]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (loading && items.length === 0) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-muted-foreground">Loading data...</span>
            </div>
        );
    }

    if (items.length === 0) {
        return <div className="text-center py-6 text-sm text-muted-foreground">No records found</div>;
    }

    const columns = Object.keys(items[0] || {}).filter(k => !k.startsWith('_') && k !== 'id');

    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[400px]">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            {columns.map(col => (
                                <TableHead key={col} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                                    {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-blue-50/30 transition-colors">
                                {columns.map(col => {
                                    const val = row[col];
                                    const isAmount = typeof val === 'number' && (col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance') || col.toLowerCase().includes('total'));
                                    return (
                                        <TableCell key={col} className="text-xs py-2.5">
                                            {isAmount
                                                ? <span className="font-mono font-medium">R {val.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                                                : typeof val === 'number'
                                                    ? val.toLocaleString()
                                                    : String(val ?? '—')
                                            }
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50/50">
                    <span className="text-xs text-muted-foreground">
                        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(1)} data-testid="btn-page-first">
                            <ChevronsLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="btn-page-prev">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-xs font-medium px-2" data-testid="text-page-indicator">{page}/{totalPages}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="btn-page-next">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(totalPages)} data-testid="btn-page-last">
                            <ChevronsRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function GraphsPanel() {
    const [paymentByType, setPaymentByType] = useState<any[]>([]);
    const [debtChart, setDebtChart] = useState<any>(null);
    const [meterChart, setMeterChart] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [pbt, dc, mc] = await Promise.allSettled([
                platinumGetBillingPaymentByTypeOfUse(),
                platinumGetDebtArrangementSummaryChart(),
                platinumGetMeterReadingProgressChart(),
            ]);
            if (pbt.status === 'fulfilled') setPaymentByType(Array.isArray(pbt.value) ? pbt.value : extractItems(pbt.value));
            if (dc.status === 'fulfilled') setDebtChart(dc.value);
            if (mc.status === 'fulfilled') setMeterChart(mc.value);
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500 mr-3" />
                <span className="text-muted-foreground">Loading charts...</span>
            </div>
        );
    }

    const renderChartData = (title: string, data: any, icon: React.ReactNode, color: string) => {
        const items = Array.isArray(data) ? data : extractItems(data);
        if (!items || items.length === 0) return null;
        const columns = Object.keys(items[0] || {}).filter(k => !k.startsWith('_'));
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${color} text-white flex items-center justify-center`}>
                        {icon}
                    </div>
                    <h4 className="font-semibold text-sm text-slate-700">{title}</h4>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    {columns.map(col => (
                                        <TableHead key={col} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                                            {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-purple-50/30">
                                        {columns.map(col => {
                                            const val = row[col];
                                            return (
                                                <TableCell key={col} className="text-xs py-2">
                                                    {typeof val === 'number'
                                                        ? val.toLocaleString('en-ZA', val % 1 !== 0 ? { minimumFractionDigits: 2 } : {})
                                                        : String(val ?? '')}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {renderChartData('Payments by Type of Use', paymentByType, <TrendingUp className="w-4 h-4" />, 'bg-purple-500')}
            {renderChartData('Debt Arrangement Summary', debtChart, <Gauge className="w-4 h-4" />, 'bg-red-500')}
            {renderChartData('Meter Reading Progress', meterChart, <Activity className="w-4 h-4" />, 'bg-cyan-500')}
            {!paymentByType?.length && !debtChart && !meterChart && (
                <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No chart data available</p>
                </div>
            )}
        </div>
    );
}

function CategoryPanel({ category, subItems, subItemsLoading }: { category: CategoryConfig; subItems: SubItem[]; subItemsLoading: boolean }) {
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    if (category.key === 'graphs') {
        return <GraphsPanel />;
    }

    if (subItemsLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-muted-foreground">Loading notifications...</span>
            </div>
        );
    }

    if (subItems.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notification items for {category.label}</p>
            </div>
        );
    }

    const sortedItems = [...subItems].sort((a, b) => b.count - a.count);

    return (
        <div className="space-y-1.5">
            {sortedItems.map((item) => {
                const isExpanded = expandedItem === item.key;
                const hasData = item.count > 0;
                const isRed = item.color === 'red' || item.label.toLowerCase().includes('declined') || item.label.toLowerCase().includes('exception') || item.label.toLowerCase().includes('outstanding');
                const isAmber = item.label.toLowerCase().includes('awaiting') || item.label.toLowerCase().includes('pending');
                return (
                    <div key={item.key} className="group">
                        <button
                            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                isExpanded
                                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm'
                                    : 'hover:bg-slate-50 border border-transparent'
                            }`}
                            onClick={() => setExpandedItem(isExpanded ? null : item.key)}
                            data-testid={`btn-subitem-${item.key}`}
                        >
                            <div className={`shrink-0 w-2 h-2 rounded-full ${
                                isRed ? 'bg-red-500' : isAmber ? 'bg-amber-500' : hasData ? 'bg-blue-500' : 'bg-slate-300'
                            }`} />
                            <span className={`flex-1 text-sm ${
                                isRed ? 'text-red-700 font-semibold' : isAmber ? 'text-amber-700 font-medium' : 'text-slate-700'
                            }`}>
                                {item.label}
                            </span>
                            <Badge
                                variant={isRed ? 'destructive' : 'secondary'}
                                className={`font-mono text-xs min-w-[40px] justify-center ${
                                    !hasData ? 'opacity-40' : ''
                                }`}
                            >
                                {item.count.toLocaleString()}
                            </Badge>
                            {hasData && (
                                isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-blue-500 shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
                            )}
                        </button>
                        {isExpanded && hasData && item.endpoint && (
                            <div className="ml-5 mt-2 mb-3 pl-4 border-l-2 border-blue-200">
                                <SubItemDetailTable endpoint={item.endpoint} />
                            </div>
                        )}
                        {isExpanded && hasData && !item.endpoint && (
                            <div className="ml-5 mt-2 mb-3 pl-4 border-l-2 border-slate-200">
                                <div className="text-xs text-muted-foreground bg-slate-50 rounded-lg p-4 text-center">
                                    Detail view available in production — {item.count.toLocaleString()} records
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function BillingDashboard() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [countsLoading, setCountsLoading] = useState<Record<string, boolean>>({});
    const [alertCounts, setAlertCounts] = useState<any[]>([]);
    const [notificationCounts, setNotificationCounts] = useState<any[]>([]);
    const [activeCategory, setActiveCategory] = useState('account');
    const [subItems, setSubItems] = useState<Record<string, SubItem[]>>({});
    const [subItemsLoading, setSubItemsLoading] = useState<Record<string, boolean>>({});

    const loadSingleCount = useCallback(async (cat: CategoryConfig) => {
        setCountsLoading(prev => ({ ...prev, [cat.key]: true }));
        try {
            const data = await cat.countFn();
            setCounts(prev => ({ ...prev, [cat.key]: safeNum(data) }));
        } catch {
            setCounts(prev => ({ ...prev, [cat.key]: 0 }));
        } finally {
            setCountsLoading(prev => ({ ...prev, [cat.key]: false }));
        }
    }, []);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const [ac, nc] = await Promise.allSettled([
                platinumGetAlertCounts(),
                platinumGetNotificationCounts(),
            ]);
            if (ac.status === 'fulfilled') {
                setAlertCounts(Array.isArray(ac.value) ? ac.value : extractItems(ac.value));
            }
            if (nc.status === 'fulfilled') {
                setNotificationCounts(Array.isArray(nc.value) ? nc.value : extractItems(nc.value));
            }
        } catch (e: any) {
            toast({ title: 'Error loading alerts', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }

        const countable = CATEGORIES.filter(c => c.key !== 'graphs');
        const batchSize = 3;
        for (let i = 0; i < countable.length; i += batchSize) {
            const batch = countable.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(cat => loadSingleCount(cat)));
        }
    }, [toast, loadSingleCount]);

    const refreshAll = useCallback(async () => {
        setCounts({});
        setSubItems({});
        await loadDashboard();
    }, [loadDashboard]);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const loadSubItems = useCallback(async (categoryKey: string) => {
        const cat = CATEGORIES.find(c => c.key === categoryKey);
        if (!cat?.itemCountFn || subItems[categoryKey]) return;
        setSubItemsLoading(prev => ({ ...prev, [categoryKey]: true }));
        try {
            const data = await cat.itemCountFn();
            const parsed = parseSubItems(data);
            setSubItems(prev => ({ ...prev, [categoryKey]: parsed }));
        } catch (e: any) {
            setSubItems(prev => ({ ...prev, [categoryKey]: [] }));
        } finally {
            setSubItemsLoading(prev => ({ ...prev, [categoryKey]: false }));
        }
    }, [subItems]);

    useEffect(() => {
        if (activeCategory && activeCategory !== 'graphs') {
            loadSubItems(activeCategory);
        }
    }, [activeCategory, loadSubItems]);

    const workflowAlerts = useMemo(() => alertCounts.filter((a: any) => String(a.key || '').includes('workflow')), [alertCounts]);
    const configAlerts = useMemo(() => alertCounts.filter((a: any) => String(a.key || '').includes('config')), [alertCounts]);
    const workflowCount = workflowAlerts.reduce((s: number, a: any) => s + (Number(a.value) || 0), 0);
    const configCount = configAlerts.reduce((s: number, a: any) => s + (Number(a.value) || 0), 0);
    const totalAlerts = alertCounts.reduce((s: number, a: any) => s + (Number(a.value) || 0), 0);
    const totalNotifications = Object.values(counts).reduce((s, v) => s + v, 0);

    const activeCat = CATEGORIES.find(c => c.key === activeCategory)!;

    return (
        <PosLayout>
            <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" data-testid="page-billing-dashboard">
                <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                                Billing Dashboard
                                <HelpTip text="Central overview of all billing notifications, alerts, and system status across all municipal services." />
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">Municipal billing system overview and notifications</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshAll}
                            disabled={loading}
                            className="gap-2 self-start sm:self-auto"
                            data-testid="btn-refresh-dashboard"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>

                    {(totalAlerts > 0 || loading) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-amber-900">Workflow Alerts</h3>
                                        <p className="text-xs text-amber-700/70">Items requiring attention</p>
                                    </div>
                                    <Badge variant="destructive" className="ml-auto text-sm px-3" data-testid="badge-workflow-alerts">
                                        {loading ? '...' : workflowCount}
                                    </Badge>
                                </div>
                                {workflowAlerts.filter((a: any) => Number(a.value) > 0).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between py-1.5 text-sm">
                                        <span className="text-amber-800 capitalize">{String(item.key || '').replace(/-/g, ' ')}</span>
                                        <Badge variant="outline" className="font-mono text-xs border-amber-300 text-amber-700">{item.value}</Badge>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-blue-900">Configuration Alerts</h3>
                                        <p className="text-xs text-blue-700/70">System configuration issues</p>
                                    </div>
                                    <Badge className="ml-auto text-sm px-3 bg-blue-500" data-testid="badge-config-alerts">
                                        {loading ? '...' : configCount}
                                    </Badge>
                                </div>
                                {configAlerts.filter((a: any) => Number(a.value) > 0).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between py-1.5 text-sm">
                                        <span className="text-blue-800 capitalize">{String(item.key || '').replace(/-/g, ' ')}</span>
                                        <Badge variant="outline" className="font-mono text-xs border-blue-300 text-blue-700">{item.value}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Notifications</h2>
                            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4" data-testid="category-pills">
                            {CATEGORIES.map(cat => {
                                const count = counts[cat.key] ?? 0;
                                const isActive = activeCategory === cat.key;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => setActiveCategory(cat.key)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                                            isActive
                                                ? `bg-gradient-to-r ${cat.gradient} text-white shadow-lg scale-[1.02]`
                                                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm'
                                        }`}
                                        data-testid={`pill-${cat.key}`}
                                    >
                                        {cat.icon}
                                        <span className="hidden sm:inline">{cat.label}</span>
                                        <span className="sm:hidden">{cat.label.length > 8 ? cat.label.slice(0, 6) + '..' : cat.label}</span>
                                        {cat.key !== 'graphs' && (
                                            <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                                                isActive ? 'bg-white/25 text-white' : `${cat.badgeBg} text-white`
                                            }`}>
                                                {countsLoading[cat.key] ? <Loader2 className="w-3 h-3 animate-spin" /> : counts[cat.key] !== undefined ? <AnimatedCounter value={count} /> : '·'}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                            <div className={`h-1 bg-gradient-to-r ${activeCat.gradient}`} />
                            <CardContent className="p-4 sm:p-6">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activeCat.gradient} text-white flex items-center justify-center shadow-md`}>
                                        {activeCat.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-800">{activeCat.label}</h3>
                                        {activeCat.key !== 'graphs' && (
                                            <p className="text-xs text-muted-foreground">
                                                {counts[activeCat.key]?.toLocaleString() || 0} total notifications
                                            </p>
                                        )}
                                    </div>
                                    {activeCat.key !== 'graphs' && (
                                        <Badge className={`${activeCat.badgeBg} text-white text-lg px-3 py-1 font-mono`}>
                                            <AnimatedCounter value={counts[activeCat.key] || 0} />
                                        </Badge>
                                    )}
                                </div>
                                <CategoryPanel
                                    category={activeCat}
                                    subItems={subItems[activeCat.key] || []}
                                    subItemsLoading={!!subItemsLoading[activeCat.key]}
                                />
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </PosLayout>
    );
}
