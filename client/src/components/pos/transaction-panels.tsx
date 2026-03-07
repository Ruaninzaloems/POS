import React, { useRef, useState } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Account, ClearanceCostSchedule, DirectIncomeItem, fetchEnquiryResults } from '@/lib/external-api';
import { User, MapPin, Phone, Mail, FileCheck, Zap, Trash2, Droplets, Upload, Search, Info, Download, FileText, ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown, Sparkles, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AccountEnquiryView } from '@/components/pos/account-enquiry-view';
import { Checkbox } from '@/components/ui/checkbox';
import { HelpTip } from '@/components/ui/help-tip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

function BasketPayAmountInput({ value, onChange, className = '', tabIndex }: { value: number; onChange: (val: number) => void; className?: string; tabIndex?: number }) {
    const [text, setText] = useState(value ? String(value) : '');
    const lastExternalValue = useRef(value);

    React.useEffect(() => {
        if (value !== lastExternalValue.current) {
            lastExternalValue.current = value;
            const currentNum = parseFloat(text);
            if (isNaN(currentNum) || Math.abs(currentNum - value) > 0.001) {
                setText(value ? String(value) : '');
            }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
            setText(raw);
            const num = parseFloat(raw);
            if (!isNaN(num) && num >= 0) {
                lastExternalValue.current = num;
                onChange(num);
            } else if (raw === '' || raw === '.') {
                lastExternalValue.current = 0;
                onChange(0);
            }
        }
    };

    const handleBlur = () => {
        const num = parseFloat(text);
        if (!isNaN(num) && num >= 0) {
            setText(num.toString());
        } else {
            setText('');
        }
    };

    return (
        <Input
            type="text"
            inputMode="decimal"
            className={`h-9 pl-6 text-right font-mono rounded-lg focus:ring-2 focus:ring-[var(--pos-accent-shadow)] ${className}`}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            {...(tabIndex !== undefined ? { tabIndex } : {})}
            data-testid="input-basket-pay-amount"
        />
    );
}

function ClearancePaymentInput({ value, minValue, disabled, onChange, className = '', 'data-testid': testId }: { value: number; minValue: number; disabled?: boolean; onChange: (val: number) => void; className?: string; 'data-testid'?: string }) {
    const [text, setText] = useState(String(value));
    const lastExternalValue = useRef(value);

    React.useEffect(() => {
        if (value !== lastExternalValue.current) {
            lastExternalValue.current = value;
            const currentNum = parseFloat(text);
            if (isNaN(currentNum) || Math.abs(currentNum - value) > 0.001) {
                setText(String(value));
            }
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
            setText(raw);
            const num = parseFloat(raw);
            if (!isNaN(num)) {
                const clamped = Math.max(num, minValue);
                lastExternalValue.current = clamped;
                onChange(clamped);
            }
        }
    };

    const handleBlur = () => {
        const num = parseFloat(text);
        if (!isNaN(num)) {
            const clamped = Math.max(num, minValue);
            setText(String(clamped));
            lastExternalValue.current = clamped;
            onChange(clamped);
        } else {
            setText(String(minValue));
            lastExternalValue.current = minValue;
            onChange(minValue);
        }
    };

    return (
        <Input
            type="text"
            inputMode="decimal"
            className={className}
            value={text}
            disabled={disabled}
            onChange={handleChange}
            onBlur={handleBlur}
            data-testid={testId}
        />
    );
}

function ClearanceBasketExpander({ item, updateItemDetails, updateItemAmount }: {
    item: TransactionItem;
    updateItemDetails: (id: string, details: Partial<TransactionItem>) => void;
    updateItemAmount: (id: string, amount: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const clr = item.originalData || {};
    const paidItems = clr.paidItems || [];
    const paySection1181Only = clr.paySection1181Only || false;
    const section1181Amount = clr.total1181 ?? 0;

    const handlePaySection1181Toggle = (checked: boolean) => {
        const newOrigData = { ...clr, paySection1181Only: checked };
        if (checked) {
            const sec1181Abs = Math.abs(section1181Amount || 0);
            updateItemDetails(item.id, {
                amountToPay: sec1181Abs,
                originalData: newOrigData,
            });
        } else {
            updateItemDetails(item.id, {
                amountToPay: clr.totalDue || item.amountDue,
                originalData: newOrigData,
            });
        }
    };

    const handlePaidItemAmountChange = (index: number, newAmount: number) => {
        const updatedPaidItems = [...paidItems];
        updatedPaidItems[index] = { ...updatedPaidItems[index], paymentAmount: newAmount };
        const newTotal = updatedPaidItems.reduce((sum: number, pi: any) => sum + (pi.paymentAmount ?? pi.amount ?? 0), 0);
        updateItemDetails(item.id, {
            amountToPay: newTotal,
            originalData: { ...clr, paidItems: updatedPaidItems },
        });
    };

    return (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
            <div className="bg-amber-50 border border-amber-200 rounded-xl">
                <button
                    tabIndex={-1}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100/50 transition-colors rounded-xl"
                    onClick={() => setExpanded(!expanded)}
                    data-testid={`button-expand-clearance-${item.id}`}
                >
                    <span className="flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5" />
                        {paidItems.length > 0
                            ? `${paidItems.length} line item${paidItems.length !== 1 ? 's' : ''} - Click to ${expanded ? 'hide' : 'view'} breakdown`
                            : `Click to ${expanded ? 'hide' : 'view'} clearance details`}
                    </span>
                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {expanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-amber-200">
                        {(clr.ownerName || clr.propertyAddress || clr.sgNumber) && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                                {clr.ownerName && (
                                    <div>
                                        <div className="text-[10px] text-amber-700 uppercase font-semibold">Name</div>
                                        <div className="text-xs font-medium">{clr.ownerName}</div>
                                    </div>
                                )}
                                {(clr.accountID || paidItems[0]?.accountNumber) && (
                                    <div>
                                        <div className="text-[10px] text-amber-700 uppercase font-semibold">Account</div>
                                        <div className="text-xs font-mono">{paidItems[0]?.accountNumber || clr.accountID}</div>
                                    </div>
                                )}
                                {clr.sgNumber && (
                                    <div>
                                        <div className="text-[10px] text-amber-700 uppercase font-semibold">SG Number</div>
                                        <div className="text-xs font-mono">{clr.sgNumber}</div>
                                    </div>
                                )}
                                {clr.propertyAddress && (
                                    <div className="col-span-2 sm:col-span-3">
                                        <div className="text-[10px] text-amber-700 uppercase font-semibold">Property Address</div>
                                        <div className="text-xs">{clr.propertyAddress}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {paidItems.length > 0 && (
                            <div className="overflow-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-amber-100/70 text-amber-900">
                                            <th className="text-left py-1.5 px-2 font-semibold">Account</th>
                                            <th className="text-left py-1.5 px-2 font-semibold">Type</th>
                                            <th className="text-right py-1.5 px-2 font-semibold">Cost Schedule</th>
                                            <th className="text-right py-1.5 px-2 font-semibold">Payment Amt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paidItems.map((pi: any, i: number) => {
                                            const costAmount = pi.amount || 0;
                                            const payAmount = pi.paymentAmount ?? pi.amount ?? 0;
                                            return (
                                                <tr key={i} className="border-t border-amber-200/60">
                                                    <td className="py-1.5 px-2 font-mono">{pi.accountNumber || pi.account_ID || 'N/A'}</td>
                                                    <td className="py-1.5 px-2 text-muted-foreground">{pi.debT_TYPE || pi.debtType || '-'}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono">R {costAmount.toFixed(2)}</td>
                                                    <td className="py-1.5 px-2 text-right">
                                                        <ClearancePaymentInput
                                                            value={payAmount}
                                                            minValue={costAmount}
                                                            disabled={paySection1181Only}
                                                            onChange={(val) => handlePaidItemAmountChange(i, val)}
                                                            className="w-24 h-7 text-right font-mono text-xs ml-auto bg-white"
                                                            data-testid={`input-basket-clr-payment-${item.id}-${i}`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`basket-pay1181-${item.id}`}
                                    checked={paySection1181Only}
                                    onCheckedChange={(checked) => handlePaySection1181Toggle(checked === true)}
                                    data-testid={`checkbox-basket-1181-${item.id}`}
                                />
                                <Label htmlFor={`basket-pay1181-${item.id}`} className="text-[10px] cursor-pointer font-semibold text-amber-800">
                                    Pay Section 118(1) Only
                                </Label>
                                {section1181Amount !== 0 && (
                                    <span className="text-[10px] font-mono text-amber-700 ml-1">
                                        (R {Math.abs(section1181Amount).toFixed(2)})
                                    </span>
                                )}
                            </div>
                            <div className="text-xs font-bold font-mono text-amber-900 bg-amber-100 px-2 py-1 rounded">
                                Total: R {(item.amountToPay || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const BASKET_PAGE_SIZE_DESKTOP = 15;
const BASKET_PAGE_SIZE_MOBILE = 5;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export function TransactionPanels({ isSearchActive = false }: { isSearchActive?: boolean }) {
  const { activeTransactionType, transactionItems, removeItem, updateItemAmount, updateItemDetails, addItem, viewingItemId, setViewingItem, currentUser, recentTransactions, sessionDetails, activeSession } = usePos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [basketPage, setBasketPage] = useState(1);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const basketItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const basketCardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const BASKET_PAGE_SIZE = isMobile ? BASKET_PAGE_SIZE_MOBILE : BASKET_PAGE_SIZE_DESKTOP;

  const sortedItems = React.useMemo(() =>
    [...transactionItems].sort((a, b) => {
      const getPriority = (type: string) => {
        switch (type) {
          case 'CONSUMER_SERVICES': return 1;
          case 'CLEARANCE': return 2;
          case 'DIRECT_INCOME': return 3;
          case 'ACCOUNT_GROUP': return 4;
          case 'PREPAID': return 10;
          default: return 5;
        }
      };
      return getPriority(a.type) - getPriority(b.type);
    }),
    [transactionItems]
  );

  const itemsWithAmount = sortedItems.filter(i => i.amountToPay > 0);
  const itemsMissing = sortedItems.filter(i => i.amountToPay <= 0);
  const displayItems = showOnlyMissing ? itemsMissing : sortedItems;
  const totalPages = Math.max(1, Math.ceil(displayItems.length / BASKET_PAGE_SIZE));
  const safePage = Math.min(basketPage, totalPages);
  const pagedItems = displayItems.slice((safePage - 1) * BASKET_PAGE_SIZE, safePage * BASKET_PAGE_SIZE);

  React.useEffect(() => {
    if (basketPage > totalPages) setBasketPage(totalPages);
  }, [totalPages, basketPage]);

  const handlePageChange = (newPage: number | ((p: number) => number)) => {
    setBasketPage(newPage);
    if (isMobile && basketCardRef.current) {
      setTimeout(() => {
        basketCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const scrollToNextMissing = () => {
    const missingOnPage = pagedItems.filter(i => i.amountToPay <= 0);
    if (missingOnPage.length > 0) {
      const el = basketItemRefs.current[missingOnPage[0].id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 2000);
      }
    } else if (itemsMissing.length > 0) {
      const firstMissing = itemsMissing[0];
      const idx = displayItems.findIndex(i => i.id === firstMissing.id);
      if (idx >= 0) {
        const targetPage = Math.floor(idx / BASKET_PAGE_SIZE) + 1;
        setBasketPage(targetPage);
        setTimeout(() => {
          const el = basketItemRefs.current[firstMissing.id];
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
            setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 2000);
          }
        }, 100);
      }
    }
  };

  const [showFillConfirm, setShowFillConfirm] = useState(false);
  const fillAllDueAmounts = () => {
    const fillable = transactionItems.filter(i => i.amountToPay <= 0 && i.amountDue > 0);
    fillable.forEach(item => {
      updateItemAmount(item.id, item.amountDue);
    });
    setShowFillConfirm(false);
    toast({ title: 'Amounts populated', description: `Set ${fillable.length} items to their outstanding due amounts.` });
  };

  const handleDownloadTemplate = () => {
      const today = new Date().toISOString().split('T')[0];
      const csvContent = "\uFEFF" +
        "Receipt Date,Account Number,Amount\r\n" +
        `${today},000000013088,150.00\r\n` +
        `${today},000000020715,200.50\r\n` +
        `${today},000000017807,75.00`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "receipt_import_template.csv");
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  };

  const [importingCSV, setImportingCSV] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const csvLines = text.split('\n');
      const entries: { receiptDate: string; accNo: string; amount: number }[] = [];

      csvLines.forEach((line, index) => {
        if (!line.trim()) return;
        if (index === 0 && line.toLowerCase().includes('account number')) return;
        const parts = line.split(',').map(s => s.trim());

        let receiptDate = '';
        let accNo = '';
        let amountStr = '';

        if (parts.length >= 3) {
          [receiptDate, accNo, amountStr] = parts;
        } else if (parts.length === 2) {
          [accNo, amountStr] = parts;
          receiptDate = new Date().toISOString().split('T')[0];
        } else {
          return;
        }

        if (!accNo) return;
        entries.push({ receiptDate, accNo, amount: parseFloat(amountStr) || 0 });
      });

      if (entries.length === 0) {
        toast({ title: "Import Failed", description: "No valid rows found in CSV.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setImportingCSV(true);
      let addedCount = 0;
      let failedCount = 0;
      const BATCH = 5;

      try {
        for (let i = 0; i < entries.length; i += BATCH) {
          const batch = entries.slice(i, i + BATCH);
          const results = await Promise.allSettled(
            batch.map(async (entry) => {
              const data = await fetchEnquiryResults({ accountID: entry.accNo });
              const items = Array.isArray(data) ? data : data && !data._error ? [data] : [];
              if (items.length === 0) throw new Error('Not found');
              const item = items[0];
              return { entry, item };
            })
          );

          for (const result of results) {
            if (result.status === 'fulfilled') {
              const { entry, item } = result.value;
              const accountData: Account = {
                accountNo: item.accountNumber || item.oldAccountCode || `${item.account_ID}`,
                name: item.name || 'Unknown',
                idNo: '-',
                address: item.deliveryAddress || item.streetName || '',
                outstandingAmount: item.outStandingAmt || 0,
                status: item.statusDesc || '-',
                email: '',
                mobile: '',
                accountType: item.typeOfUseDesc || 'Consumer',
                sgNo: item.erfNumber || '',
                oldCode: item.oldAccountCode || '',
                prepaidMeterNo: item.physicalMeterNo || '',
                unitId: '',
                apiId: item.account_ID,
                deliveryAddress: item.deliveryAddress || '',
                locationAddress: item.streetName || '',
                town: item.town || '',
                account_ID: item.account_ID,
                accountNumber: item.accountNumber,
                outStandingAmt: item.outStandingAmt,
                billId: item.billId,
                cutOffID: item.cutOffID,
                debtArrangementId: item.debtArrangementId,
                clearance_ID: item.clearance_ID,
                clearanceAmount: item.clearanceAmount,
                billingCycleId: item.billingCycleId,
                _rawSearchResult: item,
              } as Account;

              addItem({
                id: crypto.randomUUID(),
                type: 'CONSUMER_SERVICES',
                description: `Account ${item.accountNumber || entry.accNo} - ${item.name || 'Unknown'}`,
                reference: item.accountNumber || entry.accNo,
                amountDue: entry.amount,
                amountToPay: entry.amount,
                originalData: accountData,
                notes: `CSV Import. Receipt Date: ${entry.receiptDate}`
              }, true);
              addedCount++;
            } else {
              failedCount++;
            }
          }
        }
      } finally {
        setImportingCSV(false);
      }

      if (addedCount > 0) {
        toast({
          title: "CSV Import Successful",
          description: `Added ${addedCount} transactions to basket.${failedCount > 0 ? ` ${failedCount} account(s) not found.` : ''}`,
          variant: "default"
        });
        setIsImportOpen(false);
      } else {
        toast({
          title: "Import Failed",
          description: "No matching accounts found in CSV.",
          variant: "destructive"
        });
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // RENDER VIEWING ITEM OVERRIDE
  if (viewingItemId) {
      const item = transactionItems.find(i => i.id === viewingItemId);
      if (item) {
          // Wrap in a container to maintain layout
          return (
              <div className="flex-1 p-3 sm:p-6 bg-gradient-to-br from-[#F7F7F7] to-[#F7F7F7]">
                  <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-6">
                      <AccountEnquiryView item={item} />
                  </div>
              </div>
          );
      }
  }

  if (activeTransactionType === 'NONE') {
    if (isSearchActive) {
      return (
        <div className="flex-1 flex flex-col items-center justify-start pt-16 sm:pt-24 p-4 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center mb-4 shadow-lg">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-500">Finding accounts...</p>
          </div>
        </div>
      );
    }

    const greeting = (() => {
      const h = new Date().getHours();
      if (h < 12) return 'Good morning';
      if (h < 17) return 'Good afternoon';
      return 'Good evening';
    })();
    const firstName = currentUser?.name?.split(' ')[0] || '';
    const todayReceipts = recentTransactions?.length || 0;
    const todayTotal = recentTransactions?.reduce((sum, r) => sum + (r.totalAmount || 0), 0) || 0;
    const formatZAR = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n);

    const quickActions = [
      { key: 'accounts', label: 'Consumer Accounts', desc: 'Search by account or name', icon: User, color: 'var(--pos-accent)', bg: 'var(--pos-accent-tint)' },
      { key: 'prepaid', label: 'Prepaid Meters', desc: 'Electricity & water tokens', icon: Zap, color: '#f59e0b', bg: '#fffbeb' },
      { key: 'clearance', label: 'Clearance Certs', desc: 'Property clearance figures', icon: FileCheck, color: '#10b981', bg: '#ecfdf5' },
      { key: 'direct', label: 'Direct Income', desc: 'Miscellaneous receipting', icon: FileText, color: '#8b5cf6', bg: '#f5f3ff' },
    ];

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/80" />
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(to right, transparent, var(--pos-accent-tint), transparent)' }} />
        <div className="absolute top-1/3 -left-40 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'var(--pos-accent-tint)' }} />
        <div className="absolute bottom-1/4 -right-40 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: 'var(--pos-accent-tint)', opacity: 0.7 }} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-xl mx-auto w-full">
          {activeSession && firstName && (
            <div className="mb-6 sm:mb-8 text-center" data-testid="text-greeting">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-700 tracking-tight">
                {greeting}, <span className="text-[var(--pos-accent-dark)]">{firstName}</span>
              </h2>
            </div>
          )}

          <div className="w-full mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-200" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Quick Actions</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {quickActions.map(({ key, label, desc, icon: Icon, color, bg }) => (
                <button
                  key={key}
                  onClick={() => {
                    const searchInput = document.querySelector<HTMLInputElement>('[data-testid="input-search-account"]');
                    if (searchInput) { searchInput.focus(); searchInput.placeholder = `Search ${label.toLowerCase()}...`; }
                  }}
                  className="group relative flex items-start gap-3 p-3 sm:p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 cursor-pointer hover:border-[var(--pos-accent-shadow)] hover:shadow-lg hover:bg-white hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 text-left min-h-[56px] sm:min-h-[72px]"
                  data-testid={`action-${key}`}
                >
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-tight block">{label}</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 leading-snug block mt-0.5 hidden sm:block">{desc}</span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Search className="w-3 h-3 text-[var(--pos-accent)]" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="h-[1px] w-8 bg-slate-200" />
              <Search className="w-3.5 h-3.5" />
              <p className="text-xs font-medium">Type in the search bar above to begin</p>
              <div className="h-[1px] w-8 bg-slate-200" />
            </div>
            <p className="text-[10px] text-slate-300 tracking-wide">
              Search by account number, meter number, name, or ID
            </p>
          </div>

          <div className="mt-6 sm:mt-8 flex items-center gap-3">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-500 bg-white/70 backdrop-blur-sm hover:bg-white hover:text-[var(--pos-accent)] border border-slate-200/80 hover:border-[var(--pos-accent-shadow)] hover:shadow-sm transition-all duration-200" data-testid="button-import-csv">
                  <Upload className="w-3.5 h-3.5" />
                  Import CSV Batch
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Transactions</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to add multiple transactions at once.
                  </DialogDescription>
                </DialogHeader>

                <div className="bg-[var(--pos-accent-tint)] border-[#D6D6D6] p-4 rounded-md border text-sm space-y-3">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">Required CSV Format: <HelpTip text="Your CSV file must have 3 columns in this exact order. The first row (header) is automatically skipped." /></div>
                  <div className="bg-white rounded-xl border border-[#D6D6D6] p-2 font-mono text-xs text-slate-600">
                    Receipt Date, Account Number, Amount
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Example:<br/>
                    2026-03-07, 000000013088, 150.00<br/>
                    2026-03-07, 000000020715, 200.50
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--pos-accent)] bg-[var(--pos-accent-tint)] p-2 rounded border border-[#D6D6D6]">
                    <Info className="w-4 h-4" />
                    Duplicate accounts allowed (e.g. multiple receipts for same account). <HelpTip text="Each row creates a separate transaction. You can import multiple payments for the same account number." icon="info" />
                  </div>
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)]" data-testid="button-download-csv-template">
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)]" disabled={importingCSV}>
                    {importingCSV ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><FileText className="w-4 h-4" /> Select File</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv,.txt"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    );
  }

  // Multi-Account / Basket View
  if (activeTransactionType === 'MULTI_ACCOUNT') {
      const allReady = transactionItems.length > 0 && itemsMissing.length === 0;
      return (
          <div className="flex-1 p-3 sm:p-6 bg-muted/10">
              <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Multi-Account Basket</h2>
                        <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 font-mono uppercase bg-primary/10 text-primary border-primary/20">
                            Mixed Transaction
                        </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                         <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                             <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Upload className="w-4 h-4" />
                                    Import CSV
                                </Button>
                             </DialogTrigger>
                             <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Import Transactions</DialogTitle>
                                    <DialogDescription>
                                        Upload a CSV file to add multiple transactions at once.
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <div className="bg-[var(--pos-accent-tint)] border-[#D6D6D6] p-4 rounded-md border text-sm space-y-3">
                                    <div className="font-semibold text-slate-700 flex items-center gap-1">Required CSV Format: <HelpTip text="Your CSV file must have 3 columns in this exact order. The first row (header) is automatically skipped." /></div>
                                    <div className="bg-white rounded-xl border border-[#D6D6D6] p-2 font-mono text-xs text-slate-600">
                                        Receipt Date, Account Number, Amount
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Example:<br/>
                                        2026-03-07, 000000013088, 150.00<br/>
                                        2026-03-07, 000000020715, 200.50
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-[var(--pos-accent)] bg-[var(--pos-accent-tint)] p-2 rounded border border-[#D6D6D6]">
                                        <Info className="w-4 h-4" />
                                        Duplicate accounts allowed (e.g. multiple receipts for same account). <HelpTip text="Each row creates a separate transaction. You can import multiple payments for the same account number." icon="info" />
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-between gap-2">
                                     <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)]">
                                         <Download className="w-4 h-4" />
                                         Download Template
                                     </Button>
                                     <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)]" disabled={importingCSV}>
                                         {importingCSV ? (
                                           <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                                         ) : (
                                           <><FileText className="w-4 h-4" /> Select File</>
                                         )}
                                     </Button>
                                </DialogFooter>
                             </DialogContent>
                         </Dialog>
                         
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".csv,.txt" 
                            onChange={handleFileUpload}
                         />
                    </div>
                  </div>

                  {transactionItems.length > 0 && (
                    <div className={`rounded-xl border shadow-sm p-3 sm:p-4 ${allReady ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-[#D6D6D6]'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${allReady ? 'bg-emerald-500 text-white' : 'bg-[var(--pos-accent)] text-white'}`}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="font-semibold text-slate-700">
                              {transactionItems.length} {transactionItems.length === 1 ? 'Item' : 'Items'}
                            </span>
                            <span className="flex items-center gap-1.5 text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="font-medium">{itemsWithAmount.length}</span>
                              <span className="text-emerald-600/80 text-xs">ready</span>
                            </span>
                            {itemsMissing.length > 0 && (
                              <button
                                onClick={scrollToNextMissing}
                                className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 transition-colors cursor-pointer group"
                                data-testid="btn-jump-missing"
                              >
                                <AlertCircle className="w-4 h-4 group-hover:animate-pulse" />
                                <span className="font-medium">{itemsMissing.length}</span>
                                <span className="text-amber-600/80 text-xs underline underline-offset-2 decoration-amber-300 group-hover:decoration-amber-500">need amounts</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const zeroItems = transactionItems.filter(i => (i.amountDue ?? 0) <= 0);
                            return zeroItems.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => { zeroItems.forEach(i => removeItem(i.id)); }}
                                data-testid="btn-remove-zero-balances"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove R 0 ({zeroItems.length})
                              </Button>
                            ) : null;
                          })()}
                          {itemsMissing.length > 0 && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`text-xs gap-1.5 ${showOnlyMissing ? 'bg-amber-50 border-amber-300 text-amber-800' : 'text-slate-600'}`}
                                onClick={() => { setShowOnlyMissing(!showOnlyMissing); handlePageChange(1); }}
                                data-testid="btn-filter-missing"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                {showOnlyMissing ? 'Show All' : 'Show Missing'}
                              </Button>
                              <Dialog open={showFillConfirm} onOpenChange={setShowFillConfirm}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                    data-testid="btn-fill-all-due"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Pay All Due
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm">
                                  <DialogHeader>
                                    <DialogTitle>Set All to Due Amounts?</DialogTitle>
                                    <DialogDescription>
                                      This will set the pay amount on {itemsMissing.filter(i => i.amountDue > 0).length} item(s) to their full outstanding balance. You can still adjust individual amounts afterwards.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setShowFillConfirm(false)}>Cancel</Button>
                                    <Button size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600" onClick={fillAllDueAmounts}>
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Yes, Fill All
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>
                      </div>
                      {allReady && (
                        <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1.5 pl-[52px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          All items have payment amounts — ready to process
                        </div>
                      )}
                    </div>
                  )}

                  <Card ref={basketCardRef}>
                      <CardHeader className="py-3 sm:py-4 border-b bg-muted/20">
                          <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              <div className="flex items-center gap-1">Type <HelpTip text="Transaction category: ACC=Account, ELEC/H2O=Prepaid, CLR=Clearance, INC=Direct Income, GRP=Group" /></div>
                              <div>Description / Ref</div>
                              <div className="text-right flex items-center justify-end gap-1">Amount Due <HelpTip text="The outstanding balance on this account or the cost of this item" /></div>
                              <div className="text-right flex items-center justify-end gap-1">Pay Amount <HelpTip text="The amount you want to pay now. You can pay less than the full amount due." /></div>
                              <div className="w-8"></div>
                          </div>
                          <div className="sm:hidden font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              Items in Basket {showOnlyMissing && <span className="text-amber-600">(Missing Only)</span>}
                          </div>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-0">
                          {pagedItems.map((item, idx, arr) => (
                              <div key={item.id} ref={el => { basketItemRefs.current[item.id] = el; }} className={`rounded-xl border transition-all ${item.amountToPay <= 0 ? 'border-amber-200/80 bg-amber-50/30' : 'border-[#D6D6D6]/80'} shadow-sm hover:shadow-md ${idx < arr.length - 1 ? 'mb-2' : ''}`}>
                                  <div className="sm:grid sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:gap-4 sm:items-center p-3 sm:p-4">
                                      <div className="flex items-center justify-between sm:justify-start gap-2 mb-2 sm:mb-0">
                                          <div className="flex items-center gap-2">
                                              {item.type === 'CONSUMER_SERVICES' && <Badge variant="secondary" className="font-mono text-xs bg-[var(--pos-accent-tint)] text-[var(--pos-accent)] border-[#D6D6D6]">ACC</Badge>}
                                              {item.type === 'PREPAID' && (
                                                 <Badge variant="outline" className={`font-mono text-xs ${
                                                     (item.originalData as Account).prepaidType === 'Water' 
                                                     ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                                                     : 'border-yellow-500 text-yellow-600 bg-yellow-50'
                                                 }`}>
                                                     {(item.originalData as Account).prepaidType === 'Water' ? 'H2O' : 'ELEC'}
                                                 </Badge>
                                              )}
                                              {item.type === 'CLEARANCE' && <Badge variant="outline" className="font-mono text-xs border-amber-500 text-amber-600 bg-amber-50">CLR</Badge>}
                                              {item.type === 'DIRECT_INCOME' && <Badge variant="outline" className="font-mono text-xs border-green-500 text-green-600 bg-green-50">INC</Badge>}
                                              {item.type === 'ACCOUNT_GROUP' && <Badge variant="outline" className="font-mono text-xs border-purple-500 text-purple-600 bg-purple-50">GRP</Badge>}
                                          </div>
                                          <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7 sm:hidden text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                              <Trash2 className="w-4 h-4" />
                                          </Button>
                                      </div>
                                      
                                      <div className="min-w-0 flex flex-col mb-2 sm:mb-0">
                                          <div className="font-medium truncate flex items-center gap-2 text-sm sm:text-base">
                                              {item.description}
                                              {(item.type === 'CONSUMER_SERVICES' || item.type === 'ACCOUNT_GROUP') && (
                                                  <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    tabIndex={-1}
                                                    className="h-6 w-6 text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)]"
                                                    title="View Account Enquiry"
                                                    onClick={() => setViewingItem(item.id)}
                                                  >
                                                      <Search className="w-3.5 h-3.5" />
                                                  </Button>
                                              )}
                                          </div>
                                          <div className="text-xs text-muted-foreground font-mono">{item.reference}</div>
                                      </div>

                                      <div className="flex items-center justify-between sm:block sm:text-right gap-2 mb-2 sm:mb-0">
                                          <span className="text-xs text-muted-foreground sm:hidden">Due:</span>
                                          <span className="font-mono text-[var(--pos-accent)] font-bold text-sm">
                                              {item.amountDue > 0 ? `R ${item.amountDue.toFixed(2)}` : '-'}
                                          </span>
                                      </div>

                                      <div className="flex items-center gap-2 sm:block">
                                          <span className="text-xs text-muted-foreground sm:hidden shrink-0">Pay:</span>
                                          <div className="relative flex-1 sm:flex-none">
                                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">R</span>
                                             <BasketPayAmountInput
                                                value={item.amountToPay}
                                                onChange={(val) => updateItemAmount(item.id, val)}
                                             />
                                          </div>
                                      </div>

                                      <div className="hidden sm:block">
                                          <Button variant="ghost" size="icon" tabIndex={-1} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                              <Trash2 className="w-4 h-4" />
                                          </Button>
                                      </div>
                                  </div>

                                  {item.type === 'DIRECT_INCOME' && (() => {
                                      const incItem = item.originalData as DirectIncomeItem;
                                      const vatRate = incItem?.vatRate || 0;
                                      const isVatable = vatRate > 0;
                                      const totalAmount = item.amountToPay || 0;
                                      const vatAmount = isVatable ? Math.round((totalAmount - totalAmount / (1 + vatRate / 100)) * 100) / 100 : 0;
                                      const amountExVat = Math.round((totalAmount - vatAmount) * 100) / 100;
                                      return (
                                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                                          <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
                                              <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-2">
                                                  <div>
                                                      <Label className="text-[10px] font-semibold text-green-700 uppercase flex items-center gap-1">Initials</Label>
                                                      <Input
                                                          placeholder="e.g. JD"
                                                          className="h-9 rounded-lg text-sm bg-white border-green-200"
                                                          value={item.additionalInfo || ''}
                                                          onChange={(e) => updateItemDetails(item.id, { additionalInfo: e.target.value })}
                                                          data-testid={`input-basket-initials-${item.id}`}
                                                      />
                                                  </div>
                                                  <div>
                                                      <Label className="text-[10px] font-semibold text-green-700 uppercase flex items-center gap-1">Last Name * <HelpTip text="Enter the surname or company name of the person making this payment. Required for audit." /></Label>
                                                      <Input
                                                          placeholder="Surname / Company"
                                                          className={`h-9 rounded-lg text-sm bg-white ${(item as any).paidByError ? 'border-red-400 ring-1 ring-red-400' : 'border-green-200'}`}
                                                          value={item.paidBy || ''}
                                                          onChange={(e) => updateItemDetails(item.id, { paidBy: e.target.value })}
                                                          data-testid={`input-basket-paidby-${item.id}`}
                                                      />
                                                  </div>
                                              </div>
                                              <div>
                                                  <Label className="text-[10px] font-semibold text-green-700 uppercase flex items-center gap-1">Description/Notes * <HelpTip text="Describe what this payment is for. Required for financial records." /></Label>
                                                  <Input
                                                      placeholder="Payment description..."
                                                      className={`h-9 rounded-lg text-sm bg-white ${(item as any).notesError ? 'border-red-400 ring-1 ring-red-400' : 'border-green-200'}`}
                                                      value={item.notes || ''}
                                                      onChange={(e) => updateItemDetails(item.id, { notes: e.target.value })}
                                                      data-testid={`input-basket-notes-${item.id}`}
                                                  />
                                              </div>
                                              {totalAmount > 0 && (
                                                  isVatable ? (
                                                      <div className="grid grid-cols-2 gap-2">
                                                          <div className="bg-white rounded-lg p-2 border border-green-100">
                                                              <div className="text-[10px] text-green-600 font-semibold uppercase">Excl VAT</div>
                                                              <div className="text-sm font-mono font-bold text-green-800">R {amountExVat.toFixed(2)}</div>
                                                          </div>
                                                          <div className="bg-white rounded-lg p-2 border border-green-100">
                                                              <div className="text-[10px] text-green-600 font-semibold uppercase">VAT ({vatRate.toFixed(0)}%)</div>
                                                              <div className="text-sm font-mono font-bold text-green-800">R {vatAmount.toFixed(2)}</div>
                                                          </div>
                                                      </div>
                                                  ) : (
                                                      <div className="bg-white rounded-lg p-2 border border-green-100">
                                                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Not Vatable</div>
                                                      </div>
                                                  )
                                              )}
                                          </div>
                                      </div>
                                      );
                                  })()}

                                  {item.type === 'CLEARANCE' && (
                                      <ClearanceBasketExpander item={item} updateItemDetails={updateItemDetails} updateItemAmount={updateItemAmount} />
                                  )}
                              </div>
                          ))}
                      </CardContent>

                      {totalPages > 1 && (
                        <div className="border-t bg-muted/10 px-3 sm:px-4 py-2.5 flex items-center justify-between sticky bottom-0 z-10">
                          <span className="text-xs text-muted-foreground">
                            {(safePage - 1) * BASKET_PAGE_SIZE + 1}–{Math.min(safePage * BASKET_PAGE_SIZE, displayItems.length)} of {displayItems.length}
                            {showOnlyMissing && ` (filtered)`}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" disabled={safePage <= 1} onClick={() => handlePageChange(1)} data-testid="btn-page-first">
                              <ChevronsLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" disabled={safePage <= 1} onClick={() => handlePageChange(p => Math.max(1, p - 1))} data-testid="btn-page-prev">
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-xs font-medium text-slate-600 px-2 min-w-[60px] text-center">
                              {safePage} / {totalPages}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" disabled={safePage >= totalPages} onClick={() => handlePageChange(p => Math.min(totalPages, p + 1))} data-testid="btn-page-next">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" disabled={safePage >= totalPages} onClick={() => handlePageChange(totalPages)} data-testid="btn-page-last">
                              <ChevronsRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                  </Card>
              </div>
          </div>
      )
  }

  // Single Item Views
  return (
    <div className="flex-1 p-3 sm:p-6 bg-gradient-to-br from-[#F7F7F7] to-[#F7F7F7]"> 
      <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-6"> 
        
        {/* Header Badge */}
        <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {activeTransactionType === 'CONSUMER_SERVICES' && <><span>Consumer Account</span> <HelpTip text="Payment against a municipal consumer account for rates, utilities, and services." /></>}
              {activeTransactionType === 'DIRECT_INCOME' && <><span>Direct Income</span> <HelpTip text="Ad-hoc income not linked to a consumer account, e.g. hall hire, plan fees, or sundry payments." /></>}
              {activeTransactionType === 'CLEARANCE' && <><span>Clearance Certificate</span> <HelpTip text="Payment for a Section 118 clearance certificate required for property transfers." /></>}
              {activeTransactionType === 'PREPAID' && <><span>Prepaid Recharge</span> <HelpTip text="Purchase prepaid electricity or water tokens for a specific meter number." /></>}
            </h2>
            <Badge variant="outline" className="text-sm px-3 py-1 font-mono uppercase">
               {activeTransactionType.replace('_', ' ')}
            </Badge>
        </div>

        {transactionItems.map((item) => (
           <TransactionItemCard key={item.id} item={item} />
        ))}
        
      </div>
    </div>
  );
}

function TransactionItemCard({ item }: { item: TransactionItem }) {
    const { updateItemAmount, updateItemDetails, removeItem } = usePos();
    
    // CONSUMER ACCOUNT CARD -> USE NEW VIEW
    if (item.type === 'CONSUMER_SERVICES' || item.type === 'ACCOUNT_GROUP') {
        return <AccountEnquiryView item={item} />;
    }
    
    // PREPAID CARD
    if (item.type === 'PREPAID') {
        const account = item.originalData as Account;
        const isWater = account.prepaidType === 'Water';
        const [stagedAmount, setStagedAmount] = React.useState<number>(item.amountToPay || 0);

        return (
          <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className={`px-3 sm:px-4 py-2.5 border-b ${isWater ? 'bg-gradient-to-r from-[#F7F7F7] to-[#F7F7F7] border-[#D6D6D6]' : 'bg-gradient-to-r from-amber-50 to-yellow-50/50 border-amber-100'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isWater ? 'bg-[var(--pos-accent)] text-white' : 'bg-amber-500 text-white'}`}>
                  {isWater ? <Droplets className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#2E2E2E]">Prepaid {isWater ? 'Water' : 'Electricity'}</h3>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${isWater ? 'border-[#D6D6D6] text-[var(--pos-accent)] bg-[var(--pos-accent-tint)]' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
                      {isWater ? 'H2O' : 'ELEC'}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Meter: {account.prepaidMeterNo}</div>
                </div>
                <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="px-3 sm:px-4 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#F7F7F7] rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Customer</div>
                  <div className="font-medium text-slate-800 truncate">{account.name}</div>
                </div>
                <div className="bg-[#F7F7F7] rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Address</div>
                  <div className="font-medium text-slate-800 truncate">{account.address || '-'}</div>
                </div>
              </div>

              <div className={`rounded-xl p-3 border ${isWater ? 'bg-[var(--pos-accent-tint)] border-[#D6D6D6]' : 'bg-amber-50/50 border-amber-100'}`}>
                <Label htmlFor={`amount-${item.id}`} className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 block ${isWater ? 'text-[var(--pos-accent)]' : 'text-amber-600'}`}>
                  Recharge Amount
                </Label>
                <div className="relative mb-2">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-mono text-lg font-bold ${isWater ? 'text-[var(--pos-accent)]' : 'text-amber-600'}`}>R</span>
                  <Input 
                    id={`amount-${item.id}`}
                    type="text"
                    inputMode="decimal"
                    className={`pl-10 h-12 text-xl font-mono font-bold bg-white ${isWater ? 'border-[#D6D6D6] focus:border-[var(--pos-accent)] focus:ring-[var(--pos-accent-shadow)]' : 'border-amber-200 focus:border-amber-400 focus:ring-amber-200'}`}
                    value={stagedAmount || ''}
                    placeholder="0.00"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
                        const numVal = parseFloat(raw) || 0;
                        setStagedAmount(numVal);
                        updateItemAmount(item.id, numVal);
                      }
                    }}
                    autoFocus
                    data-testid={`input-amount-${item.id}`}
                  />
                </div>
                <div className="flex gap-1.5">
                  {[50, 100, 200, 500].map(amt => (
                    <button
                      key={amt}
                      tabIndex={-1}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${isWater ? 'bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] hover:bg-[var(--pos-accent-tint-strong)] active:bg-[var(--pos-accent)]' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300'}`}
                      onClick={() => { setStagedAmount(amt); updateItemAmount(item.id, amt); }}
                      data-testid={`button-quick-${amt}-${item.id}`}
                    >
                      R{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
    }

    // CLEARANCE CARD
    if (item.type === 'CLEARANCE') {
        const clr = item.originalData || {};
        const paidItems = clr.paidItems || [];
        const paySection1181Only = clr.paySection1181Only || false;
        const section1181Amount = clr.total1181 ?? 0;
        const section1183Amount = clr.total1183 ?? 0;

        const handlePaySection1181Toggle = (checked: boolean) => {
            const newOrigData = { ...clr, paySection1181Only: checked };
            if (checked) {
                const sec1181Abs = Math.abs(section1181Amount || 0);
                updateItemDetails(item.id, {
                    amountToPay: sec1181Abs,
                    originalData: newOrigData,
                });
            } else {
                updateItemDetails(item.id, {
                    amountToPay: clr.totalDue || item.amountDue,
                    originalData: newOrigData,
                });
            }
        };

        const handlePaidItemAmountChange = (index: number, newAmount: number) => {
            const updatedPaidItems = [...paidItems];
            updatedPaidItems[index] = { ...updatedPaidItems[index], paymentAmount: newAmount };
            const newTotal = updatedPaidItems.reduce((sum: number, pi: any) => sum + (pi.paymentAmount ?? pi.amount ?? 0), 0);
            updateItemDetails(item.id, {
                amountToPay: newTotal,
                originalData: { ...clr, paidItems: updatedPaidItems },
            });
        };

        const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });

        return (
          <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden" data-testid={`card-clearance-${item.id}`}>
            <div className="px-3 sm:px-4 py-2.5 border-b bg-gradient-to-r from-amber-50 to-orange-50/50 border-amber-100">
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#2E2E2E]">Clearance Application</h3>
                    {clr.status && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${clr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-[#F2F4F7] text-slate-600 ring-1 ring-[#D6D6D6]'}`}>
                        {clr.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">ID: {clr.scheduleNo || clr.clearanceId}</div>
                </div>
                <div className="shrink-0 text-right flex items-center gap-1.5">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Due</div>
                    <div className="text-sm font-bold font-mono text-red-600">R {(clr.totalDue || item.amountDue || 0).toFixed(2)}</div>
                  </div>
                  <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)} data-testid={`button-remove-clearance-${item.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-3 sm:px-4 py-3 space-y-3">
              {(clr.ownerName || clr.propertyAddress || clr.sgNumber) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {clr.ownerName && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Owner</div>
                      <div className="font-medium text-slate-800 truncate">{clr.ownerName}</div>
                    </div>
                  )}
                  {(clr.accountID || paidItems[0]?.accountNumber) && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Account</div>
                      <div className="font-medium text-slate-800 font-mono">{paidItems[0]?.accountNumber || clr.accountID}</div>
                    </div>
                  )}
                  {clr.propertyAddress && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2 col-span-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Address</div>
                      <div className="font-medium text-slate-800 truncate">{clr.propertyAddress}</div>
                    </div>
                  )}
                  {clr.sgNumber && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">SG Number</div>
                      <div className="font-medium text-slate-800 font-mono">{clr.sgNumber}</div>
                    </div>
                  )}
                  {clr.expiryDate && (
                    <div className="bg-[#F7F7F7] rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Valid Until</div>
                      <div className="font-medium text-slate-800">{clr.expiryDate}</div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Lines</div>
                <div className="sm:hidden divide-y divide-[#E5E5E5] border border-[#D6D6D6] rounded-lg overflow-hidden">
                  {paidItems.length > 0 ? paidItems.map((pi: any, i: number) => {
                    const costAmount = pi.amount || 0;
                    const payAmount = pi.paymentAmount ?? pi.amount ?? 0;
                    return (
                      <div key={i} className="px-2.5 py-2 bg-white">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-slate-800 truncate">{pi.name || pi.debT_TYPE || 'Line ' + (i+1)}</span>
                          <span className="text-[10px] font-mono text-slate-500">{pi.accountNumber || pi.account_ID || ''}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">Cost: R {costAmount.toFixed(2)}</span>
                          <ClearancePaymentInput
                            value={payAmount}
                            minValue={costAmount}
                            disabled={paySection1181Only}
                            onChange={(val) => handlePaidItemAmountChange(i, val)}
                            className="w-24 h-7 text-right font-mono text-xs"
                            data-testid={`input-clearance-payment-${i}`}
                          />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-3 text-center text-xs text-slate-400">No breakdown available</div>
                  )}
                </div>

                <div className="hidden sm:block overflow-x-auto border border-[#D6D6D6] rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-[#F7F7F7]">
                        <TableHead className="text-xs">Account</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Cost</TableHead>
                        <TableHead className="text-xs text-right">Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidItems.length > 0 ? paidItems.map((pi: any, i: number) => {
                        const costAmount = pi.amount || 0;
                        const payAmount = pi.paymentAmount ?? pi.amount ?? 0;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{pi.accountNumber || pi.account_ID || pi.accountId || 'N/A'}</TableCell>
                            <TableCell className="text-xs">{pi.name || '-'}</TableCell>
                            <TableCell className="text-xs text-slate-500">{pi.debT_TYPE || pi.debtType || '-'}</TableCell>
                            <TableCell className="text-right font-mono text-xs">R {costAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <ClearancePaymentInput
                                value={payAmount}
                                minValue={costAmount}
                                disabled={paySection1181Only}
                                onChange={(val) => handlePaidItemAmountChange(i, val)}
                                className="w-28 h-8 text-right font-mono ml-auto"
                                data-testid={`input-clearance-payment-${i}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 text-xs">No breakdown available</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 col-span-2">
                  <Checkbox
                    id={`pay1181-${item.id}`}
                    checked={paySection1181Only}
                    onCheckedChange={(checked) => handlePaySection1181Toggle(checked === true)}
                    data-testid={`checkbox-pay-section-1181-${item.id}`}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`pay1181-${item.id}`} className="text-xs cursor-pointer font-medium text-slate-700">Pay Section 118(1) Only</Label>
                </div>
                <div className="bg-[var(--pos-accent-tint)] rounded-lg p-2 border border-[#D6D6D6]">
                  <div className="text-[10px] text-[var(--pos-accent)] font-semibold uppercase">Sec 118(1)</div>
                  <div className="text-sm font-mono font-bold text-[#2E2E2E]">R {Number(section1181Amount).toFixed(2)}</div>
                </div>
                <div className="bg-[var(--pos-accent-tint)] rounded-lg p-2 border border-[#D6D6D6]">
                  <div className="text-[10px] text-[var(--pos-accent)] font-semibold uppercase">Sec 118(3)</div>
                  <div className="text-sm font-mono font-bold text-[#2E2E2E]">R {Number(section1183Amount).toFixed(2)}</div>
                </div>
              </div>

              <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-700 uppercase">Total Payment</span>
                  <span className="text-lg font-bold font-mono text-amber-900">R {item.amountToPay.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Receipt Date: {today}</div>
              </div>
            </div>
          </div>
        )
    }

    // DIRECT INCOME / DEFAULT CARD
    if (item.type === 'DIRECT_INCOME') {
        const incomeItem = item.originalData as DirectIncomeItem;
        
        return (
          <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 border-b bg-gradient-to-r from-emerald-50 to-green-50/50 border-emerald-100">
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                  INC
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#2E2E2E] truncate">{item.description}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-mono px-1 py-0 rounded bg-[#F2F4F7] text-slate-600 ring-1 ring-[#D6D6D6]">
                      {(incomeItem.scoaItem || '').replace(/\s+[A-Z]{2}\d{30,}.*$/, '').trim() || incomeItem.scoaItem} · ID: {incomeItem.scoaItemId}
                    </span>
                    <span className="text-[10px] text-slate-500">{incomeItem.groupName}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="px-3 sm:px-4 py-3 space-y-3">
              <div className="rounded-xl p-3 bg-emerald-50/70 border border-emerald-100 space-y-2">
                {(() => {
                  const vatRate = incomeItem.vatRate || 0;
                  const isVatable = vatRate > 0;
                  const totalAmount = item.amountToPay || 0;
                  const vatAmount = isVatable ? Math.round((totalAmount - totalAmount / (1 + vatRate / 100)) * 100) / 100 : 0;
                  const amountExVat = Math.round((totalAmount - vatAmount) * 100) / 100;
                  return (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor={`amount-${item.id}`} className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
                          {isVatable ? 'Amount (incl VAT)' : 'Amount'}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-emerald-600">R</span>
                          <Input 
                            id={`amount-${item.id}`}
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            className="pl-10 h-12 text-xl font-mono font-bold bg-white border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200"
                            value={item.amountToPay || ''} 
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
                                updateItemAmount(item.id, parseFloat(raw) || 0);
                              }
                            }}
                            data-testid={`input-amount-${item.id}`}
                          />
                        </div>
                      </div>
                      {isVatable ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-lg p-2 border border-emerald-100">
                            <div className="text-[10px] text-emerald-500 font-semibold uppercase">Excl VAT</div>
                            <div className="text-sm font-mono font-bold text-emerald-800">R {amountExVat.toFixed(2)}</div>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-emerald-100">
                            <div className="text-[10px] text-emerald-500 font-semibold uppercase">VAT ({vatRate.toFixed(0)}%)</div>
                            <div className="text-sm font-mono font-bold text-emerald-800">R {vatAmount.toFixed(2)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg p-2 border border-emerald-100">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Not Vatable</div>
                          <div className="text-sm font-mono font-bold text-slate-600">No VAT applies</div>
                        </div>
                      )}
                    </>
                  );
                })()}
                <div className="flex gap-1.5">
                  {[50, 100, 200, 500].map(amt => (
                    <button
                      key={amt}
                      tabIndex={-1}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300 transition-colors"
                      onClick={() => updateItemAmount(item.id, amt)}
                      data-testid={`button-quick-${amt}-${item.id}`}
                    >
                      R{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`initials-${item.id}`} className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Initials</Label>
                  <Input 
                    id={`initials-${item.id}`}
                    placeholder="e.g. JD"
                    className="h-9 text-sm bg-[#F7F7F7] border-[#D6D6D6]"
                    value={item.additionalInfo || ''}
                    onChange={(e) => updateItemDetails(item.id, { additionalInfo: e.target.value })}
                    data-testid={`input-initials-${item.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`lastName-${item.id}`} className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></Label>
                  <Input 
                    id={`lastName-${item.id}`}
                    placeholder="Surname / Company"
                    className={`h-9 text-sm bg-[#F7F7F7] border-[#D6D6D6] ${(item as any).paidByError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    value={item.paidBy || ''}
                    onChange={(e) => updateItemDetails(item.id, { paidBy: e.target.value })}
                    data-testid={`input-lastname-${item.id}`}
                  />
                  {(item as any).paidByError && <span className="text-[10px] text-red-500">Required</span>}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`desc-${item.id}`} className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Description <span className="text-red-500">*</span></Label>
                <Textarea 
                  id={`desc-${item.id}`}
                  placeholder="Payment description..."
                  className={`resize-none h-16 text-sm bg-[#F7F7F7] border-[#D6D6D6] ${(item as any).notesError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  value={item.notes || ''}
                  onChange={(e) => updateItemDetails(item.id, { notes: e.target.value })}
                  data-testid={`input-desc-${item.id}`}
                />
                {(item as any).notesError && <span className="text-[10px] text-red-500">Required</span>}
              </div>
            </div>
          </div>
        );
    }

    // Default Fallback
    return (
      <div className="bg-white rounded-xl border border-[#D6D6D6] shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 border-b bg-[#F7F7F7]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#2E2E2E]">{item.description}</h3>
            <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="px-3 sm:px-4 py-3">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-slate-600">R</span>
            <Input 
              type="text"
              inputMode="decimal"
              value={item.amountToPay || ''} 
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
                  updateItemAmount(item.id, parseFloat(raw) || 0);
                }
              }}
              className="pl-10 h-12 text-xl font-mono font-bold"
            />
          </div>
        </div>
      </div>
    );
}