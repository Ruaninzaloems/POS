import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  loading = signal(false);
  error = signal('');
  data = signal<any>(null);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      // Data loading from Platinum API will be implemented here
      this.loading.set(false);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load data');
      this.loading.set(false);
    }
  }
}
