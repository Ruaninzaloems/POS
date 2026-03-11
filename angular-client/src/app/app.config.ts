import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error.interceptor';

class GlobalErrorHandler implements ErrorHandler {
  private chunkReloadAttempted = false;

  handleError(error: any): void {
    const message = error?.message || error?.toString() || '';
    if (message.includes('Failed to fetch dynamically imported module') || message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
      if (!this.chunkReloadAttempted) {
        this.chunkReloadAttempted = true;
        console.warn('[App] Stale chunk detected, reloading page...');
        window.location.reload();
        return;
      }
    }
    console.error('[App Error]', error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([errorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]
};
