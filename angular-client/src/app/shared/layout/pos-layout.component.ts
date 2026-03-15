import { Component, signal, computed, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';

interface NavChild {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  label: string;
  icon: string;
  children: NavChild[];
}

type NavItem = NavChild | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

@Component({
  selector: 'app-pos-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './pos-layout.component.html',
  styleUrl: './pos-layout.component.css'
})
export class PosLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  expandedGroups = signal<Set<string>>(new Set(['Billing & Payments']));

  isSite02 = this.auth.isSite02;
  user = this.auth.user;
  site = this.auth.site;

  isGroup = isGroup;

  currentUrl = signal(this.router.url);

  breadcrumbs = computed(() => {
    const url = this.currentUrl();
    const segments = url.split('/').filter(s => s);
    const crumbs: { label: string; href?: string }[] = [];
    for (const nav of this.navItems) {
      if (isGroup(nav)) {
        for (const child of nav.children) {
          if (this.matchesUrl(child.href, url)) {
            crumbs.push({ label: nav.label });
            crumbs.push({ label: child.label });
            return crumbs;
          }
        }
      } else {
        if (this.matchesUrl(nav.href, url)) {
          crumbs.push({ label: nav.label });
          return crumbs;
        }
      }
    }
    if (segments.length > 0) {
      crumbs.push({ label: segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
    }
    return crumbs;
  });

  navItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: 'dashboard' },
    { label: 'POS Receipting', href: '/pos', icon: 'point_of_sale' },
    {
      label: 'Billing & Payments', icon: 'payments',
      children: [
        { label: 'Billing Dashboard', href: '/billing-dashboard', icon: 'bar_chart' },
        { label: 'Direct Deposits', href: '/direct-deposits/manual', icon: 'account_balance' },
        { label: 'Auto Allocation', href: '/direct-deposits/auto', icon: 'auto_fix_high' },
        { label: 'Third Party Payments', href: '/third-party/processing', icon: 'groups' },
        { label: 'Bulk Allocation', href: '/bulk-allocation', icon: 'upload_file' },
      ]
    },
    {
      label: 'Enquiries & Receipts', icon: 'search',
      children: [
        { label: 'General Enquiries', href: '/enquiries/general', icon: 'manage_search' },
        { label: 'View Receipts', href: '/view-receipts', icon: 'description' },
      ]
    },
    { label: 'Communications', href: '/communications', icon: 'forum' },
    { label: 'Supervisor', href: '/supervisor', icon: 'admin_panel_settings' },
    {
      label: 'Debt Management', icon: 'gavel',
      children: [
        { label: 'Section 129 Notices', href: '/debt/section129', icon: 'warning' },
        { label: 'Authorization', href: '/debt/section129/authorize', icon: 'verified' },
        { label: 'Configuration', href: '/debt/section129/config', icon: 'settings' },
        { label: 'Handover Management', href: '/debt/handover', icon: 'assignment_ind' },
        { label: 'Handover Termination', href: '/debt/handover/terminate', icon: 'cancel' },
        { label: 'Batch Processing', href: '/debt/batch-processing', icon: 'batch_prediction' },
        { label: 'Process Monitoring', href: '/debt/process-monitoring', icon: 'monitor_heart' },
        { label: 'Document Templates', href: '/debt/document-templates', icon: 'article' },
        { label: 'Digital Signatures', href: '/debt/digital-signatures', icon: 'draw' },
        { label: 'Process Engine', href: '/debt/process-engine', icon: 'engineering' },
      ]
    },
    {
      label: 'Reports', icon: 'assessment',
      children: [
        { label: 'Section 129 Report', href: '/debt/section129-report', icon: 'summarize' },
        { label: 'Handover Report', href: '/debt/handover-report', icon: 'summarize' },
        { label: 'SMS Log Report', href: '/debt/sms-log-report', icon: 'sms' },
        { label: 'Risk Scoring', href: '/debt/risk-scoring', icon: 'trending_up' },
        { label: 'Qualification Rules', href: '/debt/qualification-rules', icon: 'rule' },
        { label: 'Communication Timeline', href: '/debt/communication-timelines', icon: 'timeline' },
        { label: 'Comms Dashboard', href: '/debt/communication-dashboard', icon: 'dashboard' },
      ]
    },
    {
      label: 'Legal Compliance', icon: 'policy',
      children: [
        { label: 'Legal Rules', href: '/legal/rules', icon: 'gavel' },
        { label: 'Audit Trail', href: '/legal/audit-trail', icon: 'history' },
        { label: 'Evidence Bundle', href: '/legal/evidence-bundle', icon: 'folder_special' },
      ]
    },
    {
      label: 'Analytics', icon: 'insights',
      children: [
        { label: 'Executive Dashboard', href: '/analytics/executive-dashboard', icon: 'leaderboard' },
        { label: 'Predictive Forecasting', href: '/analytics/predictive-forecasting', icon: 'auto_graph' },
        { label: 'Geographic Mapping', href: '/analytics/geographic-mapping', icon: 'map' },
      ]
    },
  ];

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.currentUrl.set(e.urlAfterRedirects || e.url);
      this.mobileSidebarOpen.set(false);
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  toggleGroup(label: string): void {
    this.expandedGroups.update(groups => {
      const next = new Set(groups);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  onGroupClick(label: string): void {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
      this.expandedGroups.update(groups => {
        const next = new Set(groups);
        next.add(label);
        return next;
      });
    } else {
      this.toggleGroup(label);
    }
  }

  isGroupExpanded(label: string): boolean {
    return this.expandedGroups().has(label);
  }

  handleNav(event: Event, href: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.mobileSidebarOpen.set(false);
    this.router.navigate([href]);
  }

  navigateTo(href: string): void {
    this.router.navigate([href]);
  }

  matchesUrl(href: string, url?: string): boolean {
    const current = url || this.currentUrl();
    if (href === '/') return current === '/' || current === '';
    return current === href || current.startsWith(href + '/');
  }

  isActive(href: string): boolean {
    return this.matchesUrl(href);
  }

  isGroupActive(group: NavGroup): boolean {
    return group.children.some(c => this.matchesUrl(c.href));
  }

  async signOut(): Promise<void> {
    await this.auth.logout();
  }

  getUserInitial(): string {
    const u = this.user();
    return u?.firstName?.charAt(0)?.toUpperCase() || u?.userName?.charAt(0)?.toUpperCase() || 'U';
  }

  getUserDisplayName(): string {
    const u = this.user();
    if (u?.firstName && u?.lastName) return `${u.firstName} ${u.lastName}`;
    return u?.userName || 'User';
  }

  getMunicipalityName(): string {
    return this.isSite02() ? 'Inzalo EMS Site02' : 'George Municipality';
  }

  getFinancialPeriod(): string {
    const u = this.user();
    return u?.finYear || '2025/2026';
  }
}
