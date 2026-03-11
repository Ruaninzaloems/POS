import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CHANNEL_CONFIG } from '../../../services/debt-config';
import { CommunicationStep, CommunicationTimeline } from '../../../models/debt.models';

type Step = CommunicationStep;

@Component({
  selector: 'app-communication-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communication-timeline.component.html',
  styleUrls: ['./communication-timeline.component.css']
})
export class CommunicationTimelineComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  timelines = signal<any[]>([]);
  loading = signal(false);
  selectedTimeline = signal<CommunicationTimeline | null>(null);
  steps = signal<Step[]>([]);

  showCreate = signal(false);
  newName = signal('');
  newDesc = signal('');
  creating = signal(false);

  saving = signal(false);

  enrollAccount = signal('');
  enrolling = signal(false);

  CHANNEL_CONFIG = CHANNEL_CONFIG;

  sortedSteps = computed(() =>
    [...this.steps()].sort((a, b) => a.dayOffset - b.dayOffset)
  );

  ngOnInit(): void {
    this.loadTimelines();
  }

  async loadTimelines(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.api.get<any[]>('/api/communications/timelines'));
      this.timelines.set(Array.isArray(data) ? data : []);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to load timelines');
    } finally { this.loading.set(false); }
  }

  async loadTimelineDetail(id: number): Promise<void> {
    try {
      const data = await firstValueFrom(this.api.get<any>(`/api/communications/timelines/${id}`));
      this.selectedTimeline.set(data.timeline);
      this.steps.set((data.steps || []).map((s: any) => ({
        dayOffset: s.dayOffset ?? s.day_offset ?? 0,
        channel: s.channel || 'sms',
        templateName: s.templateName ?? s.template_name ?? '',
        templateBody: s.templateBody ?? s.template_body ?? '',
        subject: s.subject || '',
        isAutomated: s.isAutomated ?? s.is_automated ?? true,
      })));
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to load timeline');
    }
  }

  async handleCreate(): Promise<void> {
    if (!this.newName().trim()) return;
    this.creating.set(true);
    try {
      const tl = await firstValueFrom(this.api.post<any>('/api/communications/timelines', {
        name: this.newName().trim(),
        description: this.newDesc().trim() || null,
        isActive: true,
      }));
      this.toast.success('Timeline Created');
      this.showCreate.set(false);
      this.newName.set('');
      this.newDesc.set('');
      this.loadTimelines();
      this.loadTimelineDetail(tl.id);
    } catch (err: any) {
      this.toast.error(err?.message || 'Create failed');
    } finally { this.creating.set(false); }
  }

  async handleDelete(id: number): Promise<void> {
    if (!confirm('Delete this timeline and all its steps?')) return;
    try {
      await firstValueFrom(this.api.delete<any>(`/api/communications/timelines/${id}`));
      this.toast.success('Timeline Deleted');
      if (this.selectedTimeline()?.id === id) {
        this.selectedTimeline.set(null);
        this.steps.set([]);
      }
      this.loadTimelines();
    } catch (err: any) {
      this.toast.error(err?.message || 'Delete failed');
    }
  }

  addStep(): void {
    const currentSteps = this.steps();
    const maxDay = currentSteps.length > 0 ? Math.max(...currentSteps.map(s => s.dayOffset)) + 7 : 1;
    this.steps.update(prev => [...prev, {
      dayOffset: maxDay,
      channel: 'sms',
      templateName: '',
      templateBody: '',
      subject: '',
      isAutomated: true,
    }]);
  }

  removeStep(index: number): void {
    this.steps.update(prev => prev.filter((_, i) => i !== index));
  }

  updateStep(index: number, field: keyof Step, value: any): void {
    this.steps.update(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  async handleSaveSteps(): Promise<void> {
    const tl = this.selectedTimeline();
    if (!tl) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.put<any>(`/api/communications/timelines/${tl.id}/steps`, {
        steps: this.steps().map(s => ({
          timelineId: tl.id,
          dayOffset: s.dayOffset,
          channel: s.channel,
          templateName: s.templateName || null,
          templateBody: s.templateBody || null,
          subject: s.subject || null,
          isAutomated: s.isAutomated,
        })),
      }));
      this.toast.success('Timeline Steps Saved');
      this.loadTimelineDetail(tl.id as number);
    } catch (err: any) {
      this.toast.error(err?.message || 'Save failed');
    } finally { this.saving.set(false); }
  }

  async handleEnroll(): Promise<void> {
    const tl = this.selectedTimeline();
    if (!this.enrollAccount().trim() || !tl) return;
    this.enrolling.set(true);
    try {
      const result = await firstValueFrom(this.api.post<any>('/api/communications/enroll', {
        timelineId: tl.id,
        accountNo: this.enrollAccount().trim(),
      }));
      this.toast.success(`Account enrolled. ${result.scheduledCount || 0} communications scheduled.`);
      this.enrollAccount.set('');
    } catch (err: any) {
      this.toast.error(err?.message || 'Enroll failed');
    } finally { this.enrolling.set(false); }
  }

  getChannelLabel(channel: string): string {
    return CHANNEL_CONFIG[channel]?.label || channel;
  }

  getDayGap(steps: Step[], index: number): number {
    const sorted = [...steps].sort((a, b) => a.dayOffset - b.dayOffset);
    if (index <= 0) return 0;
    return sorted[index].dayOffset - sorted[index - 1].dayOffset;
  }

  goBack(): void { this.router.navigate(['/']); }
}
