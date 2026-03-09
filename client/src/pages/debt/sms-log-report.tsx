import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  MessageSquare,
  Loader2,
  Search,
  RotateCcw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
} from 'lucide-react';
import {
  fetchBillingCycles,
  fetchSmsLogReport,
  fetchAccounts,
} from '@/lib/external-api';

export default function SmsLogReport() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [finYear, setFinYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year - 1}/${year}`;
  });
  const [finMonth, setFinMonth] = useState('__all__');
  const [billingCycle, setBillingCycle] = useState('__all__');
  const [accountNo, setAccountNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('__all__');

  const [billingCycles, setBillingCycles] = useState<{ id: string; name: string }[]>([]);
  const [accountSuggestions, setAccountSuggestions] = useState<{ accountNo: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  useEffect(() => {
    fetchBillingCycles().then(setBillingCycles).catch(() => {});
  }, []);

  const handleAccountSearch = useCallback(async (query: string) => {
    setAccountNo(query);
    if (query.length >= 3) {
      try {
        const accounts = await fetchAccounts({ accountNo: query });
        const suggestions = (Array.isArray(accounts) ? accounts : []).slice(0, 10).map((a: any) => ({
          accountNo: a.accountNo || a.accountID?.toString() || '',
          name: a.name || a.accountName || '',
        }));
        setAccountSuggestions(suggestions);
        setShowSuggestions(true);
      } catch {
        setAccountSuggestions([]);
      }
    } else {
      setAccountSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setSearched(true);
    setGridPage(1);
    try {
      const data = await fetchSmsLogReport({
        finYear,
        finMonth: finMonth !== '__all__' ? finMonth : undefined,
        billingCycle: billingCycle !== '__all__' ? billingCycle : undefined,
        accountNo: accountNo || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        status: status !== '__all__' ? status : undefined,
      });
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Report Failed', description: err.message || 'Failed to fetch SMS log report.', variant: 'destructive' });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    setFinYear(`${year - 1}/${year}`);
    setFinMonth('__all__');
    setBillingCycle('__all__');
    setAccountNo('');
    setDateFrom('');
    setDateTo('');
    setStatus('__all__');
    setResults([]);
    setSearched(false);
    setGridPage(1);
  };

  const handleCancel = () => {
    setLocation('/');
  };

  const finYears = (() => {
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const end = currentFY - i;
      return `${end - 1}/${end}`;
    });
  })();

  const months = [
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  ];

  const statusOptions = [
    { value: 'Sent', label: 'Sent' },
    { value: 'Failed', label: 'Failed' },
    { value: 'Pending', label: 'Pending' },
  ];

  const gridColumns = [
    { key: 'date', label: 'Date' },
    { key: 'accountNo', label: 'Account No' },
    { key: 'mobileNumber', label: 'Mobile Number' },
    { key: 'template', label: 'Template' },
    { key: 'status', label: 'Status' },
    { key: 'message', label: 'Message' },
    { key: 'sentBy', label: 'Sent By' },
  ];

  const paginatedResults = results.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(results.length / gridPageSize);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1" data-testid="text-breadcrumb">
            <span>Billing</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span>Reports</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span>Debt Recovery</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground">SMS Log Report</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                SMS Log Report
              </h1>
              <p className="text-xs text-muted-foreground">View and filter SMS notification logs for debt recovery</p>
            </div>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Financial Year
                    <HelpTip text="Select the financial year for the report" side="right" />
                  </Label>
                  <Select value={finYear} onValueChange={setFinYear} data-testid="select-fin-year">
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {finYears.map(fy => (
                        <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Billing Month
                    <HelpTip text="Filter by billing month (July-June financial year)" side="right" />
                  </Label>
                  <Select value={finMonth} onValueChange={setFinMonth} data-testid="select-fin-month">
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Billing Cycle
                    <HelpTip text="Filter by billing cycle" side="right" />
                  </Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle} data-testid="select-billing-cycle">
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-billing-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {billingCycles.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 relative">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Account Number
                    <HelpTip text="Search by account number (type at least 3 characters)" side="right" />
                  </Label>
                  <Input
                    value={accountNo}
                    onChange={(e) => handleAccountSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => accountSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Enter account number"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-account-no"
                  />
                  {showSuggestions && accountSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#D6D6D6] rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {accountSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-[var(--pos-accent-tint)] transition-colors"
                          data-testid={`suggestion-account-${idx}`}
                          onMouseDown={() => {
                            setAccountNo(s.accountNo);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="font-medium">{s.accountNo}</span>
                          {s.name && <span className="text-muted-foreground ml-2">— {s.name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Date From
                    <HelpTip text="Filter SMS logs from this date" side="right" />
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-date-from"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Date To
                    <HelpTip text="Filter SMS logs up to this date" side="right" />
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-date-to"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    Status
                    <HelpTip text="Filter by SMS delivery status" side="right" />
                  </Label>
                  <Select value={status} onValueChange={setStatus} data-testid="select-status">
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm"
                  data-testid="button-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                  Submit
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="border-[#D6D6D6] text-foreground hover:bg-[var(--pos-accent-tint)]"
                  data-testid="button-clear"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-[#D6D6D6] text-foreground hover:bg-[var(--pos-accent-tint)]"
                  data-testid="button-cancel"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {searched && (
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground" data-testid="text-results-title">
                    Results ({results.length} record{results.length !== 1 ? 's' : ''})
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading SMS log data...
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8" data-testid="text-no-results">
                    No SMS log records found matching the selected criteria.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#E5E5E5] hover:bg-transparent">
                            {gridColumns.map(col => (
                              <TableHead key={col.key} className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                {col.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedResults.map((row, idx) => (
                            <TableRow
                              key={idx}
                              className="border-[#E5E5E5] hover:bg-[var(--pos-accent-hover-row)] transition-colors"
                              data-testid={`row-result-${idx}`}
                            >
                              {gridColumns.map(col => (
                                <TableCell key={col.key} className="text-xs text-foreground whitespace-nowrap">
                                  {col.key === 'status' ? (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      String(row[col.key]).toLowerCase() === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                                      String(row[col.key]).toLowerCase() === 'failed' ? 'bg-red-500/20 text-red-400' :
                                      String(row[col.key]).toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`} data-testid={`status-sms-${idx}`}>
                                      {row[col.key] != null ? String(row[col.key]) : '—'}
                                    </span>
                                  ) : (
                                    row[col.key] != null ? String(row[col.key]) : '—'
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {totalGridPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E5E5E5]">
                        <span className="text-xs text-muted-foreground">
                          Page {gridPage} of {totalGridPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.max(1, p - 1))}
                            disabled={gridPage <= 1}
                            className="h-7 px-2 text-muted-foreground"
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                            disabled={gridPage >= totalGridPages}
                            className="h-7 px-2 text-muted-foreground"
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
