import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { CashierSetupComponent } from '../cashier/cashier-setup.component';
import { PosComponent } from './pos.component';
import { CashierDayEndComponent } from '../cashier/cashier-day-end.component';

type WorkflowTab = 'setup' | 'transact' | 'day-end';

@Component({
  selector: 'app-pos-workflow',
  standalone: true,
  imports: [CommonModule, CashierSetupComponent, PosComponent, CashierDayEndComponent],
  templateUrl: './pos-workflow.component.html',
  styleUrl: './pos-workflow.component.css'
})
export class PosWorkflowComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  activeTab = signal<WorkflowTab>('setup');
  sessionReady = signal(false);
  checkingSession = signal(true);

  user = this.auth.user;

  canAccessTransact = computed(() => this.sessionReady());
  canAccessDayEnd = computed(() => this.sessionReady());

  ngOnInit(): void {
    this.checkExistingSession();
  }

  async checkExistingSession(): Promise<void> {
    this.checkingSession.set(true);
    try {
      const userId = this.user()?.user_ID;
      if (!userId) {
        this.checkingSession.set(false);
        return;
      }

      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/receipt-prepaid/active-cashier-details', {
          userId: String(userId)
        })
      ).catch(() => null);

      if (!data || data._error) {
        return;
      }

      const isActive = data.isActive === true;
      const hasPendingDayEnd = data.hasPendingDayEnd === true;
      const hasDayEndReturned = data.hasDayEndReturned === true;

      if ((isActive || hasDayEndReturned) && !hasPendingDayEnd) {
        this.sessionReady.set(true);
        this.activeTab.set('transact');
      }
    } catch {
    } finally {
      this.checkingSession.set(false);
    }
  }

  onSessionStarted(): void {
    this.sessionReady.set(true);
    this.activeTab.set('transact');
  }

  setTab(tab: WorkflowTab): void {
    if (tab === 'transact' && !this.canAccessTransact()) return;
    if (tab === 'day-end' && !this.canAccessDayEnd()) return;
    this.activeTab.set(tab);
  }

  getTabNumber(tab: WorkflowTab): number {
    switch (tab) {
      case 'setup': return 1;
      case 'transact': return 2;
      case 'day-end': return 3;
    }
  }

  isTabComplete(tab: WorkflowTab): boolean {
    if (tab === 'setup') return this.sessionReady();
    return false;
  }
}
