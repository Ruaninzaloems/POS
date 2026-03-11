import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CHANNEL_CONFIG, COMM_STATUS_CONFIG } from '../../../services/debt-config';
import type { CommunicationStats } from '../../../models/debt.models';

type TabMode = 'dashboard' | 'log' | 'scheduled' | 'send';

@Component({
  selector: 'app-communication-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communication-dashboard.component.html',
  styleUrl: './communication-dashboard.component.css'
})
export class CommunicationDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  tab = signal<TabMode>('dashboard');
  stats = signal<CommunicationStats | null>(null);
  statsLoading = signal(false);

  logs = signal<any[]>([]);
  logTotal = signal(0);
  logLoading = signal(false);
  logPage = signal(1);
  logChannel = signal('__all__');
  logStatus = signal('__all__');
  logAccount = signal('');
  logPageSize = 10;

  scheduled = signal<any[]>([]);
  schedTotal = signal(0);
  schedLoading = signal(false);
  schedPage = signal(1);
  schedStatus = signal('__all__');
  processing = signal(false);
  schedPageSize = 10;

  sendChannel = signal('sms');
  sendAccount = signal('');
  sendRecipient = signal('');
  sendSubject = signal('');
  sendMessage = signal('');
  sending = signal(false);
  accountSuggestions = signal<{ accountNo: string; name: string }[]>([]);
  showSuggestions = signal(false);

  logTotalPages = computed(() => Math.ceil(this.logTotal() / this.logPageSize) || 1);
  schedTotalPages = computed(() => Math.ceil(this.schedTotal() / this.schedPageSize) || 1);

  CHANNEL_CONFIG = CHANNEL_CONFIG;
  COMM_STATUS_CONFIG = COMM_STATUS_CONFIG;

  channelEntries = computed(() => {
    const s = this.stats();
    if (!s?.byChannel) return [];
    return Object.entries(s.byChannel).map(([ch, data]) => {
      const cfg = CHANNEL_CONFIG[ch] || CHANNEL_CONFIG['sms'];
      const total = data.sent + data.failed;
      const deliveryRate = total > 0 ? Math.round((data.delivered / total) * 100) : 0;
      return { ch, cfg, data, deliveryRate };
    });
  });

  recipientLabel = computed(() => {
    const ch = this.sendChannel();
    if (ch === 'email') return 'Email Address';
    if (ch === 'letter') return 'Postal Address';
    return 'Mobile Number';
  });

  recipientPlaceholder = computed(() => {
    const ch = this.sendChannel();
    if (ch === 'email') return 'user@example.com';
    if (ch === 'letter') return 'Postal address...';
    return '0821234567';
  });

  ngOnInit(): void {
    this.loadStats();
  }

  setTab(t: TabMode): void {
    this.tab.set(t);
    if (t === 'dashboard') this.loadStats();
    if (t === 'log') this.loadLogs();
    if (t === 'scheduled') this.loadScheduled();
  }

  async loadStats(): Promise<void> {
    this.statsLoading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<CommunicationStats>('/api/communications/stats'));
      this.stats.set(data);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to load stats');
    } finally {
      this.statsLoading.set(false);
    }
  }

  async loadLogs(): Promise<void> {
    this.logLoading.set(true);
    try {
      const params: Record<string, string> = {
        limit: String(this.logPageSize),
        offset: String((this.logPage() - 1) * this.logPageSize)
      };
      if (this.logChannel() !== '__all__') params['channel'] = this.logChannel();
      if (this.logStatus() !== '__all__') params['status'] = this.logStatus();
      if (this.logAccount().trim()) params['accountNo'] = this.logAccount().trim();
      const data = await firstValueFrom(this.api.get<any>('/api/communications/log', params));
      this.logs.set(data.logs || []);
      this.logTotal.set(data.total || 0);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to load communication log');
    } finally {
      this.logLoading.set(false);
    }
  }

  async loadScheduled(): Promise<void> {
    this.schedLoading.set(true);
    try {
      const params: Record<string, string> = {
        limit: String(this.schedPageSize),
        offset: String((this.schedPage() - 1) * this.schedPageSize)
      };
      if (this.schedStatus() !== '__all__') params['status'] = this.schedStatus();
      const data = await firstValueFrom(this.api.get<any>('/api/communications/scheduled', params));
      this.scheduled.set(data.scheduled || []);
      this.schedTotal.set(data.total || 0);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to load scheduled');
    } finally {
      this.schedLoading.set(false);
    }
  }

  async handleProcess(): Promise<void> {
    this.processing.set(true);
    try {
      const result = await firstValueFrom(this.api.post<any>('/api/communications/process-scheduled'));
      this.toast.success(`${result.processed} processed: ${result.succeeded} succeeded, ${result.failed} failed`);
      this.loadScheduled();
      this.loadStats();
    } catch (err: any) {
      this.toast.error(err?.message || 'Processing failed');
    } finally {
      this.processing.set(false);
    }
  }

  async handleAccountSearch(query: string): Promise<void> {
    this.sendAccount.set(query);
    if (query.length >= 3) {
      try {
        const results = await firstValueFrom(this.api.post<any>('/api/platinum/billing-payment/search-accounts', { searchText: query }));
        const raw = Array.isArray(results) ? results : results?.data || [];
        this.accountSuggestions.set(raw.slice(0, 8).map((a: any) => ({ accountNo: a.accountNo || a.AccountNo || '', name: a.name || a.Name || a.accountName || '' })));
        this.showSuggestions.set(true);
      } catch {
        this.accountSuggestions.set([]);
      }
    } else {
      this.accountSuggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  selectAccount(accountNo: string): void {
    this.sendAccount.set(accountNo);
    this.showSuggestions.set(false);
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  async handleSend(): Promise<void> {
    if (!this.sendAccount().trim() || !this.sendRecipient().trim() || !this.sendMessage().trim()) {
      this.toast.error('All fields required');
      return;
    }
    this.sending.set(true);
    try {
      await firstValueFrom(this.api.post<any>('/api/communications/dispatch', {
        accountNo: this.sendAccount().trim(),
        channel: this.sendChannel(),
        recipient: this.sendRecipient().trim(),
        subject: this.sendSubject().trim() || undefined,
        messageBody: this.sendMessage().trim()
      }));
      this.toast.success(`${this.sendChannel().toUpperCase()} dispatched to ${this.sendRecipient()}`);
      this.sendRecipient.set('');
      this.sendSubject.set('');
      this.sendMessage.set('');
    } catch (err: any) {
      this.toast.error(err?.message || 'Send failed');
    } finally {
      this.sending.set(false);
    }
  }

  onLogFilterChange(): void {
    this.logPage.set(1);
    this.loadLogs();
  }

  setLogPage(page: number): void {
    this.logPage.set(page);
    this.loadLogs();
  }

  onSchedFilterChange(): void {
    this.schedPage.set(1);
    this.loadScheduled();
  }

  setSchedPage(page: number): void {
    this.schedPage.set(page);
    this.loadScheduled();
  }

  getChannelLabel(ch: string): string {
    return CHANNEL_CONFIG[ch]?.label || ch;
  }

  getChannelClass(ch: string): string {
    const cfg = CHANNEL_CONFIG[ch] || CHANNEL_CONFIG['sms'];
    return `${cfg.bg} ${cfg.color}`;
  }

  getStatusClass(status: string): string {
    const cfg = COMM_STATUS_CONFIG[status] || COMM_STATUS_CONFIG['PENDING'];
    return `${cfg.bg} ${cfg.color}`;
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    } catch { return String(d); }
  }

  goHome(): void { this.router.navigate(['/']); }
}
