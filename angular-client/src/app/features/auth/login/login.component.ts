import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  selectedSite = 'george';
  loading = signal(false);
  error = signal('');
  sites = signal<any[]>([]);

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router
  ) {
    this.loadSites();
  }

  async loadSites(): Promise<void> {
    try {
      const data = await firstValueFrom(this.api.get<any[]>('/api/sites'));
      this.sites.set(data || []);
    } catch {
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.username.trim()) {
      this.error.set('Username is required');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const result = await this.auth.login(this.username, this.password, this.selectedSite);
    this.loading.set(false);
    if (result.success) {
      this.router.navigate(['/']);
    } else {
      this.error.set(result.error || 'Login failed');
    }
  }
}
