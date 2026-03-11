import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { getFinancialYearList } from '../../../services/format.service';

@Component({
  selector: 'app-section129-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './section129-report.component.html',
  styleUrl: './section129-report.component.css'
})
export class Section129ReportComponent implements OnInit {
  finYear: string;
  finMonth = '__all__';
  billingCycle = '__all__';
  accountNo = '';
  ageing = '';
  amountGreaterThan = '0';

  billingCycles: { id: string; name: string }[] = [];
  ageingRanges: { id: string; name: string }[] = [];
  accountSuggestions: { accountNo: string; name: string }[] = [];
  showSuggestions = false;

  results: any[] = [];
  loading = signal(false);
  searched = false;
  gridPage = 1;
  gridPageSize = 10;

  finYears: string[] = [];
  months = [
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  ];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    this.finYear = `${year - 1}/${year}`;
    this.finYears = getFinancialYearList(5);
  }

  ngOnInit(): void {
    firstValueFrom(this.api.get('/api/platinum/billing-debt/billing-cycles')).then(d => this.billingCycles = d || []).catch(() => {});
    firstValueFrom(this.api.get('/api/platinum/billing-debt/ageing-ranges')).then(d => this.ageingRanges = d || []).catch(() => {});
  }

  get resultColumns(): string[] {
    if (this.results.length === 0) return [];
    return Object.keys(this.results[0]).filter(k => !k.startsWith('_'));
  }

  get paginatedResults(): any[] {
    return this.results.slice((this.gridPage - 1) * this.gridPageSize, this.gridPage * this.gridPageSize);
  }

  get totalGridPages(): number {
    return Math.ceil(this.results.length / this.gridPageSize);
  }

  formatColumnHeader(col: string): string {
    return col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  async handleAccountSearch(query: string): Promise<void> {
    this.accountNo = query;
    if (query.length >= 3) {
      try {
        const accounts = await firstValueFrom(this.api.post('/api/platinum/billing-payment/search-accounts', { searchText: query }));
        this.accountSuggestions = (Array.isArray(accounts) ? accounts : []).slice(0, 10).map((a: any) => ({
          accountNo: a.accountNo || a.accountID?.toString() || '',
          name: a.name || a.accountName || '',
        }));
        this.showSuggestions = true;
      } catch {
        this.accountSuggestions = [];
      }
    } else {
      this.accountSuggestions = [];
      this.showSuggestions = false;
    }
  }

  selectSuggestion(accountNo: string): void {
    this.accountNo = accountNo;
    this.showSuggestions = false;
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions = false, 200);
  }

  async handleSubmit(): Promise<void> {
    const amt = parseInt(this.amountGreaterThan, 10);
    if (isNaN(amt) || amt < 0) {
      this.toast.show('Amount Greater Than must be a non-negative integer.', 'error');
      return;
    }
    this.loading.set(true);
    this.searched = true;
    this.gridPage = 1;
    try {
      const params: any = {
        finYear: this.finYear,
      };
      if (this.finMonth !== '__all__') params.finMonth = this.finMonth;
      if (this.billingCycle !== '__all__') params.billingCycle = this.billingCycle;
      if (this.accountNo) params.accountNo = this.accountNo;
      if (this.ageing) params.ageing = this.ageing;
      params.amountGreaterThan = String(amt);

      const data = await firstValueFrom(this.api.get('/api/platinum/billing-debt/section129-report', params));
      this.results = Array.isArray(data) ? data : [];
    } catch (err: any) {
      this.toast.show(err?.error?.message || err?.message || 'Failed to fetch Section 129 report.', 'error');
      this.results = [];
    } finally {
      this.loading.set(false);
    }
  }

  handleClear(): void {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    this.finYear = `${year - 1}/${year}`;
    this.finMonth = '__all__';
    this.billingCycle = '__all__';
    this.accountNo = '';
    this.ageing = '';
    this.amountGreaterThan = '0';
    this.results = [];
    this.searched = false;
    this.gridPage = 1;
  }

  handleCancel(): void {
    this.router.navigate(['/']);
  }

  prevPage(): void {
    if (this.gridPage > 1) this.gridPage--;
  }

  nextPage(): void {
    if (this.gridPage < this.totalGridPages) this.gridPage++;
  }
}
