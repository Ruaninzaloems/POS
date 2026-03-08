import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    TrendingUp, Gauge, Activity, AlertCircle, Clock, XCircle, CheckCircle2,
    Download, FileSpreadsheet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';
import * as XLSX from 'xlsx';
import {
    platinumGetAlertCounts, platinumGetNotificationCounts,
    platinumGetNotificationAccountItemCounts, platinumGetNotificationConsumptionItemCounts,
    platinumGetNotificationDebtItemCounts, platinumGetSubsidyItemCounts,
    platinumGetPosTabItemDetailsCount, platinumGetPropertyTabItemDetailsCount,
    platinumGetRebateTabItemDetailsCount, platinumGetBillingTabItemDetailsCount,
    platinumGetBillingPaymentByTypeOfUse, platinumGetDebtArrangementSummaryChart,
    platinumGetMeterReadingProgressChart, platinumDashboardGenericTable,
} from '@/lib/external-api';

interface SubItem {
    key: string;
    label: string;
    count: number;
    severity: 'critical' | 'warning' | 'info' | 'neutral';
    endpoint?: string;
}

interface CategoryConfig {
    key: string;
    label: string;
    icon: React.ReactNode;
    gradient: string;
    badgeColor: string;
    itemCountFn?: () => Promise<any>;
}

const CATEGORIES: CategoryConfig[] = [
    { key: 'account', label: 'Account', icon: <Users className="w-4 h-4" />, gradient: 'from-[var(--pos-accent)] to-[var(--pos-accent-dark)]', badgeColor: 'bg-[var(--pos-accent)]', itemCountFn: platinumGetNotificationAccountItemCounts },
    { key: 'indigentsubsidy', label: 'Indigent Subsidy', icon: <ShieldCheck className="w-4 h-4" />, gradient: 'from-teal-500 to-teal-600', badgeColor: 'bg-teal-500', itemCountFn: platinumGetSubsidyItemCounts },
    { key: 'consumption', label: 'Consumption', icon: <Droplets className="w-4 h-4" />, gradient: 'from-cyan-500 to-cyan-600', badgeColor: 'bg-cyan-500', itemCountFn: platinumGetNotificationConsumptionItemCounts },
    { key: 'journal', label: 'Journal', icon: <BookOpen className="w-4 h-4" />, gradient: 'from-violet-500 to-violet-600', badgeColor: 'bg-violet-500' },
    { key: 'debt', label: 'Debt', icon: <Wallet className="w-4 h-4" />, gradient: 'from-red-500 to-red-600', badgeColor: 'bg-red-500', itemCountFn: platinumGetNotificationDebtItemCounts },
    { key: 'billing', label: 'Billing', icon: <Landmark className="w-4 h-4" />, gradient: 'from-amber-500 to-amber-600', badgeColor: 'bg-amber-500', itemCountFn: platinumGetBillingTabItemDetailsCount },
    { key: 'property', label: 'Property', icon: <Home className="w-4 h-4" />, gradient: 'from-emerald-500 to-emerald-600', badgeColor: 'bg-emerald-500', itemCountFn: platinumGetPropertyTabItemDetailsCount },
    { key: 'pos', label: 'POS', icon: <Receipt className="w-4 h-4" />, gradient: 'from-[#8C8C8C] to-[#6F6F6F]', badgeColor: 'bg-[#6B6B6B]', itemCountFn: platinumGetPosTabItemDetailsCount },
    { key: 'rebate', label: 'Rebate', icon: <Building2 className="w-4 h-4" />, gradient: 'from-pink-500 to-pink-600', badgeColor: 'bg-pink-500', itemCountFn: platinumGetRebateTabItemDetailsCount },
    { key: 'graphs', label: 'Graphs', icon: <BarChart3 className="w-4 h-4" />, gradient: 'from-purple-500 to-purple-600', badgeColor: 'bg-purple-500' },
    { key: 'assets', label: 'Assets', icon: <Package className="w-4 h-4" />, gradient: 'from-slate-500 to-slate-600', badgeColor: 'bg-slate-500' },
];

const FRIENDLY_LABELS: Record<string, string> = {
    interestWaiverHistory: 'Interest Waiver History',
    interestWaiverCancel: 'Interest Waiver Cancelled',
    generalValuationServiceNotification: 'General Valuation Service Notification',
    tariffChangeAwaitingAuthorisation: 'Tariff Change Awaiting Authorisation',
    addBillingStartDateIssue: 'Billing Start Date Issue',
    deposit: 'Deposit',
    propOwner: 'Property Owner',
    account: 'Account',
    unit: 'Unit',
    activeInactivePartition: 'Active/Inactive Partition',
    propertyRatesAccountException: 'Property Rates Account Exception',
    propServiceDeclinedRequest: 'Property Service Declined Request',
    propDeclinedRequest: 'Property Declined Request',
    noTariifsInMOC: 'No Tariffs in MOC',
    interestwaiverTerminationDecline: 'Interest Waiver Termination Declined',
    paymentExtension: 'Payment Extension',
    firstAndFinalAwaitingApproval: 'First & Final Awaiting Approval',
    meterRemovalAwaitingApproval: 'Meter Removal Awaiting Approval',
    billingCycleDueAlerts: 'Billing Cycle Due Alerts',
    meterbooksNotLinkedToCycle: 'Meter Books Not Linked to Cycle',
    meterBookWithNoRouteFile: 'Meter Book With No Route File',
    reportMeters: 'Report Meters',
    metersNotLinkedToRouteFile: 'Meters Not Linked to Route File',
    notSequencedMeters: 'Meters Not Sequenced',
    outstandingMeterbooks: 'Outstanding Meter Books',
    meterPendingStatus: 'Meter Pending Status',
    meterChangesPendingList: 'Meter Changes Pending',
    finalServicesWithNoMeterReading: 'Final Services Without Meter Reading',
    firstAndFinalApproved: 'First & Final Approved',
    meterRemovalReadingsRequired: 'Meter Removal Readings Required',
    firstAndFinalOutstanding: 'First & Final Outstanding',
    firstAndFinalDeclinedAlerts: 'First & Final Declined',
    meterRemovalDeclinedAlerts: 'Meter Removal Declined',
    accountsForReconnectionCount: 'Accounts for Reconnection',
    debtWriteOffAuthorisationCount: 'Debt Write-Off Authorisation',
    employeeDeductionSetupCount: 'Employee Deduction Setup',
    repaymentPlansDeclinedCount: 'Repayment Plans Declined',
    repaymentPlansApprovedButNotActivatedCount: 'Repayment Plans Approved (Not Activated)',
    billingCyclePreparation: 'Billing Cycle Preparation',
    consumerBillingRunApprovalPending: 'Consumer Billing Run Approval Pending',
    reviewRatesRun: 'Review Rates Run',
    ratesAutorunSupplementaryRollsNotProcessed: 'Supplementary Rolls Not Processed',
    ratesAutorunGeneralSupplementaryValuationsReachedTheirExpiryDate: 'Supplementary Valuations Expired',
    billingRunProgress: 'Billing Run Progress',
    approveGeneralValuationRoll: 'Approve General Valuation Roll',
    approveSupplementaryValuationRoll: 'Approve Supplementary Valuation Roll',
    printGeneralValuationRollLetter: 'Print General Valuation Roll Letter',
    unitIncompleteWorkflowCapture: 'Unit Incomplete Workflow Capture',
    propertyRegistrationAlert: 'Property Registration Alert',
    propertiesWithoutPartitions: 'Properties Without Partitions',
    noBillingCycleUnitData: 'No Billing Cycle Unit Data',
    outstandingValuations: 'Outstanding Valuations',
    valuationExpired: 'Valuation Expired',
    declinedValuations: 'Declined Valuations',
    clearedClearanceList: 'Cleared Clearance List',
    clearanceStagingSection118_1Waiting: 'Clearance S118(1) Waiting',
    clearanceStagingSection118_4Waiting: 'Clearance S118(4) Waiting',
    clearanceStagingSection118_1Declined: 'Clearance S118(1) Declined',
    clearanceStagingSection118_4Declined: 'Clearance S118(4) Declined',
    consolidationPropertyDetails: 'Consolidation Property Details',
    consolidatedPropertyDetailItems: 'Consolidated Property Detail Items',
    transferOwnershipDeclined: 'Transfer Ownership Declined',
    subdivisionDeclined: 'Subdivision Declined',
    awaitingVerification: 'Awaiting Verification',
    applicationAuthorisation: 'Application Authorisation',
    terminationAuthorisation: 'Termination Authorisation',
    disqualificationAuthorisation: 'Disqualification Authorisation',
    applicationDeclined: 'Application Declined',
    finalReadingApprovalPendingMeterChange: 'Final Reading Approval Pending (Meter Change)',
    firstAndFinalReadingsRequired: 'First & Final Readings Required',
    repaymentPlansAwaitingAuthorisation: 'Repayment Plans Awaiting Authorisation',
    repaymentPlansAwaitingTerminationAuthorisation: 'Repayment Plans Awaiting Termination Authorisation',
    cutoffHistory: 'Cut-Off History',
    declinedJournals: 'Declined Journals',
    journalsPendingReview: 'Journals Pending Review',
    notLinkedService: 'Not Linked Service',
    unpaidTransactions: 'Unpaid Transactions',
    directDepositsAllocation: 'Direct Deposits Allocation',
    thirdPartyPaymentPending: 'Third Party Payment Pending',
    postDatedChequeSearch: 'Post-Dated Cheque Search',
};

const SUB_ITEM_ENDPOINT_MAP: Record<string, string> = {
    // Account sub-items
    deposit: '/api/BillingDashboard/get-deposit-table-data',
    propertyRatesAccountException: '/api/BillingDashboard/get-property-rates-exception-table-data',
    propServiceDeclinedRequest: '/api/BillingDashboard/get-status-change-declined-table-data',
    propDeclinedRequest: '/api/BillingDashboard/get-status-change-declined-table-data',
    tariffChangeAwaitingAuthorisation: '/api/BillingDashboard/get-tariff-change-awaiting-authorisation-table-data',
    generalValuationServiceNotification: '/api/BillingDashboard/get-general-valuation-notification-table-data',
    unit: '/api/BillingDashboard/get-unit-table-data',
    account: '/api/BillingDashboard/get-account-table-data',
    propOwner: '/api/BillingDashboard/get-property-owner-table-data',
    activeInactivePartition: '/api/BillingDashboard/get-active-inactive-partition-table-data',
    interestWaiverHistory: '/api/BillingDashboard/get-interest-waiver-history-table-data',
    interestWaiverCancel: '/api/BillingDashboard/get-interest-waiver-cancel-table-data',
    paymentExtension: '/api/BillingDashboard/get-payment-extension-table-data',
    addBillingStartDateIssue: '/api/BillingDashboard/get-billing-start-date-issue-table-data',
    noTariifsInMOC: '/api/BillingDashboard/get-not-included-moc-table-data',
    interestWaiverDeclined: '/api/BillingDashboard/get-interest-waiver-declined-table-data',
    interestwaiverTerminationDecline: '/api/BillingDashboard/get-interest-waiver-termination-application-declined-table-data',
    // Consumption sub-items
    firstAndFinalAwaitingApproval: '/api/BillingDashboard/get-first-and-final-outstanding',
    meterRemovalAwaitingApproval: '/api/BillingDashboard/get-meter-removal-readings-required',
    billingCycleDueAlerts: '/api/BillingDashboard/get-billing-cycle-due-alerts',
    meterbooksNotLinkedToCycle: '/api/BillingDashboard/get-meterbooks-not-linked-to-cycle',
    meterBookWithNoRouteFile: '/api/BillingDashboard/get-meterbook-with-no-route-file',
    reportMeters: '/api/BillingDashboard/get-report-meters',
    metersNotLinkedToRouteFile: '/api/BillingDashboard/get-meters-not-linked-to-route-file',
    notSequencedMeters: '/api/BillingDashboard/get-not-sequenced-meters',
    outstandingMeterbooks: '/api/BillingDashboard/get-report-meters',
    meterPendingStatus: '/api/BillingDashboard/get-meter-pending-status',
    meterChangesPendingList: '/api/BillingDashboard/get-meter-changes-pending-list',
    finalServicesWithNoMeterReading: '/api/BillingDashboard/get-final-services-with-no-meter-reading',
    firstAndFinalApproved: '/api/BillingDashboard/get-first-and-final-outstanding',
    meterRemovalReadingsRequired: '/api/BillingDashboard/get-meter-removal-readings-required',
    firstAndFinalOutstanding: '/api/BillingDashboard/get-first-and-final-outstanding',
    firstAndFinalDeclinedAlerts: '/api/BillingDashboard/get-first-and-final-declined-alerts',
    meterRemovalDeclinedAlerts: '/api/BillingDashboard/get-meter-removal-declined-alerts',
    finalReadingApprovalPendingMeterChange: '/api/BillingDashboard/get-final-reading-approval-pending-meter-change',
    firstAndFinalReadingsRequired: '/api/BillingDashboard/get-first-and-final-readings-required',
    // Debt sub-items
    accountsForReconnectionCount: '/api/BillingDashboard/get-bad-debt-reconciliation',
    debtWriteOffAuthorisationCount: '/api/BillingDashboard/get-bad-debt-reconciliation',
    employeeDeductionSetupCount: '/api/BillingDashboard/get-employee-deduction-alerts',
    repaymentPlansDeclinedCount: '/api/BillingDashboard/get-repayment-plan-declined',
    repaymentPlansApprovedButNotActivatedCount: '/api/BillingDashboard/get-repayment-plan-approved-not-activated',
    repaymentPlansAwaitingAuthorisation: '/api/BillingDashboard/get-repayment-plan-awaiting-authorisation',
    repaymentPlansAwaitingTerminationAuthorisation: '/api/BillingDashboard/get-repayment-plans-awaiting-termination-authorisation',
    cutoffHistory: '/api/BillingDashboard/get-cutoff-history',
    // Billing sub-items
    billingCyclePreparation: '/api/BillingDashboard/get-billing-cycle-preparation-alerts-table-data',
    consumerBillingRunApprovalPending: '/api/BillingDashboard/get-billing-run-progress-table-data',
    billingRunProgress: '/api/BillingDashboard/get-billing-run-progress-table-data',
    reviewRatesRun: '/api/BillingDashboard/get-billing-run-progress-table-data',
    ratesAutorunSupplementaryRollsNotProcessed: '/api/BillingDashboard/get-billing-run-progress-table-data',
    ratesAutorunGeneralSupplementaryValuationsReachedTheirExpiryDate: '/api/BillingDashboard/get-billing-run-progress-table-data',
    // Property sub-items
    approveGeneralValuationRoll: '/api/BillingDashboard/get-declined-valuations-table-data',
    approveSupplementaryValuationRoll: '/api/BillingDashboard/get-declined-valuations-table-data',
    unitIncompleteWorkflowCapture: '/api/BillingDashboard/get-unit-incomplete-workflow-capture-table-data',
    propertyRegistrationAlert: '/api/BillingDashboard/get-property-registration-alert-table-data',
    propertiesWithoutPartitions: '/api/BillingDashboard/get-properties-without-partitions-table-data',
    noBillingCycleUnitData: '/api/BillingDashboard/get-no-billing-cycle-unit-table-data',
    outstandingValuations: '/api/BillingDashboard/get-declined-valuations-table-data',
    valuationExpired: '/api/BillingDashboard/get-valuation-expired',
    declinedValuations: '/api/BillingDashboard/get-declined-valuations-table-data',
    consolidationPropertyDetails: '/api/BillingDashboard/get-consolidation-property-details-table-data',
    consolidatedPropertyDetailItems: '/api/BillingDashboard/get-consolidated-property-detail-items-table-data',
    transferOwnershipDeclined: '/api/BillingDashboard/get-transfer-ownership-declined-table-data',
    subdivisionDeclined: '/api/BillingDashboard/get-subdivision-declined-table-data',
    // POS sub-items
    clearedClearanceList: '/api/BillingDashboard/get-cleared-clearance-list-table-data',
    clearanceStagingSection118_1Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-1-waiting-table-data',
    clearanceStagingSection118_4Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-4-waiting-table-data',
    clearanceStagingSection118_1Declined: '/api/BillingDashboard/get-clearance-staging-section-118-1-declined-table-data',
    clearanceStagingSection118_4Declined: '/api/BillingDashboard/get-clearance-staging-section-118-4-declined-table-data',
    unpaidTransactions: '/api/BillingDashboard/get-unpaid-transactions',
    directDepositsAllocation: '/api/BillingDashboard/get-direct-deposits-allocation-table-data',
    thirdPartyPaymentPending: '/api/BillingDashboard/get-third-party-payment-pending-table-data',
    postDatedChequeSearch: '/api/BillingDashboard/get-post-dated-cheque-search-table-data',
    // Indigent Subsidy sub-items
    awaitingVerification: '/api/BillingDashboard/get-awating-verification',
    applicationAuthorisation: '/api/BillingDashboard/get-attp-applicatoin-authorization-details',
    terminationAuthorisation: '/api/BillingDashboard/get-attp-applicatoin-termination-details',
    applicationDeclined: '/api/BillingDashboard/get-awaiting-application-declined-details',
    disqualificationAuthorisation: '/api/BillingDashboard/get-automatic-disqualification',
    // Journal sub-items
    declinedJournals: '/api/BillingDashboard/get-declined-journals',
    journalsPendingReview: '/api/BillingDashboard/get-journals-pending-review',
    // Rebate sub-items
    notLinkedService: '/api/BillingDashboard/get-not-linked-service-table-data',
};

const SKIP_KEYS = new Set(['totalCount', 'total', 'totalRecords']);

function getSeverity(key: string, count: number): 'critical' | 'warning' | 'info' | 'neutral' {
    if (count === 0) return 'neutral';
    const lower = key.toLowerCase();
    if (lower.includes('declined') || lower.includes('exception') || lower.includes('outstanding') || lower.includes('notsequenced')) return 'critical';
    if (lower.includes('awaiting') || lower.includes('pending') || lower.includes('notlinked') || lower.includes('notprocessed') || lower.includes('expired')) return 'warning';
    return 'info';
}

function friendlyLabel(key: string): string {
    if (FRIENDLY_LABELS[key]) return FRIENDLY_LABELS[key];
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/count$/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

function extractTableRows(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    for (const k of ['items', 'value', 'results', 'data', 'rows']) {
        if (data[k] && Array.isArray(data[k])) return data[k];
    }
    return [];
}

function safeCount(val: any): number {
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object') return Number(val.count ?? val.value ?? val.total ?? 0);
    return Number(val) || 0;
}

function parseSubItems(data: any): SubItem[] {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
        .filter(([key]) => !SKIP_KEYS.has(key))
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([key, value]) => {
            const count = safeCount(value);
            return {
                key,
                label: friendlyLabel(key),
                count,
                severity: getSeverity(key, count),
                endpoint: SUB_ITEM_ENDPOINT_MAP[key],
            };
        });
}

function AnimatedCounter({ value }: { value: number }) {
    const [displayed, setDisplayed] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        const from = prevRef.current;
        prevRef.current = value;
        if (value === 0 && from === 0) { setDisplayed(0); return; }
        const duration = 500;
        const start = Date.now();
        let rafId: number;
        const tick = () => {
            const p = Math.min((Date.now() - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplayed(Math.round(from + (value - from) * eased));
            if (p < 1) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [value]);
    return <>{displayed.toLocaleString()}</>;
}

const SEVERITY_STYLES = {
    critical: { dot: 'bg-red-500', text: 'text-red-700 font-semibold', badge: 'bg-red-100 text-red-700 border-red-200' },
    warning: { dot: 'bg-amber-500', text: 'text-amber-700 font-medium', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    info: { dot: 'bg-[var(--pos-accent)]', text: 'text-slate-700', badge: 'bg-[#F2F4F7] text-slate-600 border-[#D6D6D6]' },
    neutral: { dot: 'bg-slate-300', text: 'text-slate-400', badge: 'bg-[#F7F7F7] text-slate-400 border-[#E5E5E5]' },
};

function exportToExcel(rows: any[], sheetName: string, fileName: string) {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
    const headerRow = columns.map(c => friendlyLabel(c));
    const dataRows = rows.map(row =>
        columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return '';
            if (typeof val === 'boolean') return val ? 'Yes' : 'No';
            return val;
        })
    );
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    const colWidths = columns.map((col, i) => {
        const headerLen = headerRow[i].length;
        const maxDataLen = dataRows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 0);
        return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

function DetailTable({ endpoint, label }: { endpoint: string; label?: string }) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [exporting, setExporting] = useState(false);
    const pageSize = 10;
    const exportPageSize = 500;
    const safeName = (label || 'Dashboard Export').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const data = await platinumDashboardGenericTable(endpoint, { page: p, pageSize, orderby: null, shortDirection: null });
            const rows = extractTableRows(data);
            setItems(rows);
            setTotalCount(data?.totalCount ?? data?.totalRecords ?? data?.count ?? rows.length);
        } catch (e: any) {
            const msg = e?.message || 'Unknown error';
            if (msg.includes('500') || msg.includes('Internal Server')) {
                setError('This detail view is not available from the API');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    useEffect(() => { load(page); }, [page, load]);

    const handleExportAll = useCallback(async () => {
        setExporting(true);
        try {
            const allRows: any[] = [];
            const totalPages = Math.ceil(totalCount / exportPageSize);
            for (let p = 1; p <= totalPages; p++) {
                const data = await platinumDashboardGenericTable(endpoint, { page: p, pageSize: exportPageSize, orderby: null, shortDirection: null });
                const rows = extractTableRows(data);
                allRows.push(...rows);
                if (rows.length < exportPageSize) break;
            }
            if (allRows.length > 0) {
                exportToExcel(allRows, safeName, `${safeName} - ${new Date().toLocaleDateString('en-GB')}`);
            }
        } catch {
            exportToExcel(items, safeName, `${safeName} - Page ${page}`);
        } finally {
            setExporting(false);
        }
    }, [endpoint, totalCount, items, page, safeName]);

    const handleExportPage = useCallback(() => {
        if (items.length > 0) {
            exportToExcel(items, safeName, `${safeName} - Page ${page}`);
        }
    }, [items, page, safeName]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--pos-accent)]" />
                <span className="text-sm text-muted-foreground">Loading details...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-[#F7F7F7] text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{error}</span>
            </div>
        );
    }

    if (items.length === 0) {
        return <div className="text-center py-4 text-sm text-muted-foreground">No detail records found</div>;
    }

    const columns = Object.keys(items[0]).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'Id');

    return (
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b gap-2">
                <span className="text-xs font-medium text-slate-600 shrink-0">
                    {totalCount.toLocaleString()} record{totalCount !== 1 ? 's' : ''} found
                </span>
                <div className="flex items-center gap-1">
                    {totalPages > 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportPage}
                            className="h-11 sm:h-7 gap-1.5 text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-100"
                            data-testid="btn-export-page"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Page</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportAll}
                        disabled={exporting}
                        className="h-11 sm:h-7 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-100 font-medium"
                        data-testid="btn-export-excel"
                    >
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                        {exporting ? 'Exporting...' : totalPages > 1 ? 'Export All' : 'Export'}
                    </Button>
                </div>
            </div>
            <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[400px]">
                <Table className="w-full table-auto">
                    <TableHeader className="sticky top-0 z-10 bg-white">
                        <TableRow className="bg-[#F7F7F7]">
                            {columns.map(col => (
                                <TableHead key={col} className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap py-2 px-2.5">
                                    {friendlyLabel(col)}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-[var(--pos-accent-tint)]">
                                {columns.map(col => {
                                    const val = row[col];
                                    const isAmount = typeof val === 'number' && /amount|balance|total|value/i.test(col);
                                    return (
                                        <TableCell key={col} className="text-xs py-1.5 px-2.5 whitespace-nowrap max-w-[220px] truncate">
                                            {val === null || val === undefined ? <span className="text-slate-300">—</span>
                                                : isAmount ? <span className="font-mono">R {val.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                                                : typeof val === 'boolean' ? (val ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />)
                                                : typeof val === 'number' ? val.toLocaleString()
                                                : String(val)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="sm:hidden divide-y divide-[#E5E5E5] max-h-[400px] overflow-y-auto">
                {items.map((row, idx) => (
                    <div key={idx} className="p-3 space-y-1.5" data-testid={`card-detail-row-${idx}`}>
                        {columns.map(col => {
                            const val = row[col];
                            const isAmount = typeof val === 'number' && /amount|balance|total|value/i.test(col);
                            return (
                                <div key={col} className="flex items-start justify-between gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">{friendlyLabel(col)}</span>
                                    <span className="text-xs text-right text-slate-700 break-words min-w-0">
                                        {val === null || val === undefined ? '—'
                                            : isAmount ? `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                                            : typeof val === 'boolean' ? (val ? 'Yes' : 'No')
                                            : typeof val === 'number' ? val.toLocaleString()
                                            : String(val)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t bg-[#F7F7F7]/50">
                <span className="text-xs text-muted-foreground" data-testid="text-table-range">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
                </span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-0.5 sm:gap-0.5">
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" disabled={page <= 1} onClick={() => setPage(1)} data-testid="btn-page-first"><ChevronsLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="btn-page-prev"><ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button>
                        <span className="text-xs font-medium px-2" data-testid="text-page-indicator">{page}/{totalPages}</span>
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="btn-page-next"><ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7" disabled={page >= totalPages} onClick={() => setPage(totalPages)} data-testid="btn-page-last"><ChevronsRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function GraphsPanel() {
    const [paymentByType, setPaymentByType] = useState<any[]>([]);
    const [debtChart, setDebtChart] = useState<any>(null);
    const [meterChart, setMeterChart] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const [pbt, dc, mc] = await Promise.allSettled([
                platinumGetBillingPaymentByTypeOfUse(),
                platinumGetDebtArrangementSummaryChart(),
                platinumGetMeterReadingProgressChart(),
            ]);
            if (pbt.status === 'fulfilled') setPaymentByType(Array.isArray(pbt.value) ? pbt.value : extractTableRows(pbt.value));
            if (dc.status === 'fulfilled') setDebtChart(dc.value);
            if (mc.status === 'fulfilled') setMeterChart(mc.value);
            setLoading(false);
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500 mr-2" />
                <span className="text-muted-foreground text-sm">Loading charts...</span>
            </div>
        );
    }

    const renderData = (title: string, data: any, icon: React.ReactNode, color: string) => {
        const items = Array.isArray(data) ? data : extractTableRows(data);
        if (!items?.length) return null;
        const cols = Object.keys(items[0]).filter(k => !k.startsWith('_'));
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg ${color} text-white flex items-center justify-center shrink-0`}>{icon}</div>
                        <h4 className="font-semibold text-sm text-slate-700 truncate">{title}</h4>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportToExcel(items, title, `${title} - ${new Date().toLocaleDateString('en-GB')}`)}
                        className="h-11 sm:h-7 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-100 font-medium"
                        data-testid={`btn-export-${title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Export Excel
                    </Button>
                </div>
                <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[250px]">
                        <Table className="w-full table-auto">
                            <TableHeader className="sticky top-0 z-10 bg-white">
                                <TableRow className="bg-[#F7F7F7]">
                                    {cols.map(c => <TableHead key={c} className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap px-2.5">{friendlyLabel(c)}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row: any, i: number) => (
                                    <TableRow key={i} className="hover:bg-purple-50/30">
                                        {cols.map(c => (
                                            <TableCell key={c} className="text-xs py-1.5 px-2.5 whitespace-nowrap max-w-[220px] truncate">
                                                {typeof row[c] === 'number' ? row[c].toLocaleString('en-ZA', row[c] % 1 !== 0 ? { minimumFractionDigits: 2 } : {}) : String(row[c] ?? '')}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="sm:hidden divide-y divide-[#E5E5E5] max-h-[250px] overflow-y-auto">
                        {items.map((row: any, i: number) => (
                            <div key={i} className="p-3 space-y-1.5">
                                {cols.slice(0, 6).map(c => (
                                    <div key={c} className="flex items-start justify-between gap-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">{friendlyLabel(c)}</span>
                                        <span className="text-xs text-right text-slate-700 break-words min-w-0">
                                            {typeof row[c] === 'number' ? row[c].toLocaleString('en-ZA', row[c] % 1 !== 0 ? { minimumFractionDigits: 2 } : {}) : String(row[c] ?? '')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {renderData('Payments by Type of Use', paymentByType, <TrendingUp className="w-3.5 h-3.5" />, 'bg-purple-500')}
            {renderData('Debt Arrangement Summary', debtChart, <Gauge className="w-3.5 h-3.5" />, 'bg-red-500')}
            {renderData('Meter Reading Progress', meterChart, <Activity className="w-3.5 h-3.5" />, 'bg-cyan-500')}
            {!paymentByType?.length && !debtChart && !meterChart && (
                <div className="text-center py-10 text-muted-foreground">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No chart data available</p>
                </div>
            )}
        </div>
    );
}

function CategoryPanel({ category, subItems, isLoading }: { category: CategoryConfig; subItems: SubItem[]; isLoading: boolean }) {
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    const handleExportSummary = useCallback(() => {
        if (!subItems.length) return;
        const rows = subItems.map(s => ({ Item: s.label, Count: s.count, Severity: s.severity }));
        exportToExcel(rows, `${category.label} Summary`, `${category.label} Summary - ${new Date().toLocaleDateString('en-GB')}`);
    }, [subItems, category.label]);

    if (category.key === 'graphs') return <GraphsPanel />;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--pos-accent)] mr-2" />
                <span className="text-sm text-muted-foreground">Loading {category.label} details...</span>
            </div>
        );
    }

    if (!category.itemCountFn) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No sub-item breakdown available for {category.label}</p>
            </div>
        );
    }

    if (subItems.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                <p className="text-sm">All clear — no notifications for {category.label}</p>
            </div>
        );
    }

    const sorted = [...subItems].sort((a, b) => {
        const sevOrder = { critical: 0, warning: 1, info: 2, neutral: 3 };
        if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
        return b.count - a.count;
    });

    const withCounts = sorted.filter(s => s.count > 0);
    const zeroCounts = sorted.filter(s => s.count === 0);

    return (
        <div className="space-y-1">
            {withCounts.length > 0 && (
                <div className="flex justify-end mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportSummary}
                        className="h-11 sm:h-7 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-100 font-medium"
                        data-testid="btn-export-summary"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Export Summary
                    </Button>
                </div>
            )}
            {withCounts.map(item => {
                const isExpanded = expandedItem === item.key;
                const styles = SEVERITY_STYLES[item.severity];
                return (
                    <div key={item.key}>
                        <button
                            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg transition-all group ${
                                isExpanded ? 'bg-[var(--pos-accent-tint)] ring-1 ring-[var(--pos-accent-shadow)]' : 'hover:bg-[#F7F7F7]'
                            }`}
                            onClick={() => setExpandedItem(isExpanded ? null : item.key)}
                            data-testid={`btn-subitem-${item.key}`}
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                            <span className={`flex-1 text-sm ${styles.text}`}>{item.label}</span>
                            <span className={`inline-flex items-center justify-center min-w-[36px] h-6 px-2 rounded-md text-xs font-semibold border ${styles.badge}`}>
                                {item.count.toLocaleString()}
                            </span>
                            {item.endpoint && (
                                isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-[var(--pos-accent)] shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[var(--pos-accent)] shrink-0 transition-colors" />
                            )}
                        </button>
                        {isExpanded && item.endpoint && (
                            <div className="ml-5 mt-1.5 mb-2 pl-3 border-l-2 border-[var(--pos-accent-shadow)]">
                                <DetailTable endpoint={item.endpoint} label={item.label} />
                            </div>
                        )}
                    </div>
                );
            })}
            {zeroCounts.length > 0 && withCounts.length > 0 && (
                <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-slate-500 px-3 py-1.5" data-testid="btn-show-zero-items">
                        {zeroCounts.length} items with zero count
                    </summary>
                    <div className="space-y-0.5 mt-1">
                        {zeroCounts.map(item => (
                            <div key={item.key} className="flex items-center gap-3 px-3 py-1.5 text-sm text-slate-400">
                                <span className="w-2 h-2 rounded-full bg-[#D6D6D6] shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                <span className="text-xs">0</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

export default function BillingDashboard() {
    const { toast } = useToast();
    const { platinumUser, sessionLoading } = usePos();
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [alertData, setAlertData] = useState<{ workflow: number; config: number; items: any[] }>({ workflow: 0, config: 0, items: [] });
    const [activeCategory, setActiveCategory] = useState('account');
    const [subItems, setSubItems] = useState<Record<string, SubItem[]>>({});
    const [subItemsLoading, setSubItemsLoading] = useState<Record<string, boolean>>({});
    const hasLoadedRef = useRef(false);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const [alertResult, countResult] = await Promise.allSettled([
                platinumGetAlertCounts(),
                platinumGetNotificationCounts(),
            ]);

            let gotData = false;

            if (alertResult.status === 'fulfilled') {
                const alerts = Array.isArray(alertResult.value) ? alertResult.value : [];
                const wf = alerts.find((a: any) => a.key === 'workflow-alert');
                const cf = alerts.find((a: any) => a.key === 'configuration-alert');
                setAlertData({ workflow: Number(wf?.value) || 0, config: Number(cf?.value) || 0, items: alerts });
                gotData = true;
            }

            if (countResult.status === 'fulfilled') {
                const raw = countResult.value;
                const newCounts: Record<string, number> = {};
                if (Array.isArray(raw)) {
                    raw.forEach((n: any) => {
                        if (n.key && n.value !== undefined) {
                            newCounts[n.key] = Number(n.value) || 0;
                        }
                    });
                } else if (raw && typeof raw === 'object') {
                    Object.entries(raw).forEach(([k, v]) => {
                        if (!SKIP_KEYS.has(k)) {
                            newCounts[k] = typeof v === 'number' ? v : Number(v) || 0;
                        }
                    });
                }
                setCounts(newCounts);
                gotData = true;
            }

            if (gotData) hasLoadedRef.current = true;
        } catch (e: any) {
            toast({ title: 'Error loading dashboard', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const refreshAll = useCallback(async () => {
        setCounts({});
        setSubItems({});
        setAlertData({ workflow: 0, config: 0, items: [] });
        await loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        if (platinumUser && !sessionLoading) {
            loadDashboard();
        }
    }, [platinumUser, sessionLoading, loadDashboard]);

    const loadSubItems = useCallback(async (categoryKey: string) => {
        const cat = CATEGORIES.find(c => c.key === categoryKey);
        if (!cat?.itemCountFn || subItems[categoryKey]) return;
        setSubItemsLoading(prev => ({ ...prev, [categoryKey]: true }));
        try {
            const data = await cat.itemCountFn();
            setSubItems(prev => ({ ...prev, [categoryKey]: parseSubItems(data) }));
        } catch {
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

    const activeCat = CATEGORIES.find(c => c.key === activeCategory)!;
    const totalNotifications = Object.values(counts).reduce((s, v) => s + v, 0);

    return (
        <PosLayout>
            <div className="flex flex-col flex-1 min-h-0 overflow-auto sm:overflow-hidden" data-testid="page-billing-dashboard">
                <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2">
                                Billing Dashboard
                                <HelpTip text="Central overview of all billing notifications, alerts, and system status across all municipal services." />
                            </h1>
                            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
                                {!platinumUser ? 'Waiting for authentication...' : loading ? 'Loading notification data...' : `${totalNotifications.toLocaleString()} total notifications across ${Object.keys(counts).length} categories`}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading} className="h-11 sm:h-auto gap-2 self-start sm:self-auto" data-testid="btn-refresh-dashboard">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="sm:flex-1 sm:overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
                    <div className="space-y-5">

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-2xl font-bold text-amber-900" data-testid="text-workflow-count">
                                        {loading ? '...' : <AnimatedCounter value={alertData.workflow} />}
                                    </div>
                                    <div className="text-xs text-amber-700/70">Workflow Alerts</div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-[#D6D6D6] bg-gradient-to-br from-[var(--pos-accent-tint)] to-[#F7F7F7] p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white flex items-center justify-center shadow-lg shadow-[var(--pos-accent-shadow)]">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-2xl font-bold text-[#2E2E2E]" data-testid="text-config-count">
                                        {loading ? '...' : <AnimatedCounter value={alertData.config} />}
                                    </div>
                                    <div className="text-xs text-[#6B6B6B]">Config Alerts</div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border border-[#D6D6D6] bg-gradient-to-br from-[#F7F7F7] to-white p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[linear-gradient(180deg,#8C8C8C_0%,#6F6F6F_100%)] text-white flex items-center justify-center shadow-lg shadow-[#6B6B6B]/20">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-2xl font-bold text-[#2E2E2E]" data-testid="text-total-notifications">
                                        {loading ? '...' : <AnimatedCounter value={totalNotifications} />}
                                    </div>
                                    <div className="text-xs text-[#6B6B6B]">Total Notifications</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Categories</h2>
                            <div className="flex-1 h-px bg-gradient-to-r from-[#D6D6D6] to-transparent" />
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 mb-4" data-testid="category-pills">
                            {CATEGORIES.map(cat => {
                                const count = counts[cat.key] ?? 0;
                                const isActive = activeCategory === cat.key;
                                const hasData = count > 0;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => setActiveCategory(cat.key)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                                            isActive
                                                ? `bg-gradient-to-r ${cat.gradient} text-white shadow-lg scale-[1.02]`
                                                : `bg-white border ${hasData ? 'border-[#D6D6D6] text-slate-700' : 'border-[#E5E5E5] text-slate-400'} hover:border-[#D6D6D6] hover:shadow-sm`
                                        }`}
                                        data-testid={`pill-${cat.key}`}
                                    >
                                        {cat.icon}
                                        <span className="truncate">{cat.label}</span>
                                        {cat.key !== 'graphs' && (
                                            <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold ml-auto ${
                                                isActive ? 'bg-white/25 text-white'
                                                    : hasData ? `${cat.badgeColor} text-white` : 'bg-[#F2F4F7] text-slate-400'
                                            }`}>
                                                {(loading || !platinumUser) ? <Loader2 className="w-3 h-3 animate-spin" /> : <AnimatedCounter value={count} />}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                            <div className={`h-1 bg-gradient-to-r ${activeCat.gradient}`} />
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E5E5E5]">
                                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activeCat.gradient} text-white flex items-center justify-center shadow-md`}>
                                        {activeCat.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800">{activeCat.label}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {activeCat.key === 'graphs' ? 'Chart data & analytics' :
                                                `${(counts[activeCat.key] || 0).toLocaleString()} notifications`}
                                        </p>
                                    </div>
                                    {activeCat.key !== 'graphs' && (
                                        <div className={`text-2xl font-bold font-mono ${activeCat.badgeColor} bg-clip-text text-transparent bg-gradient-to-r ${activeCat.gradient}`}>
                                            <AnimatedCounter value={counts[activeCat.key] || 0} />
                                        </div>
                                    )}
                                </div>
                                <CategoryPanel
                                    category={activeCat}
                                    subItems={subItems[activeCat.key] || []}
                                    isLoading={!!subItemsLoading[activeCat.key]}
                                />
                            </CardContent>
                        </Card>
                    </div>
                    </div>
                </div>
            </div>
        </PosLayout>
    );
}
