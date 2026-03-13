import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

const SILENT_URL_PATTERNS = [
  '/api/platinum/billing-enquiry/',
  '/api/platinum/billing/account-management/',
  '/api/platinum/supervisor/',
  '/api/platinum/receipt-prepaid/validate-cashier-day-end-recon',
  '/api/platinum/billing-payment/search-accounts',
  '/api/platinum/billing-payment/search-account-groups',
  '/api/platinum/billing-payment-miscellaneous/',
  '/api/platinum/billing-payment/save-multiple-account-payment',
  '/api/platinum/direct-deposit-allocation/get-account-autocomplete',
  '/api/platinum/direct-deposit-allocation/get-old-account-autocomplete',
  '/api/platinum/direct-deposit-allocation/get-clearance-autocomplete',
  '/api/platinum/direct-deposit-allocation/get-pos-item-details',
  '/api/platinum/direct-deposit-allocation/create-virtual-session',
  '/api/dd-allocation/active-job',
  '/api/dd-allocation/job/',
];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isSilent = SILENT_URL_PATTERNS.some(p => req.url.includes(p));

      if (error.status === 401 && !req.url.includes('/api/auth/')) {
        router.navigate(['/login']);
      } else if (error.status === 0) {
        toast.error('Network error — unable to reach the server');
      } else if (error.status >= 500 && !isSilent) {
        const msg = error.error?.message || error.error?.detail || 'Server error';
        toast.error(msg);
      }
      return throwError(() => error);
    })
  );
};
