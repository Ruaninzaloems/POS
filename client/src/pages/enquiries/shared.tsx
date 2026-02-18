import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertTriangle, RefreshCw } from 'lucide-react';

export function FieldRow({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="group flex items-center gap-3 py-2.5 px-3 border-b border-slate-100/80 last:border-0 hover:bg-slate-50/50 transition-colors rounded-sm">
      {icon && <div className="text-blue-500/70 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-4">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">{label}</span>
        <span className="text-[13px] text-slate-800 font-medium text-right break-words">{typeof value === 'number' ? value.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : String(value)}</span>
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="p-5 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-28 rounded-md" />
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
    <div className="p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-slate-300" />
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
    <div className="p-6">
      <div className="bg-white rounded-xl border border-red-100 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-blue-600">{icon}</span>}
            <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
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
    <div className="flex items-center gap-3 py-2.5 mt-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-300" />
      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-[0.15em] whitespace-nowrap px-2">{title}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300 to-slate-300" />
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
    <div className="flex items-baseline gap-2 py-1 group hover:bg-slate-50/50 rounded px-1 -mx-1 transition-colors">
      <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap min-w-[155px]">{label}</span>
      <span className="text-[11px] text-slate-300 shrink-0">:</span>
      <span className={`text-[11px] font-semibold break-words ${highlight ? 'text-blue-600 underline cursor-pointer' : 'text-slate-800'}`}>{display}</span>
    </div>
  );
}

export function GenericTable({ data, columns, testId }: { data: any[]; columns: { key: string; label: string; align?: string; format?: (v: any, row: any) => string }[]; testId: string }) {
  if (!data.length) return <EmptyState message="No data available" />;
  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead>
          <tr className="border-b-2 border-slate-200">
            {columns.map(col => (
              <th key={col.key} className={`${col.align === 'right' ? 'text-right' : 'text-left'} py-2 px-3 text-xs uppercase tracking-wider text-slate-500 font-semibold`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
  );
}

export function PaginatedTable({ data, columns, itemsPerPage = 50, tableId, onRowClick }: { data: any[]; columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; itemsPerPage?: number; tableId?: string; onRowClick?: (row: any) => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const paged = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const tid = tableId || 'table';

  return (
    <div data-testid={`${tid}-container`}>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs" data-testid={`${tid}-grid`}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-600 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-slate-400 py-8" data-testid={`${tid}-empty`}>No records to display</td></tr>
            ) : paged.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)} data-testid={`${tid}-row-${i}`}>
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
      <div className="flex items-center justify-end gap-2 mt-2.5 text-xs text-slate-500">
        <span className="text-slate-400">Items per page:</span>
        <span className="border border-slate-200 rounded-md px-2 py-0.5 bg-white text-slate-600 font-medium">{itemsPerPage}</span>
        <span className="text-slate-600 font-medium" data-testid={`${tid}-page-info`}>{data.length === 0 ? '0 of 0' : `${(page-1)*itemsPerPage+1} - ${Math.min(page*itemsPerPage, data.length)} of ${data.length}`}</span>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors" data-testid={`${tid}-prev-page`}>&lt;</button>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-colors" data-testid={`${tid}-next-page`}>&gt;</button>
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
