import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

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
  gradient: string;
  hasItemCountFn: boolean;
}

@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing-dashboard.component.html',
  styleUrl: './billing-dashboard.component.css'
})
export class BillingDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  objectKeys = Object.keys;

  loading = signal(true);
  error = signal('');

  counts = signal<Record<string, number>>({});
  alertData = signal<{ workflow: number; config: number }>({ workflow: 0, config: 0 });
  activeCategory = signal('account');
  subItems = signal<Record<string, SubItem[]>>({});
  subItemsLoading = signal<Record<string, boolean>>({});

  expandedItem = signal<string | null>(null);
  detailLoading = signal(false);
  detailItems = signal<any[]>([]);
  detailError = signal('');
  detailPage = signal(1);
  detailTotalCount = signal(0);
  detailPageSize = 10;

  showZeroCounts = signal(false);

  chartLoading = signal(false);
  paymentByTypeData = signal<any[]>([]);
  debtChartData = signal<any[]>([]);
  meterChartData = signal<any[]>([]);
  billingCyclesData = signal<any[]>([]);

  categories: CategoryConfig[] = [
    { key: 'account', label: 'Account', gradient: 'grad-accent', hasItemCountFn: true },
    { key: 'indigentsubsidy', label: 'Indigent Subsidy', gradient: 'grad-teal', hasItemCountFn: true },
    { key: 'consumption', label: 'Consumption', gradient: 'grad-cyan', hasItemCountFn: true },
    { key: 'journal', label: 'Journal', gradient: 'grad-violet', hasItemCountFn: false },
    { key: 'debt', label: 'Debt', gradient: 'grad-red', hasItemCountFn: true },
    { key: 'billing', label: 'Billing', gradient: 'grad-amber', hasItemCountFn: true },
    { key: 'property', label: 'Property', gradient: 'grad-emerald', hasItemCountFn: true },
    { key: 'pos', label: 'POS', gradient: 'grad-gray', hasItemCountFn: true },
    { key: 'rebate', label: 'Rebate', gradient: 'grad-pink', hasItemCountFn: true },
    { key: 'graphs', label: 'Graphs', gradient: 'grad-purple', hasItemCountFn: false },
    { key: 'assets', label: 'Assets', gradient: 'grad-slate', hasItemCountFn: false },
  ];

  private friendlyLabels: Record<string, string> = {
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
    section129ProcessHandovers: 'Section 129 – Process Handovers',
    handoverTerminationPending: 'Handover Termination Pending',
    declinedJournals: 'Declined Journals',
    journalsPendingReview: 'Journals Pending Review',
    notLinkedService: 'Not Linked Service',
    unpaidTransactions: 'Unpaid Transactions',
    directDepositsAllocation: 'Direct Deposits Allocation',
    thirdPartyPaymentPending: 'Third Party Payment Pending',
    postDatedChequeSearch: 'Post-Dated Cheque Search',
  };

  private endpointMap: Record<string, string> = {
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
    accountsForReconnectionCount: '/api/BillingDashboard/get-bad-debt-reconciliation',
    debtWriteOffAuthorisationCount: '/api/BillingDashboard/get-bad-debt-reconciliation',
    employeeDeductionSetupCount: '/api/BillingDashboard/get-employee-deduction-alerts',
    repaymentPlansDeclinedCount: '/api/BillingDashboard/get-repayment-plan-declined',
    repaymentPlansApprovedButNotActivatedCount: '/api/BillingDashboard/get-repayment-plan-approved-not-activated',
    repaymentPlansAwaitingAuthorisation: '/api/BillingDashboard/get-repayment-plan-awaiting-authorisation',
    repaymentPlansAwaitingTerminationAuthorisation: '/api/BillingDashboard/get-repayment-plans-awaiting-termination-authorisation',
    cutoffHistory: '/api/BillingDashboard/get-cutoff-history',
    section129ProcessHandovers: '/api/BillingDashboard/get-section129-process-handovers',
    handoverTerminationPending: '/api/BillingDashboard/get-handover-termination-pending',
    billingCyclePreparation: '/api/BillingDashboard/get-billing-cycle-preparation-alerts-table-data',
    consumerBillingRunApprovalPending: '/api/BillingDashboard/get-billing-run-progress-table-data',
    billingRunProgress: '/api/BillingDashboard/get-billing-run-progress-table-data',
    reviewRatesRun: '/api/BillingDashboard/get-billing-run-progress-table-data',
    ratesAutorunSupplementaryRollsNotProcessed: '/api/BillingDashboard/get-billing-run-progress-table-data',
    ratesAutorunGeneralSupplementaryValuationsReachedTheirExpiryDate: '/api/BillingDashboard/get-billing-run-progress-table-data',
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
    clearedClearanceList: '/api/BillingDashboard/get-cleared-clearance-list-table-data',
    clearanceStagingSection118_1Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-1-waiting-table-data',
    clearanceStagingSection118_4Waiting: '/api/BillingDashboard/get-clearance-staging-section-118-4-waiting-table-data',
    clearanceStagingSection118_1Declined: '/api/BillingDashboard/get-clearance-staging-section-118-1-declined-table-data',
    clearanceStagingSection118_4Declined: '/api/BillingDashboard/get-clearance-staging-section-118-4-declined-table-data',
    unpaidTransactions: '/api/BillingDashboard/get-unpaid-transactions',
    directDepositsAllocation: '/api/BillingDashboard/get-direct-deposits-allocation-table-data',
    thirdPartyPaymentPending: '/api/BillingDashboard/get-third-party-payment-pending-table-data',
    postDatedChequeSearch: '/api/BillingDashboard/get-post-dated-cheque-search-table-data',
    awaitingVerification: '/api/BillingDashboard/get-awating-verification',
    applicationAuthorisation: '/api/BillingDashboard/get-attp-applicatoin-authorization-details',
    terminationAuthorisation: '/api/BillingDashboard/get-attp-applicatoin-termination-details',
    applicationDeclined: '/api/BillingDashboard/get-awaiting-application-declined-details',
    disqualificationAuthorisation: '/api/BillingDashboard/get-automatic-disqualification',
    declinedJournals: '/api/BillingDashboard/get-declined-journals',
    journalsPendingReview: '/api/BillingDashboard/get-journals-pending-review',
    notLinkedService: '/api/BillingDashboard/get-not-linked-service-table-data',
  };

  private itemCountEndpoints: Record<string, string> = {
    account: '/api/platinum/billing-dashboard/get-notification-account-item-counts',
    indigentsubsidy: '/api/platinum/billing-dashboard/get-subsidy-item-counts',
    consumption: '/api/platinum/billing-dashboard/get-notification-consumption-item-counts',
    debt: '/api/platinum/billing-dashboard/get-notification-debt-item-counts',
    billing: '/api/platinum/billing-dashboard/get-billing-tab-item-details-count',
    property: '/api/platinum/billing-dashboard/get-property-tab-item-details-count',
    pos: '/api/platinum/billing-dashboard/pos-tab-item-details-count',
    rebate: '/api/platinum/billing-dashboard/get-rebate-tab-item-details-count',
  };

  totalNotifications = computed(() => Object.values(this.counts()).reduce((s, v) => s + v, 0));

  activeCat = computed(() => this.categories.find(c => c.key === this.activeCategory())!);
  activeSubItems = computed(() => this.subItems()[this.activeCategory()] || []);
  isSubItemsLoading = computed(() => this.subItemsLoading()[this.activeCategory()] || false);

  sortedSubItems = computed(() => {
    const items = this.activeSubItems();
    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, neutral: 3 };
    return [...items].sort((a, b) => {
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
      return b.count - a.count;
    });
  });

  withCounts = computed(() => this.sortedSubItems().filter(s => s.count > 0));
  zeroCounts = computed(() => this.sortedSubItems().filter(s => s.count === 0));

  detailColumns = computed(() => {
    const items = this.detailItems();
    if (items.length === 0) return [];
    return Object.keys(items[0]).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'Id');
  });

  detailTotalPages = computed(() => Math.max(1, Math.ceil(this.detailTotalCount() / this.detailPageSize)));

  countsKeys = computed(() => Object.keys(this.counts()));

  ngOnInit(): void {
    this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    try {
      const [alertResult, countResult] = await Promise.allSettled([
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-alert-counts')),
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-notification-counts')),
      ]);

      if (alertResult.status === 'fulfilled') {
        const alerts = Array.isArray(alertResult.value) ? alertResult.value : [];
        const wf = (alerts as any[]).find((a: any) => a.key === 'workflow-alert');
        const cf = (alerts as any[]).find((a: any) => a.key === 'configuration-alert');
        this.alertData.set({ workflow: Number(wf?.value) || 0, config: Number(cf?.value) || 0 });
      }

      if (countResult.status === 'fulfilled') {
        const raw: any = countResult.value;
        const newCounts: Record<string, number> = {};
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          Object.entries(raw).forEach(([k, v]) => {
            if (k !== 'totalCount' && k !== 'total') {
              newCounts[k] = typeof v === 'number' ? v : Number(v) || 0;
            }
          });
        }
        this.counts.set(newCounts);
      }
    } catch (e: any) {
      this.toast.error('Error loading dashboard: ' + (e?.message || ''));
    } finally {
      this.loading.set(false);
    }
    this.loadSubItems(this.activeCategory());
  }

  async refreshAll(): Promise<void> {
    this.counts.set({});
    this.subItems.set({});
    this.alertData.set({ workflow: 0, config: 0 });
    await this.loadDashboard();
  }

  selectCategory(key: string): void {
    this.activeCategory.set(key);
    this.expandedItem.set(null);
    this.detailItems.set([]);
    if (key === 'graphs') {
      this.loadChartData();
    } else {
      this.loadSubItems(key);
    }
  }

  async loadSubItems(categoryKey: string): Promise<void> {
    if (this.subItems()[categoryKey]) return;
    const endpoint = this.itemCountEndpoints[categoryKey];
    if (!endpoint) return;

    this.subItemsLoading.update(prev => ({ ...prev, [categoryKey]: true }));
    try {
      const data: any = await firstValueFrom(this.api.get(endpoint));
      const items = this.parseSubItems(data);
      this.subItems.update(prev => ({ ...prev, [categoryKey]: items }));
    } catch {
      this.subItems.update(prev => ({ ...prev, [categoryKey]: [] }));
    } finally {
      this.subItemsLoading.update(prev => ({ ...prev, [categoryKey]: false }));
    }
  }

  private parseSubItems(data: any): SubItem[] {
    if (!data || typeof data !== 'object') return [];
    const skipKeys = new Set(['totalCount', 'total', 'totalRecords']);
    return Object.entries(data)
      .filter(([key]) => !skipKeys.has(key))
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([key, value]) => {
        const count = typeof value === 'number' ? value : Number((value as any)?.count ?? (value as any)?.value ?? value) || 0;
        return {
          key, label: this.getFriendlyLabel(key), count,
          severity: this.getSeverity(key, count),
          endpoint: this.endpointMap[key],
        };
      });
  }

  async loadChartData(): Promise<void> {
    if (this.paymentByTypeData().length > 0 || this.debtChartData().length > 0 || this.meterChartData().length > 0) return;
    this.chartLoading.set(true);
    try {
      const [pbt, dc, mc, bc] = await Promise.allSettled([
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-billing-payment-by-type-of-use')),
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-debt-arrangement-summary-chart')),
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-meterreading-progress-chart')),
        firstValueFrom(this.api.get('/api/platinum/billing-dashboard/get-billing-dashboard-billing-cycles')),
      ]);
      if (pbt.status === 'fulfilled') {
        const rows = this.extractTableRows(pbt.value);
        this.paymentByTypeData.set(Array.isArray(pbt.value) ? pbt.value : rows);
      }
      if (dc.status === 'fulfilled') {
        const rows = this.extractTableRows(dc.value);
        this.debtChartData.set(rows.length > 0 ? rows : (dc.value ? [dc.value] : []));
      }
      if (mc.status === 'fulfilled') {
        const rows = this.extractTableRows(mc.value);
        this.meterChartData.set(rows.length > 0 ? rows : (mc.value ? [mc.value] : []));
      }
      if (bc.status === 'fulfilled') {
        const rows = this.extractTableRows(bc.value);
        this.billingCyclesData.set(rows.length > 0 ? rows : (bc.value ? [bc.value] : []));
      }
    } catch {
    } finally {
      this.chartLoading.set(false);
    }
  }

  getChartColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'Id');
  }

  formatChartCellValue(val: any, key: string): string {
    if (val === null || val === undefined) return '\u2014';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') {
      if (/amount|balance|total|value/i.test(key) && val % 1 !== 0) {
        return val.toLocaleString('en-ZA', { minimumFractionDigits: 2 });
      }
      return val.toLocaleString('en-ZA');
    }
    return String(val);
  }

  hasAnyChartData(): boolean {
    return this.paymentByTypeData().length > 0 || this.debtChartData().length > 0 || this.meterChartData().length > 0 || this.billingCyclesData().length > 0;
  }

  toggleSubItem(itemKey: string): void {
    if (this.expandedItem() === itemKey) {
      this.expandedItem.set(null);
      this.detailItems.set([]);
    } else {
      this.expandedItem.set(itemKey);
      const item = this.activeSubItems().find(s => s.key === itemKey);
      if (item?.endpoint) this.loadDetailTable(item.endpoint, 1);
    }
  }

  async loadDetailTable(endpoint: string, page: number): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailPage.set(page);
    try {
      const data: any = await firstValueFrom(this.api.post('/api/platinum/billing-dashboard/generic-table', {
        endpoint, page, pageSize: this.detailPageSize, orderby: null, shortDirection: null
      }));
      const rows = this.extractTableRows(data);
      this.detailItems.set(rows);
      this.detailTotalCount.set(data?.totalCount ?? data?.totalRecords ?? rows.length);
    } catch (e: any) {
      const msg = e?.message || 'Unknown error';
      this.detailError.set(msg.includes('500') ? 'This detail view is not available from the API' : msg);
    } finally {
      this.detailLoading.set(false);
    }
  }

  private extractTableRows(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    for (const k of ['items', 'value', 'results', 'data', 'rows']) {
      if (data[k] && Array.isArray(data[k])) return data[k];
    }
    return [];
  }

  getFriendlyLabel(key: string): string {
    if (this.friendlyLabels[key]) return this.friendlyLabels[key];
    return key.replace(/([A-Z])/g, ' $1').replace(/count$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  }

  getSeverity(key: string, count: number): 'critical' | 'warning' | 'info' | 'neutral' {
    if (count === 0) return 'neutral';
    const lower = key.toLowerCase();
    if (lower.includes('declined') || lower.includes('exception') || lower.includes('outstanding') || lower.includes('notsequenced')) return 'critical';
    if (lower.includes('awaiting') || lower.includes('pending') || lower.includes('notlinked') || lower.includes('notprocessed') || lower.includes('expired') || lower.includes('processhandovers')) return 'warning';
    return 'info';
  }

  getSeverityDotClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'dot-critical';
      case 'warning': return 'dot-warning';
      case 'info': return 'dot-info';
      default: return 'dot-neutral';
    }
  }

  getSeverityTextClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-critical';
      case 'warning': return 'text-warning';
      default: return '';
    }
  }

  getSeverityBadgeClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'count-badge-critical';
      case 'warning': return 'count-badge-warning';
      case 'info': return 'count-badge-info';
      default: return 'count-badge-neutral';
    }
  }

  isAmountColumn(key: string, val: any): boolean {
    return typeof val === 'number' && /amount|balance|total|value/i.test(key);
  }

  formatAmount(val: number): string {
    return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }

  formatCellValue(val: any, key: string): string {
    if (val === null || val === undefined) return '\u2014';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (this.isAmountColumn(key, val)) return this.formatAmount(val);
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  }

  toggleZeroCounts(): void {
    this.showZeroCounts.update(v => !v);
  }
}
