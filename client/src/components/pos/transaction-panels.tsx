import React, { useRef, useState } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Account, ClearanceCostSchedule, DirectIncomeItem } from '@/lib/mock-data';
import { User, MapPin, Phone, Mail, FileCheck, Zap, Trash2, Droplets, Upload, Search, Info, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AccountEnquiryView } from '@/components/pos/account-enquiry-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function TransactionPanels() {
  const { activeTransactionType, transactionItems, removeItem, updateItemAmount, addItem, viewingItemId, setViewingItem } = usePos();
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      let addedCount = 0;
      let failedCount = 0;
      
      lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        // Skip header if detected
        if (index === 0 && line.toLowerCase().includes('account number')) return;

        // Expected format: Date, Account, Amount (or just Account, Amount for backward compat)
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
        
        if (accNo) {
            const amount = parseFloat(amountStr) || 0;
            
            addItem({
                id: crypto.randomUUID(),
                type: 'CONSUMER_SERVICES',
                description: `Account ${accNo} (Import)`,
                reference: accNo,
                amountDue: amount,
                amountToPay: amount, 
                originalData: { accountNo: accNo },
                notes: `CSV Import. Receipt Date: ${receiptDate}`
            }, true); // Allow duplicates
            addedCount++;
        } else {
            failedCount++;
        }
      });

      if (addedCount > 0) {
          toast({
              title: "CSV Import Successful",
              description: `Added ${addedCount} transactions to basket. ${failedCount > 0 ? `(${failedCount} failed)` : ''}`,
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
              <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-100/50">
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
        <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
           <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Ready to Receipt</h2>
        <p className="max-w-md text-center">Use the search bar above to find an account, prepaid meter, clearance schedule, or direct income item.</p>
        
        <div className="mt-8 flex gap-4">
             <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                 <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
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
                    
                    <div className="bg-slate-50 p-4 rounded-md border text-sm space-y-3">
                        <div className="font-semibold text-slate-700">Required CSV Format:</div>
                        <div className="bg-white border rounded p-2 font-mono text-xs text-slate-600">
                            Receipt Date, Account Number, Amount
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Example:<br/>
                            2023-10-25, 000000000030, 150.00<br/>
                            2023-10-25, ACC-1002, 200.50
                        </div>
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                            <Info className="w-4 h-4" />
                            Duplicate accounts allowed (e.g. multiple receipts for same account).
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between gap-2">
                         <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-muted-foreground">
                             <Download className="w-4 h-4" />
                             Download Template
                         </Button>
                         <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                             <FileText className="w-4 h-4" />
                             Select File
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
                                
                                <div className="bg-slate-50 p-4 rounded-md border text-sm space-y-3">
                                    <div className="font-semibold text-slate-700">Required CSV Format:</div>
                                    <div className="bg-white border rounded p-2 font-mono text-xs text-slate-600">
                                        Receipt Date, Account Number, Amount
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Example:<br/>
                                        2023-10-25, 000000000030, 150.00<br/>
                                        2023-10-25, ACC-1002, 200.50
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-100">
                                        <Info className="w-4 h-4" />
                                        Duplicate accounts allowed (e.g. multiple receipts for same account).
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-between gap-2">
                                     <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-muted-foreground">
                                         <Download className="w-4 h-4" />
                                         Download Template
                                     </Button>
                                     <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                                         <FileText className="w-4 h-4" />
                                         Select File
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
                              <div>Type</div>
                              <div>Description / Ref</div>
                              <div className="text-right">Amount Due</div>
                              <div className="text-right">Pay Amount</div>
                              <div className="w-8"></div>
                          </div>
                          <div className="sm:hidden font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              Items in Basket
                          </div>
                      </CardHeader>
                      <CardContent className="p-0">
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
                            .map((item) => (
                              <div key={item.id} className="sm:grid sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:gap-4 sm:items-center p-3 sm:p-4 border-b last:border-0 hover:bg-muted/5 transition-colors">
                                  <div className="flex items-center justify-between sm:justify-start gap-2 mb-2 sm:mb-0">
                                      <div className="flex items-center gap-2">
                                          {item.type === 'CONSUMER_SERVICES' && <Badge variant="secondary" className="font-mono text-xs">ACC</Badge>}
                                          {item.type === 'PREPAID' && (
                                             <Badge variant="outline" className={`font-mono text-xs ${
                                                 (item.originalData as Account).prepaidType === 'Water' 
                                                 ? 'border-blue-500 text-blue-600 bg-blue-50'
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
                                          {item.type === 'CONSUMER_SERVICES' && (
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
                                      <span className="font-mono text-muted-foreground text-sm">
                                          {item.amountDue > 0 ? `R ${item.amountDue.toFixed(2)}` : '-'}
                                      </span>
                                  </div>

                                  <div className="flex items-center gap-2 sm:block">
                                      <span className="text-xs text-muted-foreground sm:hidden shrink-0">Pay:</span>
                                      <div className="relative flex-1 sm:flex-none">
                                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">R</span>
                                         <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            className="h-9 pl-6 text-right font-mono"
                                            value={item.amountToPay}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val && parseFloat(val) < 0) return;
                                                if (val.includes('.') && val.split('.')[1].length > 2) return;
                                                updateItemAmount(item.id, parseFloat(val) || 0);
                                            }}
                                         />
                                      </div>
                                  </div>

                                  <div className="hidden sm:block">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                          <Trash2 className="w-4 h-4" />
                                      </Button>
                                  </div>
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
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-gray-100/50"> 
      <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-6"> 
        
        {/* Header Badge */}
        <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              {activeTransactionType === 'CONSUMER_SERVICES' && 'Consumer Account'}
              {activeTransactionType === 'DIRECT_INCOME' && 'Direct Income'}
              {activeTransactionType === 'CLEARANCE' && 'Clearance Certificate'}
              {activeTransactionType === 'PREPAID' && 'Prepaid Recharge'}
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
    if (item.type === 'CONSUMER_SERVICES') {
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
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className={`pl-10 text-2xl font-mono font-bold h-14 bg-white focus-visible:ring-2 ${isWater ? 'border-blue-200 focus-visible:ring-blue-400' : 'border-yellow-200 focus-visible:ring-yellow-400'}`}
                                    value={stagedAmount || ''} 
                                    placeholder="0.00"
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val && parseFloat(val) < 0) return;
                                        if (val.includes('.') && val.split('.')[1].length > 2) return;
                                        const numVal = parseFloat(val) || 0;
                                        setStagedAmount(numVal);
                                        // Auto-update item if already staged
                                        if (showBreakdown) {
                                            updateItemAmount(item.id, numVal);
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
        const hasOldFormat = clr.section118_1_Breakdown || clr.section118_3_Breakdown;
        return (
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
                 <CardHeader className="pb-3 bg-amber-500/5">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                                <FileCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Clearance Application</CardTitle>
                                <p className="text-sm text-muted-foreground font-mono mt-1">{clr.scheduleNo || clr.clearanceId}</p>
                            </div>
                        </div>
                         <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Cost</div>
                            <div className="text-xl font-mono font-bold text-foreground">R {(clr.totalDue || item.amountToPay || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div>
                        <h4 className="font-medium mb-3 text-sm">Linked Accounts Breakdown</h4>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Account</TableHead>
                                    <TableHead>Name / Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paidItems.length > 0 ? paidItems.map((pi: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-mono text-xs">{pi.accountNumber || pi.accountId || 'N/A'}</TableCell>
                                        <TableCell className="text-muted-foreground">{pi.name || pi.debtType || '-'}</TableCell>
                                        <TableCell className="text-right font-mono">R {(pi.paymentAmount || pi.amount || 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                )) : hasOldFormat ? (
                                    <>
                                        {(clr.section118_1_Breakdown || []).map((row: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-xs">{clr.linkedAccounts?.[0]?.accountNo || 'N/A'}</TableCell>
                                                <TableCell className="text-muted-foreground">{row.item}</TableCell>
                                                <TableCell className="text-right font-mono">R {(row.amount || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {(clr.section118_3_Breakdown || []).map((row: any, i: number) => (
                                            <TableRow key={`hist-${i}`}>
                                                <TableCell className="font-mono text-xs">{clr.linkedAccounts?.[0]?.accountNo || 'N/A'}</TableCell>
                                                <TableCell className="text-muted-foreground">{row.item} (Sec 118(3))</TableCell>
                                                <TableCell className="text-right font-mono">R {(row.amount || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">No account breakdown available</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                         <div className="flex items-center justify-between">
                             <Label className="text-amber-900 font-medium">Clearance Payment Total</Label>
                             <div className="font-mono text-xl font-bold text-amber-900">R {item.amountToPay.toFixed(2)}</div>
                         </div>
                         <p className="text-xs text-amber-700/80 mt-1">Full payment required for clearance figures issuance.</p>
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
                     <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor={`desc-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description / Notes <span className="text-red-500">*</span></Label>
                                <Textarea 
                                    id={`desc-${item.id}`}
                                    placeholder="Enter additional details about this payment..."
                                    className={`resize-none h-20 bg-slate-50 border-slate-200 ${(item as any).notesError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                    value={item.notes || ''}
                                    onChange={(e) => updateItemDetails(item.id, { notes: e.target.value })}
                                />
                                {(item as any).notesError && (
                                    <span className="text-[10px] text-red-500 font-medium">This field is required</span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor={`paidBy-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid By (Name/Company) <span className="text-red-500">*</span></Label>
                                    <Input 
                                        id={`paidBy-${item.id}`}
                                        placeholder="e.g. John Doe Construction"
                                        className={`bg-slate-50 border-slate-200 ${(item as any).paidByError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                        value={item.paidBy || ''}
                                        onChange={(e) => {
                                            updateItemDetails(item.id, { paidBy: e.target.value });
                                            // Clear error if present
                                            if ((item as any).paidByError) {
                                                // We can't clear error directly via updateItemDetails unless we add error field to type
                                                // So we just update the value for now, validation happens on Complete
                                            }
                                        }}
                                    />
                                    {(item as any).paidByError && (
                                        <span className="text-[10px] text-red-500 font-medium">This field is required</span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor={`info-${item.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Information</Label>
                                    <Input 
                                        id={`info-${item.id}`}
                                        placeholder="Reference / Permit No."
                                        className="bg-slate-50 border-slate-200"
                                        value={item.additionalInfo || ''}
                                        onChange={(e) => updateItemDetails(item.id, { additionalInfo: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[280px] p-6 rounded-lg bg-green-50 border border-green-100 flex flex-col justify-center space-y-4">
                            <Label htmlFor={`amount-${item.id}`} className="font-medium text-lg text-green-900">Payment Amount</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl text-green-700">R</span>
                                <Input 
                                    id={`amount-${item.id}`}
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className="pl-10 text-2xl font-mono font-bold h-14 bg-white border-green-200 focus-visible:ring-green-400 focus-visible:ring-2"
                                    value={item.amountToPay || ''} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val && parseFloat(val) < 0) return;
                                        if (val.includes('.') && val.split('.')[1].length > 2) return;
                                        updateItemAmount(item.id, parseFloat(val) || 0);
                                    }}
                                />
                            </div>
                            <div className="flex gap-2">
                                {[50, 100, 200, 500].map(amt => (
                                    <Button 
                                        key={amt} 
                                        variant="outline" 
                                        size="sm" 
                                        className="flex-1 bg-white hover:bg-green-100 border-green-200 text-green-800 transition-colors"
                                        onClick={() => updateItemAmount(item.id, amt)}
                                    >
                                        R{amt}
                                    </Button>
                                ))}
                            </div>
                        </div>
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
                        type="number" 
                        min="0"
                        step="0.01"
                        value={item.amountToPay} 
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val && parseFloat(val) < 0) return;
                            if (val.includes('.') && val.split('.')[1].length > 2) return;
                            updateItemAmount(item.id, parseFloat(val) || 0);
                        }}
                        className="max-w-[200px]"
                    />
                 </div>
            </CardContent>
        </Card>
    );
}