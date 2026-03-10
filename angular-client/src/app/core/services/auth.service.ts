import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  user_ID: number;
  userName: string;
  firstName: string;
  lastName: string;
  eMail: string;
  enabled: boolean;
  superUser: boolean;
  cashFloat: number;
  finYear: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  logo: string;
  themeClass: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AuthUser | null>(null);
  private _site = signal<SiteInfo | null>(null);
  private _authenticated = signal(false);
  private _checked = signal(false);

  user = this._user.asReadonly();
  site = this._site.asReadonly();
  authenticated = this._authenticated.asReadonly();
  checked = this._checked.asReadonly();
  isSite02 = computed(() => this._site()?.id === 'site02');

  constructor(private api: ApiService, private router: Router) {}

  async checkAuth(): Promise<boolean> {
    try {
      const data: any = await firstValueFrom(this.api.get('/api/auth/status'));
      if (data.authenticated) {
        this._user.set(data.user);
        this._site.set(data.site);
        this._authenticated.set(true);
        this.applyTheme(data.site?.themeClass || '');
      } else {
        this._authenticated.set(false);
      }
    } catch {
      this._authenticated.set(false);
    }
    this._checked.set(true);
    return this._authenticated();
  }

  async login(username: string, password: string, siteId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const data: any = await firstValueFrom(
        this.api.post('/api/auth/login', { username, password, siteId })
      );
      if (data.success) {
        this._user.set(data.user);
        this._site.set(data.site);
        this._authenticated.set(true);
        this.applyTheme(data.site?.themeClass || '');
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (e: any) {
      const msg = e?.error?.error || e?.message || 'Login failed';
      return { success: false, error: msg };
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/auth/logout'));
    } catch {
    }
    this._user.set(null);
    this._site.set(null);
    this._authenticated.set(false);
    this.applyTheme('');
    this.router.navigate(['/login']);
  }

  private applyTheme(themeClass: string): void {
    const root = document.documentElement;
    root.classList.remove('theme-site02');
    if (themeClass) {
      root.classList.add(themeClass);
    }
  }
}
