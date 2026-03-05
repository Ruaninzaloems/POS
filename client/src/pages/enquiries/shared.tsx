import React, { useState, Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle, RefreshCw } from 'lucide-react';

export class TabErrorBoundary extends Component<{ children: ReactNode; tabName?: string }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode; tabName?: string }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || 'Unknown error' };
  }
  componentDidCatch(error: Error) {
    console.error(`[TabErrorBoundary] ${this.props.tabName || 'Tab'} crashed:`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 sm:p-6">
          <div className="bg-white rounded-xl border border-red-100 shadow-sm">
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-600 mb-1">This tab encountered an error</p>
              <p className="text-xs text-slate-500 mb-4 text-center max-w-sm">{this.state.error}</p>
              <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false, error: '' })} className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50">
                <RefreshCw className="w-3 h-3" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FieldRow({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="group flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 px-2 sm:px-3 border-b border-[#E5E5E5] last:border-0 hover:bg-[#F7F7F7]/50 transition-colors rounded-sm">
      {icon && <div className="text-[var(--pos-accent)]/70 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4">
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">{label}</span>
        <span className="text-[12px] sm:text-[13px] text-slate-800 font-medium sm:text-right break-words">{typeof value === 'number' ? value.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : String(value)}</span>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="p-3 sm:p-6">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[#E5E5E5] bg-[#F7F7F7]">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-20 sm:w-28 rounded-md" />
              <Skeleton className="h-3.5 flex-1 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-3 sm:p-6">
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm">
        <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 sm:px-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#F2F4F7] flex items-center justify-center mb-3 sm:mb-4">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">{message}</p>
          <p className="text-xs text-slate-400 mt-1">No records found for this account</p>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-3 sm:p-6">
      <div className="bg-white rounded-xl border border-red-100 shadow-sm">
        <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-600 mb-1">Something went wrong</p>
          <p className="text-xs text-slate-500 mb-4 text-center max-w-sm">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50">
              <RefreshCw className="w-3 h-3" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TabCard({ children, title, icon, action }: { children: React.ReactNode; title?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
      {title && (
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E5E5] bg-[#F7F7F7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-[var(--pos-accent)]">{icon}</span>}
            <h3 className="text-xs sm:text-sm font-semibold text-slate-700">{title}</h3>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 py-2 sm:py-2.5 mt-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#D6D6D6] to-[#D6D6D6]" />
      <span className="text-[10px] sm:text-[11px] font-bold text-[var(--pos-accent)] uppercase tracking-[0.15em] whitespace-nowrap px-2">{title}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#D6D6D6] to-[#D6D6D6]" />
    </div>
  );
}

export function InfoField({ label, value, isCurrency, highlight }: { label: string; value: any; isCurrency?: boolean; highlight?: boolean }) {
  let display = '-';
  if (value !== null && value !== undefined && value !== '') {
    const lbl = label.toLowerCase();
    const currencyLabel = lbl.includes('amount') || lbl.includes('market value') || lbl.includes('deposit');
    const numVal = typeof value === 'number' ? value : (currencyLabel ? parseFloat(String(value)) : NaN);
    if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
    else if ((isCurrency || currencyLabel) && !isNaN(numVal)) display = `R ${numVal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    else display = String(value).replace(/\r\n/g, ', ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]*>/g, '');
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 py-1.5 sm:py-1 group hover:bg-[#F7F7F7]/50 rounded px-1 -mx-1 transition-colors">
      <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium whitespace-nowrap sm:min-w-[155px]">{label}</span>
      <span className="hidden sm:inline text-[11px] text-slate-300 shrink-0">:</span>
      <span className={`text-[11px] font-semibold break-words ${highlight ? 'text-[var(--pos-accent)] underline cursor-pointer' : 'text-slate-800'}`}>{display}</span>
    </div>
  );
}

export function GenericTable({ data, columns, testId }: { data: any[]; columns: { key: string; label: string; align?: string; format?: (v: any, row: any) => string }[]; testId: string }) {
  if (!data.length) return <EmptyState message="No data available" />;
  return (
    <>
      <div className="sm:hidden p-2 space-y-2" data-testid={`${testId}-mobile`}>
        {data.map((item: any, i: number) => (
          <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5">
            {columns.map(col => {
              const raw = item[col.key];
              const display = col.format ? col.format(raw, item) : (raw ?? '-');
              return (
                <div key={col.key} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium">{col.label}</span>
                  <span className={`text-slate-800 font-semibold text-right ${col.align === 'right' ? 'font-mono' : ''}`}>{String(display)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="hidden sm:block p-4 overflow-x-auto">
        <table className="w-full text-sm" data-testid={testId}>
          <thead>
            <tr className="border-b-2 border-[#D6D6D6]">
              {columns.map(col => (
                <th key={col.key} className={`${col.align === 'right' ? 'text-right' : 'text-left'} py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, i: number) => (
              <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[#F7F7F7] transition-colors">
                {columns.map(col => {
                  const raw = item[col.key];
                  const display = col.format ? col.format(raw, item) : (raw ?? '-');
                  return (
                    <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right font-mono' : ''}`}>{String(display)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MobileCardList({ data, renderCard, testId }: { data: any[]; renderCard: (item: any, index: number) => React.ReactNode; testId?: string }) {
  return (
    <div className="sm:hidden p-2 space-y-2" data-testid={testId}>
      {data.map((item, i) => renderCard(item, i))}
    </div>
  );
}

export function PaginatedTable({ data, columns, itemsPerPage = 50, tableId, onRowClick }: { data: any[]; columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; itemsPerPage?: number; tableId?: string; onRowClick?: (row: any) => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const paged = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const tid = tableId || 'table';

  return (
    <div data-testid={`${tid}-container`}>
      <div className="sm:hidden space-y-2 p-2">
        {paged.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm" data-testid={`${tid}-empty`}>No records to display</div>
        ) : paged.map((row, i) => (
          <div
            key={i}
            className={`bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5 ${onRowClick ? 'cursor-pointer active:bg-[var(--pos-accent-tint)]' : ''}`}
            onClick={() => onRowClick?.(row)}
            data-testid={`${tid}-card-${i}`}
          >
            {columns.map((c) => {
              const content = c.render ? c.render(row) : (row[c.key] ?? '');
              return (
                <div key={c.key} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium shrink-0">{c.label}</span>
                  <span className="text-slate-800 font-semibold text-right min-w-0 truncate">{content}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#D6D6D6]">
        <table className="w-full text-xs" data-testid={`${tid}-grid`}>
          <thead>
            <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-600 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-slate-400 py-8" data-testid={`${tid}-empty`}>No records to display</td></tr>
            ) : paged.map((row, i) => (
              <tr key={i} className={`border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)} data-testid={`${tid}-row-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-slate-700 whitespace-nowrap" data-testid={`${tid}-cell-${c.key}-${i}`}>
                    {c.render ? c.render(row) : (row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 mt-2 sm:mt-2.5 text-xs text-slate-500 px-2 sm:px-0">
        <span className="text-slate-600 font-medium" data-testid={`${tid}-page-info`}>{data.length === 0 ? '0 of 0' : `${(page-1)*itemsPerPage+1} - ${Math.min(page*itemsPerPage, data.length)} of ${data.length}`}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded border border-[#D6D6D6] bg-white hover:bg-[#F7F7F7] disabled:opacity-30 transition-colors" data-testid={`${tid}-prev-page`}>&lt;</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded border border-[#D6D6D6] bg-white hover:bg-[#F7F7F7] disabled:opacity-30 transition-colors" data-testid={`${tid}-next-page`}>&gt;</button>
        </div>
      </div>
    </div>
  );
}

export const MONTHS = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];

export function getFinYearOptions(): string[] {
  const now = new Date();
  const currentStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, i) => {
    const y = currentStartYear - i;
    return `${y}/${y + 1}`;
  });
}

export function ResponsiveTable({ data, columns, testId, emptyMessage, headerGradient }: {
  data: any[];
  columns: { key: string; label: string; align?: string; render?: (row: any) => React.ReactNode; mobileLabel?: string; hideOnMobile?: boolean }[];
  testId: string;
  emptyMessage?: string;
  headerGradient?: string;
}) {
  if (!data.length) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm">{emptyMessage || 'No records to display.'}</div>
    );
  }

  const mobileColumns = columns.filter(c => !c.hideOnMobile);

  return (
    <>
      <div className="sm:hidden space-y-2 p-2">
        {data.map((row, i) => (
          <div key={i} className="bg-white border border-[#D6D6D6] rounded-lg p-3 space-y-1.5" data-testid={`${testId}-card-${i}`}>
            {mobileColumns.map(col => {
              const content = col.render ? col.render(row) : (row[col.key] ?? '-');
              return (
                <div key={col.key} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium shrink-0">{col.mobileLabel || col.label}</span>
                  <span className={`text-slate-800 font-semibold text-right ${col.align === 'right' ? 'font-mono' : ''}`}>{typeof content === 'string' || typeof content === 'number' ? content : content}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs" data-testid={testId}>
          <thead>
            <tr className="bg-[#F7F7F7] border-b border-[#D6D6D6]">
              {columns.map(col => (
                <th key={col.key} className={`${col.align === 'right' ? 'text-right' : 'text-left'} py-2.5 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-bold whitespace-nowrap`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-[#E5E5E5] hover:bg-[var(--pos-accent-tint)]/30 transition-colors" data-testid={`${testId}-row-${i}`}>
                {columns.map(col => {
                  const content = col.render ? col.render(row) : (row[col.key] ?? '-');
                  return (
                    <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right font-mono' : ''} text-slate-700 whitespace-nowrap`}>{typeof content === 'string' || typeof content === 'number' ? content : content}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
