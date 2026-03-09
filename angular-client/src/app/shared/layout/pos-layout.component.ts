import { Component, signal, computed, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  href?: string;
  icon: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-pos-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './pos-layout.component.html',
  styleUrl: './pos-layout.component.css'
})
export class PosLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  menuOpen = signal(false);
  expandedGroups = signal<Set<string>>(new Set());

  isSite02 = this.auth.isSite02;
  user = this.auth.user;
  site = this.auth.site;

  headerLogo = computed(() => this.site()?.logo || '/images/platinum-logo.png');
  siteName = computed(() => this.isSite02() ? 'Inzalo EMS' : 'SAMRAS Platinum');

  navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: 'home' },
    { label: 'POS', href: '/pos', icon: 'layers' },
    { label: 'Billing Dashboard', href: '/billing-dashboard', icon: 'bar-chart' },
    { label: 'Direct Deposits Manual', href: '/direct-deposits/manual', icon: 'banknote' },
    { label: 'Direct Deposits Auto', href: '/direct-deposits/auto', icon: 'refresh-cw' },
    {
      label: 'Third Party Payments', icon: 'users',
      children: [
        { label: 'Payment Processing', href: '/third-party/processing', icon: 'users' },
        { label: 'Utilipay Reconciliation', href: '/third-party', icon: 'zap' },
      ]
    },
    { label: 'Bulk Allocation', href: '/bulk-allocation', icon: 'file-bar-chart' },
    { label: 'View Receipts', href: '/view-receipts', icon: 'file-search' },
    {
      label: 'Enquiries', icon: 'search',
      children: [
        { label: 'General Enquiries', href: '/enquiries/general', icon: 'file-search' },
      ]
    },
    { label: 'Communications', href: '/communications', icon: 'message-square' },
    { label: 'Supervisor', href: '/supervisor', icon: 'shield-check' },
    {
      label: 'Debt Management', icon: 'landmark',
      children: [
        { label: 'Section 129 Notices', href: '/debt/section129', icon: 'file-warning' },
        { label: 'Section 129 Authorization', href: '/debt/section129/authorize', icon: 'shield-check' },
        { label: 'Handover Management', href: '/debt/handover', icon: 'briefcase' },
        { label: 'Handover Termination', href: '/debt/handover/terminate', icon: 'x-circle' },
        { label: 'Batch Processing', href: '/debt/batch-processing', icon: 'cog' },
        { label: 'Process Monitoring', href: '/debt/process-monitoring', icon: 'activity' },
        { label: 'Document Templates', href: '/debt/document-templates', icon: 'file-text' },
        { label: 'Digital Signatures', href: '/debt/digital-signatures', icon: 'pen-line' },
        { label: 'Process Engine', href: '/debt/process-engine', icon: 'workflow' },
      ]
    },
    {
      label: 'Reports', icon: 'bar-chart',
      children: [
        { label: 'Section 129 Config', href: '/debt/section129/config', icon: 'cog' },
        { label: 'Section 129 Report', href: '/debt/section129-report', icon: 'file-text' },
        { label: 'Handover Report', href: '/debt/handover-report', icon: 'file-text' },
        { label: 'SMS Log Report', href: '/debt/sms-log-report', icon: 'message-square' },
        { label: 'Risk Scoring', href: '/debt/risk-scoring', icon: 'activity' },
        { label: 'Qualification Rules', href: '/debt/qualification-rules', icon: 'file-text' },
        { label: 'Communication Timelines', href: '/debt/communication-timelines', icon: 'message-square' },
        { label: 'Communication Dashboard', href: '/debt/communication-dashboard', icon: 'bar-chart' },
      ]
    },
    {
      label: 'Legal Compliance', icon: 'shield-check',
      children: [
        { label: 'Legal Rules', href: '/legal/rules', icon: 'file-text' },
        { label: 'Audit Trail', href: '/legal/audit-trail', icon: 'file-search' },
        { label: 'Evidence Bundle', href: '/legal/evidence-bundle', icon: 'briefcase' },
      ]
    },
    {
      label: 'Analytics', icon: 'bar-chart',
      children: [
        { label: 'Executive Dashboard', href: '/analytics/executive-dashboard', icon: 'bar-chart' },
        { label: 'Predictive Forecasting', href: '/analytics/predictive-forecasting', icon: 'activity' },
        { label: 'Geographic Mapping', href: '/analytics/geographic-mapping', icon: 'map' },
      ]
    },
  ];

  constructor() {}

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  toggleGroup(label: string): void {
    this.expandedGroups.update(groups => {
      const newGroups = new Set(groups);
      if (newGroups.has(label)) {
        newGroups.delete(label);
      } else {
        newGroups.add(label);
      }
      return newGroups;
    });
  }

  isGroupExpanded(label: string): boolean {
    return this.expandedGroups().has(label);
  }

  navigateTo(href: string): void {
    this.menuOpen.set(false);
    this.router.navigate([href]);
  }

  isActive(href: string): boolean {
    const url = this.router.url;
    if (href === '/') return url === '/';
    return url === href || url.startsWith(href + '/');
  }

  async signOut(): Promise<void> {
    await this.auth.logout();
  }

  getUserInitial(): string {
    const u = this.user();
    return u?.firstName?.charAt(0) || u?.userName?.charAt(0) || 'U';
  }

  getUserDisplayName(): string {
    const u = this.user();
    if (u?.firstName && u?.lastName) return `${u.firstName} ${u.lastName}`;
    return u?.userName || 'User';
  }
}
