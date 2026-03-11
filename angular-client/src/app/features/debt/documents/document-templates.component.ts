import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TEMPLATE_CATEGORIES } from '../../../services/debt-config';
import { formatDate, formatFileSize } from '../../../services/format.service';
import type { DocumentTemplate, TemplateVersion } from '../../../models/debt.models';

@Component({
  selector: 'app-document-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-templates.component.html',
  styleUrl: './document-templates.component.css'
})
export class DocumentTemplatesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(true);
  templates = signal<DocumentTemplate[]>([]);
  filterCategory = signal('ALL');
  searchText = signal('');

  showCreateDialog = signal(false);
  showEditDialog = signal(false);
  showVersionsDialog = signal(false);
  showUploadDialog = signal(false);
  saving = signal(false);

  editTemplate = signal<DocumentTemplate | null>(null);
  versionTemplate = signal<DocumentTemplate | null>(null);
  versions = signal<TemplateVersion[]>([]);
  loadingVersions = signal(false);

  formName = signal('');
  formCode = signal('');
  formCategory = signal('SECTION_129');
  formDescription = signal('');
  formActive = signal(true);

  uploadVersion = signal('');
  uploadNotes = signal('');
  uploadFileName = signal('');

  TEMPLATE_CATEGORIES = TEMPLATE_CATEGORIES;

  filtered = computed(() => {
    return this.templates().filter(t => {
      if (this.filterCategory() !== 'ALL' && t.category !== this.filterCategory()) return false;
      if (this.searchText()) {
        const s = this.searchText().toLowerCase();
        if (!t.name.toLowerCase().includes(s) && !t.templateCode.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  });

  ngOnInit(): void { this.loadTemplates(); }

  async loadTemplates(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>('/api/document-templates'));
      this.templates.set(Array.isArray(data) ? data : data?.templates || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load templates');
    } finally {
      this.loading.set(false);
    }
  }

  getCategoryLabel(value: string): string {
    return TEMPLATE_CATEGORIES.find(c => c.value === value)?.label || value;
  }

  openCreate(): void {
    this.formName.set('');
    this.formCode.set('');
    this.formCategory.set('SECTION_129');
    this.formDescription.set('');
    this.formActive.set(true);
    this.showCreateDialog.set(true);
  }

  openEdit(t: DocumentTemplate): void {
    this.editTemplate.set(t);
    this.formName.set(t.name);
    this.formCode.set(t.templateCode);
    this.formCategory.set(t.category);
    this.formDescription.set(t.description || '');
    this.formActive.set(t.isActive);
    this.showEditDialog.set(true);
  }

  async openVersions(t: DocumentTemplate): Promise<void> {
    this.versionTemplate.set(t);
    this.showVersionsDialog.set(true);
    this.loadingVersions.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any>(`/api/document-templates/${t.id}/versions`));
      this.versions.set(Array.isArray(data) ? data : data?.versions || []);
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to load versions');
    } finally {
      this.loadingVersions.set(false);
    }
  }

  openUpload(t: DocumentTemplate): void {
    this.versionTemplate.set(t);
    const parts = (t.currentVersion || '1.0').split('.');
    const minor = parseInt(parts[1] || '0') + 1;
    this.uploadVersion.set(`${parts[0]}.${minor}`);
    this.uploadNotes.set('');
    this.uploadFileName.set('');
    this.showUploadDialog.set(true);
  }

  async handleCreate(): Promise<void> {
    if (!this.formName().trim() || !this.formCode().trim()) {
      this.toast.error('Name and template code are required');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post<any>('/api/document-templates', {
        name: this.formName(),
        templateCode: this.formCode(),
        category: this.formCategory(),
        description: this.formDescription(),
        isActive: this.formActive()
      }));
      this.toast.success(`${this.formName()} has been created.`);
      this.showCreateDialog.set(false);
      await this.loadTemplates();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to create template');
    } finally {
      this.saving.set(false);
    }
  }

  async handleUpdate(): Promise<void> {
    const et = this.editTemplate();
    if (!et || !this.formName().trim()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.put<any>(`/api/document-templates/${et.id}`, {
        name: this.formName(),
        templateCode: this.formCode(),
        category: this.formCategory(),
        description: this.formDescription(),
        isActive: this.formActive()
      }));
      this.toast.success(`${this.formName()} has been updated.`);
      this.showEditDialog.set(false);
      await this.loadTemplates();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to update template');
    } finally {
      this.saving.set(false);
    }
  }

  async handleUpload(): Promise<void> {
    const vt = this.versionTemplate();
    if (!vt || !this.uploadVersion().trim()) {
      this.toast.error('Version number is required');
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post<any>(`/api/document-templates/${vt.id}/upload`, {
        version: this.uploadVersion(),
        changeNotes: this.uploadNotes(),
        fileName: this.uploadFileName() || undefined
      }));
      this.toast.success(`Version ${this.uploadVersion()} has been uploaded.`);
      this.showUploadDialog.set(false);
      await this.loadTemplates();
    } catch (e: any) {
      this.toast.error(e?.message || 'Failed to upload version');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDownload(templateId: string, versionId?: string): Promise<void> {
    try {
      const params: Record<string, string> = {};
      if (versionId) params['versionId'] = versionId;
      await firstValueFrom(this.api.get<any>(`/api/document-templates/${templateId}/download`, params));
      this.toast.success('File download initiated.');
    } catch (e: any) {
      this.toast.error(e?.message || 'Download failed');
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFileName.set(input.files?.[0]?.name || '');
  }

  fmtDate(d: string | null | undefined): string { return formatDate(d); }
  fmtFileSize(bytes: number | null | undefined): string { return formatFileSize(bytes); }

  goHome(): void { this.router.navigate(['/']); }
  goDebt(): void { this.router.navigate(['/debt/section129']); }
}
