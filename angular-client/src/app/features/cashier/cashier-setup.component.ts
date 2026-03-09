import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

type StepStatus = 'pending' | 'loading' | 'success' | 'error';

interface CashOffice {
  cashOffice_ID: number;
  cashOfficeDesc: string | null;
  cashOnHandLimit: number | null;
  vote1: string | null;
  vote: string | null;
  vote_ID: number | null;
  voteDesc: string | null;
}

interface PaymentOption {
  posPaymentOption_ID: number;
  posPaymentOptionDesc: string;
  isTicked: boolean;
  enabled: boolean;
}

interface PaymentType {
  posPaymentType_ID: number;
  posPaymentTypeDesc: string;
  isTicked: boolean;
  enabled: boolean;
}

@Component({
  selector: 'app-cashier-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cashier-setup.component.html',
  styleUrl: './cashier-setup.component.css'
})
export class CashierSetupComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  step1Status = signal<StepStatus>('pending');
  step2Status = signal<StepStatus>('pending');
  step3Status = signal<StepStatus>('pending');

  isCashierRegistered = signal<boolean | null>(null);
  cashierId = signal<number | null>(null);
  cashierDetails = signal<any>(null);

  floatInput = signal('0.00');
  selectedOfficeId = signal('');
  defaultOfficeId = signal('');
  error = signal('');
  submitting = signal(false);
  sessionLoading = signal(true);

  cashOffices = signal<CashOffice[]>([]);
  paymentOptions = signal<PaymentOption[]>([]);
  paymentTypes = signal<PaymentType[]>([]);
  paymentOptionsSource = signal('');
  paymentTypesSource = signal('');
  receiptRangeStatus = signal<any>(null);
  configLoading = signal(false);
  configError = signal('');

  resumingSession = signal(false);
  dayEndPending = signal(false);
  dayEndCompleted = signal(false);
  setupComplete = signal(false);
  existingCashierId = signal<number | null>(null);

  user = this.auth.user;

  firstName = computed(() => this.user()?.firstName || '');
  lastName = computed(() => this.user()?.lastName || '');
  userId = computed(() => this.user()?.user_ID || 0);
  finYear = computed(() => this.user()?.finYear || '');

  selectedOffice = computed(() =>
    this.cashOffices().find(o => String(o.cashOffice_ID) === this.selectedOfficeId())
  );

  scoaCode = computed(() => {
    const office = this.selectedOffice();
    return office?.vote || office?.vote1 || office?.voteDesc || null;
  });

  hasValidVote = computed(() => !!(this.scoaCode() && this.selectedOffice()?.vote_ID));
  ledgerVoteDisplay = computed(() => this.scoaCode() || '');
  isNonDefaultOffice = computed(() => {
    const def = this.defaultOfficeId();
    return def !== '' && this.selectedOfficeId() !== def;
  });

  enabledOptionsCount = computed(() => this.paymentOptions().filter(o => o.isTicked && o.enabled).length);
  enabledTypesCount = computed(() => this.paymentTypes().filter(t => t.isTicked && t.enabled).length);

  ngOnInit(): void {
    this.runSetupFlow();
  }

  async runSetupFlow(): Promise<void> {
    this.sessionLoading.set(true);
    this.step1Status.set('loading');
    this.step2Status.set('pending');
    this.error.set('');

    const userId = this.userId();
    const finYear = this.finYear();

    if (!userId) {
      this.error.set('Could not determine user ID. Please refresh.');
      this.sessionLoading.set(false);
      return;
    }

    try {
      const data: any = await firstValueFrom(
        this.api.get('/api/platinum/receipt-prepaid/validate-cashier', {
          userId: String(userId),
          finYear: finYear
        })
      );

      if (data.cashierRegistered === true) {
        this.isCashierRegistered.set(true);
        this.cashierId.set(data.cashierId || userId);
        this.cashierDetails.set(data.details || null);
        this.step1Status.set('success');

        const existingId = data.details?.id || data.cashierId || null;
        if (existingId) {
          this.existingCashierId.set(existingId);
        }

        if (data.isActive === true && data.officeId) {
          const pendingFromApi = data.hasPendingDayEnd === true;
          if (pendingFromApi) {
            this.dayEndPending.set(true);
            this.resumingSession.set(false);
            this.step2Status.set('success');
          } else {
            this.resumingSession.set(true);
            this.step2Status.set('success');
            this.step3Status.set('pending');
          }
        }

        const currentOfficeId = data.officeId || data.details?.officeId;
        if (currentOfficeId) {
          this.selectedOfficeId.set(String(currentOfficeId));
          this.defaultOfficeId.set(String(currentOfficeId));
        }

        if (data.cashFloat != null && data.cashFloat > 0) {
          this.floatInput.set(String(data.cashFloat));
        } else if (this.user()?.cashFloat && this.user()!.cashFloat > 0) {
          this.floatInput.set(String(this.user()!.cashFloat));
        }
      } else {
        this.isCashierRegistered.set(false);
        this.step1Status.set('error');
        this.sessionLoading.set(false);
        return;
      }
    } catch (e: any) {
      this.isCashierRegistered.set(false);
      this.step1Status.set('error');
      this.error.set('Unable to connect to the billing system. Please try again later.');
      this.sessionLoading.set(false);
      return;
    }

    this.step2Status.set('loading');
    try {
      const offices: any = await firstValueFrom(
        this.api.get('/api/platinum/receipt-prepaid/cash-offices', { finYear: finYear })
      );
      const officeList = Array.isArray(offices) ? offices : offices?.data || [];
      if (officeList.length > 0) {
        this.cashOffices.set(officeList);
        this.step2Status.set('success');
      } else {
        this.cashOffices.set([]);
        this.step2Status.set('error');
        this.error.set('No cash offices found. Please contact your administrator.');
      }
    } catch (e: any) {
      this.step2Status.set('error');
      this.error.set('Failed to load cash offices. Please try again.');
    }

    this.sessionLoading.set(false);

    if (this.isCashierRegistered() && this.selectedOfficeId()) {
      this.loadCashierConfig();
    }
  }

  async loadCashierConfig(): Promise<void> {
    const cashierId = this.cashierId();
    const officeId = Number(this.selectedOfficeId());
    const userId = this.userId();
    if (!cashierId || !officeId || !userId) return;

    this.configLoading.set(true);
    this.configError.set('');

    try {
      const [optionsResult, typesResult, rangeResult]: any[] = await Promise.all([
        firstValueFrom(this.api.get('/api/platinum/receipt-prepaid/cashier-payment-options', {
          userId: String(userId), cashofficeId: String(officeId), cashierId: String(cashierId)
        })),
        firstValueFrom(this.api.get('/api/platinum/receipt-prepaid/cashier-payment-types', {
          userId: String(userId), cashofficeId: String(officeId), cashierId: String(cashierId)
        })),
        firstValueFrom(this.api.get('/api/platinum/receipt-prepaid/validate-receipt-range', {
          userId: String(userId), cashierId: String(cashierId), finYear: this.finYear(), officeId: String(officeId)
        })),
      ]);

      const optionsArr = optionsResult?.data || (Array.isArray(optionsResult) ? optionsResult : []);
      this.paymentOptions.set(optionsArr.map((o: any) => ({
        posPaymentOption_ID: o.posPaymentOption_ID || o.paymentOptionId || o.id || 0,
        posPaymentOptionDesc: o.posPaymentOptionDesc || o.description || o.name || '',
        isTicked: o.isTicked ?? o.tickedFlag ?? true,
        enabled: o.enabled ?? true,
      })));
      this.paymentOptionsSource.set(optionsResult?.source || 'platinum');

      const typesArr = typesResult?.data || (Array.isArray(typesResult) ? typesResult : []);
      this.paymentTypes.set(typesArr.map((t: any) => ({
        posPaymentType_ID: t.posPaymentType_ID || t.paymentTypeId || t.id || 0,
        posPaymentTypeDesc: t.posPaymentTypeDesc || t.description || t.name || '',
        isTicked: t.isTicked ?? t.tickedFlag ?? true,
        enabled: t.enabled ?? true,
      })));
      this.paymentTypesSource.set(typesResult?.source || 'platinum');

      this.receiptRangeStatus.set(rangeResult);
    } catch (e: any) {
      this.configError.set('Failed to load cashier configuration. Click Retry to try again.');
    } finally {
      this.configLoading.set(false);
    }
  }

  onOfficeChange(): void {
    if (this.isCashierRegistered() && this.selectedOfficeId()) {
      this.loadCashierConfig();
    }
  }

  async handleSubmit(): Promise<void> {
    this.error.set('');

    if (this.dayEndPending()) {
      this.error.set('Your day-end reconciliation is pending supervisor approval.');
      return;
    }
    if (this.resumingSession()) {
      this.error.set('An active session already exists. Use "Resume Session" above to continue, or submit Day-End reconciliation to close the current session.');
      return;
    }
    if (!this.selectedOffice()) {
      this.error.set('Please select a cash office.');
      return;
    }

    const float = parseFloat(this.floatInput());
    if (isNaN(float) || float < 0) {
      this.error.set('Cash float must be a valid number.');
      return;
    }

    this.submitting.set(true);
    this.step3Status.set('loading');

    try {
      const payload = {
        id: 0,
        user_Id: this.userId(),
        cashFloat: float,
        stpPort: null,
        plesseyPort: null,
        officeId: this.selectedOffice()!.cashOffice_ID,
        isVirtual: false,
      };

      const responseData: any = await firstValueFrom(
        this.api.post('/api/platinum/receipt-prepaid/submit-cashier-setup', payload)
      );

      const apiMessage = (responseData?.message || '').trim();
      const cleanMessage = apiMessage.replace(/<br\s*\/?>\s*•?\s*/gi, '\n').trim();
      const isAlreadyOpen = /cashier already open/i.test(cleanMessage);
      const isSuccess = /cashier setup added/i.test(cleanMessage);
      const isValidationError = !isSuccess && !isAlreadyOpen && cleanMessage.length > 0;

      if (isAlreadyOpen) {
        if (!responseData?.cashier?.id) {
          throw new Error('A session is already open but no session ID was returned. Please contact your supervisor.');
        }
        const reclaimPayload = {
          id: responseData.cashier.id,
          cashFloat: float,
          officeId: this.selectedOffice()!.cashOffice_ID,
          isVirtual: false,
        };
        const reclaimResponse: any = await firstValueFrom(
          this.api.post('/api/platinum/receipt-prepaid/submit-cashier-setup', reclaimPayload)
        );
        const reclaimMsg = (reclaimResponse?.message || '').trim();
        if (reclaimResponse?.cashier?.isActive === true || /reclaimed/i.test(reclaimMsg)) {
          this.existingCashierId.set(reclaimResponse.cashier?.id || responseData.cashier.id);
          this.step3Status.set('success');
          this.setupComplete.set(true);
          this.toast.success('Existing session reclaimed successfully.');
          this.router.navigate(['/pos']);
          return;
        } else {
          throw new Error(reclaimMsg || 'Failed to reclaim existing session.');
        }
      } else if (isValidationError) {
        throw new Error(cleanMessage);
      }

      if (responseData?.cashier?.id) {
        this.existingCashierId.set(responseData.cashier.id);
      }

      this.step3Status.set('success');
      this.setupComplete.set(true);
      this.toast.success('Cashier session started successfully.');
      this.router.navigate(['/pos']);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      this.error.set(msg.startsWith('Failed to start') ? msg : `Failed to start session: ${msg}`);
      this.step3Status.set('error');
    } finally {
      this.submitting.set(false);
    }
  }

  async handleResumeSession(): Promise<void> {
    const existingId = this.existingCashierId();
    if (!existingId) {
      this.toast.success('Session resumed.');
      this.router.navigate(['/pos']);
      return;
    }

    this.error.set('');
    this.submitting.set(true);
    this.step3Status.set('loading');

    try {
      const float = parseFloat(this.floatInput()) || 0;
      const officeId = Number(this.selectedOfficeId()) || this.cashierDetails()?.officeId || 0;

      const reclaimPayload = {
        id: existingId,
        cashFloat: float,
        officeId: officeId,
        isVirtual: false,
      };

      const responseData: any = await firstValueFrom(
        this.api.post('/api/platinum/receipt-prepaid/submit-cashier-setup', reclaimPayload)
      );

      const apiMessage = (responseData?.message || '').trim();
      const isReclaimed = /reclaimed/i.test(apiMessage) || responseData?.cashier?.isActive === true;

      if (isReclaimed) {
        this.step3Status.set('success');
        this.setupComplete.set(true);
        this.toast.success('Session reclaimed successfully.');
        this.router.navigate(['/pos']);
      } else {
        const cleanMessage = apiMessage.replace(/<br\s*\/?>\s*•?\s*/gi, '\n').trim();
        throw new Error(cleanMessage || 'Failed to reclaim session.');
      }
    } catch (err: any) {
      this.error.set(`Failed to resume session: ${err?.message || 'Unknown error'}`);
      this.step3Status.set('error');
    } finally {
      this.submitting.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  getStepClass(status: StepStatus): string {
    switch (status) {
      case 'loading': return 'step-loading';
      case 'success': return 'step-success';
      case 'error': return 'step-error';
      default: return 'step-pending';
    }
  }
}
