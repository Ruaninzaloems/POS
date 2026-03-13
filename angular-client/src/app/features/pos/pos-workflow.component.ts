import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
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
export class PosWorkflowComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  activeTab = signal<WorkflowTab>('setup');
  sessionReady = signal(false);
  checkingSession = signal(true);
  sessionActive = signal(false);
  needsReconcile = signal(false);
  reconcileMessage = signal('');
  sessionStatusMessage = signal('');

  user = this.auth.user;

  canAccessSetup = computed(() => !this.sessionActive() && !this.needsReconcile());
  canAccessTransact = computed(() => this.sessionReady() && !this.needsReconcile());
  canAccessDayEnd = computed(() => this.sessionReady() || this.needsReconcile());

  ngOnInit(): void {
    this.resetWorkflowState();
    this.checkExistingSession();
  }

  ngOnDestroy(): void {
    this.resetWorkflowState();
  }

  private resetWorkflowState(): void {
    this.activeTab.set('setup');
    this.sessionReady.set(false);
    this.checkingSession.set(true);
    this.sessionActive.set(false);
    this.needsReconcile.set(false);
    this.reconcileMessage.set('');
    this.sessionStatusMessage.set('');
  }

  async checkExistingSession(): Promise<void> {
    this.checkingSession.set(true);
    try {
      const userId = this.user()?.user_ID;
      const finYear = this.user()?.finYear || '';
      if (!userId) {
        this.checkingSession.set(false);
        return;
      }

      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/auth/active-cashier-by-userid', {
          userid: String(userId),
          finYear
        })
      ).catch(() => null);

      if (!data || data._error) {
        return;
      }

      const isActive = data.isActive === true;
      const hasPendingDayEnd = data.hasPendingDayEnd === true;
      const hasDayEndReturned = data.hasDayEndReturned === true;
      const cashierId = data.cashierId || data.details?.id;

      if (hasDayEndReturned) {
        this.sessionReady.set(true);
        this.sessionActive.set(true);
        this.activeTab.set('transact');
        return;
      }

      if (hasPendingDayEnd) {
        this.sessionReady.set(true);
        this.sessionActive.set(true);
        this.sessionStatusMessage.set('Day-end pending supervisor approval');
        this.activeTab.set('transact');
        return;
      }

      if (isActive && data.officeId) {
        if (cashierId) {
          try {
            const reconCheck: any = await firstValueFrom(
              this.api.get('/api/platinum/receipt-prepaid/validate-cashier-day-end-recon', {
                cashierId: String(cashierId),
                finYear
              })
            );

            if (typeof reconCheck === 'string') {
              if (reconCheck.toLowerCase().includes('reconcile')) {
                this.sessionReady.set(true);
                this.sessionActive.set(true);
                this.needsReconcile.set(true);
                this.reconcileMessage.set(reconCheck);
                this.activeTab.set('day-end');
                return;
              }
            } else if (reconCheck && !reconCheck._error) {
              const reconMsg = reconCheck.message || reconCheck.msg || reconCheck.validationMessage || '';
              const reconNeed = reconCheck.needsReconcile === true
                || reconCheck.requiresReconcile === true
                || reconCheck.isValid === false
                || (typeof reconMsg === 'string' && reconMsg.toLowerCase().includes('reconcile'));

              if (reconNeed) {
                this.sessionReady.set(true);
                this.sessionActive.set(true);
                this.needsReconcile.set(true);
                this.reconcileMessage.set(reconMsg || 'You need to submit your day-end reconciliation before you can process transactions.');
                this.activeTab.set('day-end');
                return;
              }
            }
          } catch {
            console.warn('[pos-workflow] validate-day-end-recon API error — treating as no reconciliation needed');
          }
        }

        this.sessionReady.set(true);
        this.sessionActive.set(true);
        this.activeTab.set('transact');
      }
    } catch {
    } finally {
      this.checkingSession.set(false);
    }
  }

  onSessionStarted(): void {
    this.sessionReady.set(true);
    this.sessionActive.set(true);
    this.activeTab.set('transact');
  }

  goToDayEnd(): void {
    this.activeTab.set('day-end');
  }

  setTab(tab: WorkflowTab): void {
    if (tab === 'setup' && !this.canAccessSetup()) return;
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
