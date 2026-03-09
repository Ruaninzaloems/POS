export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(d);
  }
}

export function formatDateShort(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(d);
  }
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-ZA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${value.toFixed(2)}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate) return '—';
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function getFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year - 1}/${year}`;
}

export function getFinancialYearList(count: number = 5): string[] {
  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return Array.from({ length: count }, (_, i) => {
    const end = currentFY - i;
    return `${end - 1}/${end}`;
  });
}
