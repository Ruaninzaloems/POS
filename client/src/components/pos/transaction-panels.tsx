import React, { useRef, useState } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Account, ClearanceCostSchedule, DirectIncomeItem, fetchEnquiryResults } from '@/lib/external-api';
import { User, MapPin, Phone, Mail, FileCheck, Zap, Trash2, Droplets, Upload, Search, Info, Download, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
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

function BasketPayAmountInput({ value, onChange, className = '' }: { value: number; onChange: (val: number) => void; className?: string }) {
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
            className={`h-9 pl-6 text-right font-mono rounded-lg focus:ring-2 focus:ring-blue-200 ${className}`}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
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

export function TransactionPanels() {
  const { activeTransactionType, transactionItems, removeItem, updateItemAmount, updateItemDetails, addItem, viewingItemId, setViewingItem } = usePos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleDownloadTemplate = () => {
      const csvContent = "Receipt Date,Account Number,Amount\n2023-10-25,000000000030,150.00\n2023-10-25,ACC-1002,200.50";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "receipt_import_template.csv");
      link.style.display = 'none';
      (document.body || document.documentElement).appendChild(link);
      link.click();
      link.remove();
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
                status: item.statusDesc || 'Active',
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
              <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/30">
                  <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-6">
                      <AccountEnquiryView item={item} />
                  </div>
              </div>
          );
      }
  }

  if (activeTransactionType === 'NONE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4 sm:p-8">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
           <svg className="w-10 h-10 opacity-70 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-800">Ready to Receipt</h2>
        <p className="max-w-md text-center">Use the search bar above to find an account, prepaid meter, clearance schedule, or direct income item.</p>
        
        <div className="mt-8 flex gap-4">
             <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                 <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 rounded-xl">
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
                    
                    <div className="bg-blue-50/50 border-blue-100 p-4 rounded-md border text-sm space-y-3">
                        <div className="font-semibold text-slate-700 flex items-center gap-1">Required CSV Format: <HelpTip text="Your CSV file must have 3 columns in this exact order. The first row (header) is automatically skipped." /></div>
                        <div className="bg-white rounded-xl border border-blue-200 p-2 font-mono text-xs text-slate-600">
                            Receipt Date, Account Number, Amount
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Example:<br/>
                            2023-10-25, 000000000030, 150.00<br/>
                            2023-10-25, ACC-1002, 200.50
                        </div>
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                            <Info className="w-4 h-4" />
                            Duplicate accounts allowed (e.g. multiple receipts for same account). <HelpTip text="Each row creates a separate transaction. You can import multiple payments for the same account number." icon="info" />
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between gap-2">
                         <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                             <Download className="w-4 h-4" />
                             Download Template
                         </Button>
                         <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" disabled={importingCSV}>
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
    );
  }

  // Multi-Account / Basket View
  if (activeTransactionType === 'MULTI_ACCOUNT') {
      return (
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-muted/10">
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
                                
                                <div className="bg-blue-50/50 border-blue-100 p-4 rounded-md border text-sm space-y-3">
                                    <div className="font-semibold text-slate-700 flex items-center gap-1">Required CSV Format: <HelpTip text="Your CSV file must have 3 columns in this exact order. The first row (header) is automatically skipped." /></div>
                                    <div className="bg-white rounded-xl border border-blue-200 p-2 font-mono text-xs text-slate-600">
                                        Receipt Date, Account Number, Amount
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Example:<br/>
                                        2023-10-25, 000000000030, 150.00<br/>
                                        2023-10-25, ACC-1002, 200.50
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                                        <Info className="w-4 h-4" />
                                        Duplicate accounts allowed (e.g. multiple receipts for same account). <HelpTip text="Each row creates a separate transaction. You can import multiple payments for the same account number." icon="info" />
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-between gap-2">
                                     <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                         <Download className="w-4 h-4" />
                                         Download Template
                                     </Button>
                                     <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" disabled={importingCSV}>
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

                  <Card>
                      <CardHeader className="py-3 sm:py-4 border-b bg-muted/20">
                          <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              <div className="flex items-center gap-1">Type <HelpTip text="Transaction category: ACC=Account, ELEC/H2O=Prepaid, CLR=Clearance, INC=Direct Income, GRP=Group" /></div>
                              <div>Description / Ref</div>
                              <div className="text-right flex items-center justify-end gap-1">Amount Due <HelpTip text="The outstanding balance on this account or the cost of this item" /></div>
                              <div className="text-right flex items-center justify-end gap-1">Pay Amount <HelpTip text="The amount you want to pay now. You can pay less than the full amount due." /></div>
                              <div className="w-8"></div>
                          </div>
                          <div className="sm:hidden font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              Items in Basket
                          </div>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-0">
                          {transactionItems
                            .sort((a, b) => {
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
                            })
                            .map((item, idx, arr) => (
                              <div key={item.id} className={`rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all ${idx < arr.length - 1 ? 'mb-2' : ''}`}>
                                  <div className="sm:grid sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:gap-4 sm:items-center p-3 sm:p-4">
                                      <div className="flex items-center justify-between sm:justify-start gap-2 mb-2 sm:mb-0">
                                          <div className="flex items-center gap-2">
                                              {item.type === 'CONSUMER_SERVICES' && <Badge variant="secondary" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">ACC</Badge>}
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
                                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:hidden text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
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
                                                    className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
                                          <span className="font-mono text-blue-700 font-bold text-sm">
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
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                              <Trash2 className="w-4 h-4" />
                                          </Button>
                                      </div>
                                  </div>

                                  {item.type === 'DIRECT_INCOME' && (
                                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                                          <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  <div>
                                                      <Label className="text-[10px] font-semibold text-green-700 uppercase flex items-center gap-1">Paid By (Last Name) * <HelpTip text="Enter the surname or company name of the person making this payment. Required for audit." /></Label>
                                                      <Input
                                                          placeholder="Surname / Company"
                                                          className={`h-9 rounded-lg text-sm bg-white ${(item as any).paidByError ? 'border-red-400 ring-1 ring-red-400' : 'border-green-200'}`}
                                                          value={item.paidBy || ''}
                                                          onChange={(e) => updateItemDetails(item.id, { paidBy: e.target.value })}
                                                          data-testid={`input-basket-paidby-${item.id}`}
                                                      />
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
                                              </div>
                                          </div>
                                      </div>
                                  )}

                                  {item.type === 'CLEARANCE' && (
                                      <ClearanceBasketExpander item={item} updateItemDetails={updateItemDetails} updateItemAmount={updateItemAmount} />
                                  )}
                              </div>
                          ))}
                      </CardContent>
                  </Card>
              </div>
          </div>
      )
  }

  // Single Item Views
  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/30"> 
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
        const [showBreakdown, setShowBreakdown] = React.useState(false);
        const [stagedAmount, setStagedAmount] = React.useState<number>(item.amountToPay || 0);

        // Mock sliding scale logic
        const calculateBreakdown = (amount: number) => {
            if (amount <= 0) return null;
            
            // Remove VAT (15%) to get base amount
            const vatRate = 0.15;
            const vatAmount = amount * (vatRate / (1 + vatRate));
            const baseAmount = amount - vatAmount;
            
            // Fixed charges
            const fixedCharge = 0; // Could be dynamic
            const amountForUnits = baseAmount - fixedCharge;
            
            // Sliding scale (simplified)
            // Block 1: R1.50/unit
            // Block 2: R2.10/unit (> 350 units)
            
            const rate1 = 1.50;
            const rate2 = 2.10;
            const block1Limit = 350;
            
            let units = 0;
            let block1Units = 0;
            let block1Cost = 0;
            let block2Units = 0;
            let block2Cost = 0;
            
            const maxBlock1Cost = block1Limit * rate1;
            
            if (amountForUnits <= maxBlock1Cost) {
                block1Units = amountForUnits / rate1;
                block1Cost = amountForUnits;
            } else {
                block1Units = block1Limit;
                block1Cost = maxBlock1Cost;
                
                const remaining = amountForUnits - maxBlock1Cost;
                block2Units = remaining / rate2;
                block2Cost = remaining;
            }
            
            units = block1Units + block2Units;
            
            return {
                amount,
                vatAmount,
                fixedCharge,
                block1: { units: block1Units, rate: rate1, cost: block1Cost },
                block2: { units: block2Units, rate: rate2, cost: block2Cost },
                totalUnits: units
            };
        };

        const breakdown = showBreakdown ? calculateBreakdown(stagedAmount) : null;

        const handleStage = () => {
             updateItemAmount(item.id, stagedAmount);
             setShowBreakdown(true);
        };

        return (
             <Card className={`border-l-4 shadow-sm ${isWater ? 'border-l-blue-400' : 'border-l-yellow-400'}`}>
                <CardHeader className={`pb-3 ${isWater ? 'bg-blue-400/10' : 'bg-yellow-400/10'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isWater ? 'bg-blue-400/20 text-blue-700' : 'bg-yellow-400/20 text-yellow-700'}`}>
                                {isWater ? <Droplets className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                            </div>
                            <div>
                                <CardTitle className="text-lg">Prepaid {isWater ? 'Water' : 'Electricity'}</CardTitle>
                                <p className="text-sm text-muted-foreground font-mono mt-1">Meter: {account.prepaidMeterNo}</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Customer</Label>
                                <div className="font-medium">{account.name}</div>
                                <div className="text-sm text-muted-foreground">{account.address}</div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Last Purchase</Label>
                                <div className="font-medium font-mono">2023-10-15 (R 200.00)</div>
                            </div>
                            
                            {breakdown && (
                                <div className="mt-4 bg-slate-50 p-4 rounded-md border text-sm">
                                    <h4 className="font-semibold mb-2">Estimated Units Breakdown</h4>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span>Block 1 (0-350 @ R{breakdown.block1.rate.toFixed(2)})</span>
                                            <span>{breakdown.block1.units.toFixed(1)} kWh</span>
                                        </div>
                                        {breakdown.block2.units > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span>Block 2 (&gt;350 @ R{breakdown.block2.rate.toFixed(2)})</span>
                                                <span>{breakdown.block2.units.toFixed(1)} kWh</span>
                                            </div>
                                        )}
                                        <div className="border-t my-2"></div>
                                        <div className="flex justify-between font-medium">
                                            <span>Total Estimated Units</span>
                                            <span>{breakdown.totalUnits.toFixed(1)} kWh</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>VAT (15%)</span>
                                            <span>R {breakdown.vatAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`p-6 rounded-lg border flex flex-col justify-center space-y-4 ${isWater ? 'bg-blue-50 border-blue-100' : 'bg-yellow-50 border-yellow-100'}`}>
                            <Label htmlFor={`amount-${item.id}`} className={`font-medium text-lg ${isWater ? 'text-blue-900' : 'text-yellow-900'}`}>Recharge Amount</Label>
                            <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl ${isWater ? 'text-blue-700' : 'text-yellow-700'}`}>R</span>
                                <Input 
                                    id={`amount-${item.id}`}
                                    type="text"
                                    inputMode="decimal"
                                    className={`pl-10 text-2xl font-mono font-bold h-14 bg-white focus-visible:ring-2 ${isWater ? 'border-blue-200 focus-visible:ring-blue-400' : 'border-yellow-200 focus-visible:ring-yellow-400'}`}
                                    value={stagedAmount || ''} 
                                    placeholder="0.00"
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '' || raw === '.' || /^\d*\.?\d{0,2}$/.test(raw)) {
                                            const numVal = parseFloat(raw) || 0;
                                            setStagedAmount(numVal);
                                            if (showBreakdown) {
                                                updateItemAmount(item.id, numVal);
                                            }
                                        }
                                    }}
                                    autoFocus
                                />
                            </div>
                            <Button 
                                className={`w-full font-bold h-10 ${isWater ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}`}
                                onClick={handleStage}
                            >
                                Stage Transaction & Calculate Units
                            </Button>
                            
                            <div className="flex gap-2 mt-2">
                                {[50, 100, 200, 500].map(amt => (
                                    <Button 
                                        key={amt} 
                                        variant="outline" 
                                        size="sm" 
                                        className={`flex-1 bg-white transition-colors ${isWater ? 'hover:bg-blue-100 border-blue-200 text-blue-800' : 'hover:bg-yellow-100 border-yellow-200 text-yellow-800'}`}
                                        onClick={() => {
                                            setStagedAmount(amt);
                                            updateItemAmount(item.id, amt);
                                            setShowBreakdown(true);
                                        }}
                                    >
                                        R{amt}
                                    </Button>
                                ))}
                            </div>
                        </div>
                     </div>
                </CardContent>
             </Card>
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

        const today = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit' });

        return (
            <Card className="border-l-4 border-l-amber-500 shadow-sm" data-testid={`card-clearance-${item.id}`}>
                 <CardHeader className="pb-3 bg-amber-500/5">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                                <FileCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Clearance Application</CardTitle>
                                <p className="text-sm text-muted-foreground font-mono mt-1">Clearance ID: {clr.scheduleNo || clr.clearanceId}</p>
                            </div>
                        </div>
                         <div className="text-right">
                            {clr.status && (
                                <Badge variant="outline" className={`mb-1 font-mono text-xs ${clr.status === 'Approved' ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-400 text-gray-600'}`}>
                                    {clr.status}
                                </Badge>
                            )}
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Amount Due</div>
                            <div className="text-xl font-mono font-bold text-foreground">R {(clr.totalDue || item.amountDue || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {(clr.ownerName || clr.propertyAddress || clr.sgNumber || clr.expiryDate) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            {clr.ownerName && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Name</div>
                                    <div className="text-sm font-medium">{clr.ownerName}</div>
                                </div>
                            )}
                            {(clr.accountID || paidItems[0]?.accountNumber) && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Account Number</div>
                                    <div className="text-sm font-mono">{paidItems[0]?.accountNumber || clr.accountID}</div>
                                </div>
                            )}
                            {clr.propertyAddress && (
                                <div className="sm:col-span-2">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Address</div>
                                    <div className="text-sm">{clr.propertyAddress}</div>
                                </div>
                            )}
                            {clr.sgNumber && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">SG Number</div>
                                    <div className="text-sm font-mono">{clr.sgNumber}</div>
                                </div>
                            )}
                            {clr.expiryDate && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Clearance Valid Date</div>
                                    <div className="text-sm">{clr.expiryDate}</div>
                                </div>
                            )}
                            {clr.clearanceTotal != null && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Cost</div>
                                    <div className="text-sm font-mono font-bold">R {Number(clr.clearanceTotal).toFixed(2)}</div>
                                </div>
                            )}
                            {clr.totalPaid != null && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Paid Amount</div>
                                    <div className="text-sm font-mono font-bold text-green-700">R {Number(clr.totalPaid).toFixed(2)}</div>
                                </div>
                            )}
                            {clr.totalRemaining != null && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Remaining Amount</div>
                                    <div className="text-sm font-mono font-bold text-red-600">R {Number(clr.totalRemaining).toFixed(2)}</div>
                                </div>
                            )}
                            {clr.status && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Clearance Status</div>
                                    <div className="text-sm font-medium">{clr.status}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-sm">Payment</h4>
                            <p className="text-xs text-amber-600 italic">Any account with a payment amount of zero (0) will be ignored</p>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-slate-50">
                                    <TableHead>Account Number</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Clearance Type</TableHead>
                                    <TableHead className="text-right">Cost Schedule Amount</TableHead>
                                    <TableHead className="text-right">Payment Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paidItems.length > 0 ? paidItems.map((pi: any, i: number) => {
                                    const costAmount = pi.amount || 0;
                                    const payAmount = pi.paymentAmount ?? pi.amount ?? 0;
                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs">{pi.accountNumber || pi.account_ID || pi.accountId || 'N/A'}</TableCell>
                                            <TableCell>{pi.name || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{pi.debT_TYPE || pi.debtType || '-'}</TableCell>
                                            <TableCell className="text-right font-mono">R {costAmount.toFixed(2)}</TableCell>
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
                                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">No account breakdown available</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
                        <h4 className="font-medium text-sm border-b pb-2">Information</h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground w-28 shrink-0">Receipt Date</Label>
                                <div className="text-sm font-mono bg-white border rounded px-3 py-1.5 flex-1">{today}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id={`pay1181-${item.id}`}
                                        checked={paySection1181Only}
                                        onCheckedChange={(checked) => handlePaySection1181Toggle(checked === true)}
                                        data-testid={`checkbox-pay-section-1181-${item.id}`}
                                    />
                                    <Label htmlFor={`pay1181-${item.id}`} className="text-sm cursor-pointer">Pay Section 118(1) Only</Label>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground w-28 shrink-0">Total Amount</Label>
                                <div className="text-sm font-mono font-bold bg-amber-50 border border-amber-200 rounded px-3 py-1.5 flex-1">
                                    R {item.amountToPay.toFixed(2)}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground w-36 shrink-0">Section 118(1) Amount</Label>
                                <div className={`text-sm font-mono font-bold rounded px-3 py-1.5 flex-1 ${section1181Amount < 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200'}`}>
                                    R {Number(section1181Amount).toFixed(2)}
                                </div>
                            </div>
                            <div />
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground w-36 shrink-0">Section 118(3) Amount</Label>
                                <div className="text-sm font-mono font-bold bg-blue-50 border border-blue-200 rounded px-3 py-1.5 flex-1">
                                    R {Number(section1183Amount).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // DIRECT INCOME / DEFAULT CARD
    if (item.type === 'DIRECT_INCOME') {
        const incomeItem = item.originalData as DirectIncomeItem;
        
        return (
            <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardHeader className="pb-3 bg-green-500/5">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                                <Badge variant="outline" className="border-green-500 text-green-700 bg-white font-mono">INC</Badge>
                            </div>
                            <div>
                                <CardTitle className="text-lg">{item.description}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="font-mono text-xs bg-slate-100 text-slate-600 border border-slate-200">
                                        SCOA Item: {incomeItem.scoaItem}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{incomeItem.groupName}</span>
                                </div>
                            </div>
                        </div>
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removeItem(item.id)}
                            title="Remove Item"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor={`lastName-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Name <span className="text-red-500">*</span></Label>
                            <Input 
                                id={`lastName-${item.id}`}
                                placeholder="Surname / Company name"
                                className={`bg-slate-50 border-slate-200 ${(item as any).paidByError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                value={item.paidBy || ''}
                                onChange={(e) => updateItemDetails(item.id, { paidBy: e.target.value })}
                                data-testid={`input-lastname-${item.id}`}
                            />
                            {(item as any).paidByError && (
                                <span className="text-[10px] text-red-500 font-medium">This field is required</span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`initials-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Initials</Label>
                            <Input 
                                id={`initials-${item.id}`}
                                placeholder="e.g. JD"
                                className="bg-slate-50 border-slate-200"
                                value={item.additionalInfo || ''}
                                onChange={(e) => updateItemDetails(item.id, { additionalInfo: e.target.value })}
                                data-testid={`input-initials-${item.id}`}
                            />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <Label htmlFor={`desc-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description <span className="text-red-500">*</span></Label>
                        <Textarea 
                            id={`desc-${item.id}`}
                            placeholder="Enter description of this payment..."
                            className={`resize-none h-20 bg-slate-50 border-slate-200 ${(item as any).notesError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            value={item.notes || ''}
                            onChange={(e) => updateItemDetails(item.id, { notes: e.target.value })}
                            data-testid={`input-desc-${item.id}`}
                        />
                        {(item as any).notesError && (
                            <span className="text-[10px] text-red-500 font-medium">This field is required</span>
                        )}
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SCOA Item</Label>
                            <div className="text-sm font-mono bg-slate-50 border rounded px-3 py-2">{incomeItem.scoaItem || '-'}</div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group</Label>
                            <div className="text-sm bg-slate-50 border rounded px-3 py-2">{incomeItem.groupName || '-'}</div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-green-50 border border-green-100">
                        <div className="space-y-2">
                            <Label htmlFor={`amount-${item.id}`} className="text-xs font-semibold text-green-700 uppercase tracking-wider">Amount (excl VAT)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-green-700">R</span>
                                <Input 
                                    id={`amount-${item.id}`}
                                    type="text"
                                    inputMode="decimal"
                                    className="pl-8 text-lg font-mono font-bold h-12 bg-white border-green-200 focus-visible:ring-green-400"
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
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-green-700 uppercase tracking-wider">VAT Amount ({((incomeItem.vatRate || 0) * 100).toFixed(0)}%)</Label>
                            <div className="text-lg font-mono font-bold h-12 bg-white border border-green-200 rounded flex items-center px-3 text-green-800">
                                R {((item.amountToPay || 0) * (incomeItem.vatRate || 0)).toFixed(2)}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-green-700 uppercase tracking-wider">Total Amount (incl VAT)</Label>
                            <div className="text-lg font-mono font-bold h-12 bg-green-100 border-2 border-green-300 rounded flex items-center px-3 text-green-900">
                                R {((item.amountToPay || 0) * (1 + (incomeItem.vatRate || 0))).toFixed(2)}
                            </div>
                        </div>
                     </div>

                     <div className="flex flex-wrap gap-2">
                        {[50, 100, 200, 500].map(amt => (
                            <Button 
                                key={amt} 
                                variant="outline" 
                                size="sm" 
                                className="bg-white hover:bg-green-100 border-green-200 text-green-800"
                                onClick={() => updateItemAmount(item.id, amt)}
                                data-testid={`button-quick-${amt}-${item.id}`}
                            >
                                R{amt}
                            </Button>
                        ))}
                     </div>
                </CardContent>
            </Card>
        );
    }

    // Default Fallback
    return (
        <Card>
            <CardHeader>
                <CardTitle>{item.description}</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="flex gap-4 items-center">
                    <Label>Amount:</Label>
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
                        className="max-w-[200px]"
                    />
                 </div>
            </CardContent>
        </Card>
    );
}