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
    { label: 'POS Receipting', route: '/pos', icon: 'layers', desc: 'Process payments and issue receipts' },
    { label: 'Cashier Setup', route: '/cashier-setup', icon: 'settings', desc: 'Start or manage your cashier session' },
    { label: 'View Receipts', route: '/view-receipts', icon: 'file-search', desc: 'Search and reprint receipts' },
    { label: 'Billing Dashboard', route: '/billing-dashboard', icon: 'bar-chart', desc: 'View billing statistics' },
    { label: 'General Enquiries', route: '/enquiries/general', icon: 'search', desc: 'Look up account details' },
    { label: 'Direct Deposits', route: '/direct-deposits/manual', icon: 'banknote', desc: 'Allocate EFT payments' },
    { label: 'Supervisor', route: '/supervisor', icon: 'shield', desc: 'Review cashier submissions' },
    { label: 'Debt Management', route: '/debt/section129', icon: 'landmark', desc: 'Section 129 and debt recovery' },
  ];

  constructor() {}

  navigate(route: string): void {
    this.router.navigate([route]);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
