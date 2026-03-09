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
  FileWarning,
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
  fetchSection129Report,
  fetchAccounts,
  fetchAgeingRanges,
} from '@/lib/external-api';

export default function Section129Report() {
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
  const [ageing, setAgeing] = useState('');
  const [amountGreaterThan, setAmountGreaterThan] = useState('0');

  const [billingCycles, setBillingCycles] = useState<{ id: string; name: string }[]>([]);
  const [ageingRanges, setAgeingRanges] = useState<{ id: string; name: string }[]>([]);
  const [accountSuggestions, setAccountSuggestions] = useState<{ accountNo: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  useEffect(() => {
    fetchBillingCycles().then(setBillingCycles).catch(() => {});
    fetchAgeingRanges().then(setAgeingRanges).catch(() => {});
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
    const amt = parseInt(amountGreaterThan, 10);
    if (isNaN(amt) || amt < 0) {
      toast({ title: 'Validation Error', description: 'Amount Greater Than must be a non-negative integer.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSearched(true);
    setGridPage(1);
    try {
      const data = await fetchSection129Report({
        finYear,
        finMonth: finMonth !== '__all__' ? finMonth : undefined,
        billingCycle: billingCycle !== '__all__' ? billingCycle : undefined,
        accountNo: accountNo || undefined,
        ageing,
        amountGreaterThan: amt,
      });
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Report Failed', description: err.message || 'Failed to fetch Section 129 report.', variant: 'destructive' });
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
    setAgeing('');
    setAmountGreaterThan('0');
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


  const paginatedResults = results.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(results.length / gridPageSize);

  const resultColumns = results.length > 0
    ? Object.keys(results[0]).filter(k => !k.startsWith('_'))
    : [];

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1" data-testid="text-breadcrumb">
            <span>Billing</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span>Reports</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span>Debt Recovery</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-slate-300">Section 129 Notices Report</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <FileWarning className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight" data-testid="text-page-title">
                Section 129 Notices Report
              </h1>
              <p className="text-xs text-slate-400">Filter and view Section 129 notice data for debt recovery</p>
            </div>
          </div>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Financial Year
                    <HelpTip text="Select the financial year for the report" side="right" />
                  </Label>
                  <Select value={finYear} onValueChange={setFinYear} data-testid="select-fin-year">
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-fin-year">
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
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Billing Month
                    <HelpTip text="Filter by billing month (July-June financial year)" side="right" />
                  </Label>
                  <Select value={finMonth} onValueChange={setFinMonth} data-testid="select-fin-month">
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-fin-month">
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
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Billing Cycle
                    <HelpTip text="Filter by billing cycle" side="right" />
                  </Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle} data-testid="select-billing-cycle">
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-billing-cycle">
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
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Account Number
                    <HelpTip text="Search by account number (type at least 3 characters)" side="right" />
                  </Label>
                  <Input
                    value={accountNo}
                    onChange={(e) => handleAccountSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => accountSuggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Enter account number"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-account-no"
                  />
                  {showSuggestions && accountSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {accountSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                          data-testid={`suggestion-account-${idx}`}
                          onMouseDown={() => {
                            setAccountNo(s.accountNo);
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="font-medium">{s.accountNo}</span>
                          {s.name && <span className="text-slate-400 ml-2">— {s.name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Ageing
                    <HelpTip text="Filter by debt ageing period" side="right" />
                  </Label>
                  <Select value={ageing} onValueChange={setAgeing} data-testid="select-ageing">
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-ageing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ageingRanges.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    Amount Greater Than
                    <HelpTip text="Only include accounts with outstanding amount greater than this value (integer, >= 0)" side="right" />
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={amountGreaterThan}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (Number.isInteger(Number(val)) && Number(val) >= 0)) {
                        setAmountGreaterThan(val);
                      }
                    }}
                    placeholder="0"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-amount-greater-than"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  data-testid="button-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                  Submit
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-clear"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-cancel"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {searched && (
            <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white" data-testid="text-results-title">
                    Results ({results.length} record{results.length !== 1 ? 's' : ''})
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading report data...
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8" data-testid="text-no-results">
                    No records found matching the selected criteria.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50 hover:bg-transparent">
                            {resultColumns.map(col => (
                              <TableHead key={col} className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                {col.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedResults.map((row, idx) => (
                            <TableRow
                              key={idx}
                              className="border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                              data-testid={`row-result-${idx}`}
                            >
                              {resultColumns.map(col => (
                                <TableCell key={col} className="text-xs text-slate-300 whitespace-nowrap">
                                  {row[col] != null ? String(row[col]) : '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {totalGridPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                        <span className="text-xs text-slate-500">
                          Page {gridPage} of {totalGridPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.max(1, p - 1))}
                            disabled={gridPage <= 1}
                            className="h-7 px-2 text-slate-400"
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                            disabled={gridPage >= totalGridPages}
                            className="h-7 px-2 text-slate-400"
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
