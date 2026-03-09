import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error.interceptor';

class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('[App Error]', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]
};
