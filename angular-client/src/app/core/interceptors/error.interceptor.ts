import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/auth/')) {
        router.navigate(['/login']);
      } else if (error.status === 0) {
        toast.error('Network error — unable to reach the server');
      } else if (error.status >= 500) {
        const msg = error.error?.message || error.error?.detail || 'Server error';
        toast.error(msg);
      }
      return throwError(() => error);
    })
  );
};
