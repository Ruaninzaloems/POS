import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;
  site = this.auth.site;

  quickLinks = [
    { label: 'POS Receipting', route: '/pos', icon: 'point_of_sale', desc: 'Setup, transact and day-end reconciliation', color: 'blue' },
    { label: 'View Receipts', route: '/view-receipts', icon: 'description', desc: 'Search and reprint receipts', color: 'purple' },
    { label: 'Billing Dashboard', route: '/billing-dashboard', icon: 'bar_chart', desc: 'View billing statistics & alerts', color: 'amber' },
    { label: 'General Enquiries', route: '/enquiries/general', icon: 'manage_search', desc: 'Look up account details', color: 'indigo' },
    { label: 'Direct Deposits', route: '/direct-deposits/manual', icon: 'account_balance', desc: 'Allocate EFT payments', color: 'teal' },
    { label: 'Communications', route: '/communications', icon: 'forum', desc: 'Client communications', color: 'blue' },
    { label: 'Supervisor', route: '/supervisor', icon: 'admin_panel_settings', desc: 'Review cashier submissions', color: 'red' },
    { label: 'Debt Management', route: '/debt/section129', icon: 'gavel', desc: 'Section 129 and debt recovery', color: 'purple' },
  ];

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getIconBg(color: string): string {
    const map: Record<string, string> = {
      blue: '#e3f2fd', teal: '#e0f2f1', green: '#e8f5e9', purple: '#ede7f6',
      amber: '#fff8e1', indigo: '#e8eaf6', red: '#ffebee'
    };
    return map[color] || '#e3f2fd';
  }

  getIconColor(color: string): string {
    const map: Record<string, string> = {
      blue: '#42a5f5', teal: '#26a69a', green: '#4caf50', purple: '#7e57c2',
      amber: '#f59e0b', indigo: '#5c6bc0', red: '#ef5350'
    };
    return map[color] || '#42a5f5';
  }
}
