import React, { useRef } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Account, ClearanceCostSchedule, ACCOUNTS } from '@/lib/mock-data';
import { User, MapPin, Phone, Mail, FileCheck, Zap, Trash2, Droplets, Upload, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AccountEnquiryView } from '@/components/pos/account-enquiry-view';

export function TransactionPanels() {
  const { activeTransactionType, transactionItems, removeItem, updateItemAmount, addItem, viewingItemId, setViewingItem } = usePos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      let addedCount = 0;
      
      lines.forEach(line => {
        const [accNo, amountStr] = line.split(',').map(s => s.trim());
        if (!accNo) return;
        
        const account = ACCOUNTS.find(a => a.accountNo === accNo);
        if (account) {
            const amount = parseFloat(amountStr) || account.outstandingAmount;
            
            addItem({
                id: crypto.randomUUID(),
                type: 'CONSUMER_SERVICES',
                description: `${account.name} (CSV Import)`,
                reference: account.accountNo,
                amountDue: account.outstandingAmount,
                amountToPay: amount, 
                originalData: account
            });
            addedCount++;
        }
      });

      if (addedCount > 0) {
          toast({
              title: "CSV Import Successful",
              description: `Added ${addedCount} accounts to basket.`,
              variant: "default"
          });
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
              <div className="flex-1 p-6 overflow-y-auto bg-gray-100/50">
                  <div className="max-w-[1200px] mx-auto space-y-6">
                      <AccountEnquiryView item={item} />
                  </div>
              </div>
          );
      }
  }

  if (activeTransactionType === 'NONE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
           <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Ready to Receipt</h2>
        <p className="max-w-md text-center">Use the search bar above to find an account, prepaid meter, clearance schedule, or direct income item.</p>
        
        <div className="mt-8 flex gap-4">
             <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                 <Upload className="w-4 h-4" />
                 Import CSV
             </Button>
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
          <div className="flex-1 p-6 overflow-y-auto bg-muted/10">
              <div className="max-w-5xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Multi-Account Basket</h2>
                        <Badge variant="outline" className="text-sm px-3 py-1 font-mono uppercase bg-primary/10 text-primary border-primary/20">
                            Mixed Transaction
                        </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                         <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                             <Upload className="w-4 h-4" />
                             Import CSV
                         </Button>
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
                      <CardHeader className="py-4 border-b bg-muted/20">
                          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 font-medium text-sm text-muted-foreground uppercase tracking-wider px-2">
                              <div>Type</div>
                              <div>Description / Ref</div>
                              <div className="text-right">Amount Due</div>
                              <div className="text-right">Pay Amount</div>
                              <div className="w-8"></div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-0">
                          {transactionItems.map((item) => (
                              <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 items-center p-4 border-b last:border-0 hover:bg-muted/5 transition-colors">
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
                                  
                                  <div className="min-w-0 flex flex-col">
                                      <div className="font-medium truncate flex items-center gap-2">
                                          {item.description}
                                          {item.type === 'CONSUMER_SERVICES' && (
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-50 ml-2"
                                                title="View Account Enquiry"
                                                onClick={() => setViewingItem(item.id)}
                                              >
                                                  <Search className="w-3.5 h-3.5" />
                                              </Button>
                                          )}
                                      </div>
                                      <div className="text-xs text-muted-foreground font-mono">{item.reference}</div>
                                  </div>

                                  <div className="text-right font-mono text-muted-foreground">
                                      {item.amountDue > 0 ? `R ${item.amountDue.toFixed(2)}` : '-'}
                                  </div>

                                  <div className="relative">
                                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">R</span>
                                     <Input 
                                        type="number" 
                                        className="h-9 pl-6 text-right font-mono"
                                        value={item.amountToPay}
                                        onChange={(e) => updateItemAmount(item.id, parseFloat(e.target.value) || 0)}
                                     />
                                  </div>

                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                                      <Trash2 className="w-4 h-4" />
                                  </Button>
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
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100/50"> 
      <div className="max-w-[1200px] mx-auto space-y-6"> 
        
        {/* Header Badge */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
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
    const { updateItemAmount } = usePos();
    
    // CONSUMER ACCOUNT CARD -> USE NEW VIEW
    if (item.type === 'CONSUMER_SERVICES') {
        return <AccountEnquiryView item={item} />;
    }
    
    // PREPAID CARD
    if (item.type === 'PREPAID') {
        const account = item.originalData as Account;
        const isWater = account.prepaidType === 'Water';

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
                     <div className="grid grid-cols-2 gap-8">
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
                        </div>

                        <div className={`p-6 rounded-lg border flex flex-col justify-center space-y-4 ${isWater ? 'bg-blue-50 border-blue-100' : 'bg-yellow-50 border-yellow-100'}`}>
                            <Label htmlFor={`amount-${item.id}`} className={`font-medium text-lg ${isWater ? 'text-blue-900' : 'text-yellow-900'}`}>Recharge Amount</Label>
                            <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl ${isWater ? 'text-blue-700' : 'text-yellow-700'}`}>R</span>
                                <Input 
                                    id={`amount-${item.id}`}
                                    type="number" 
                                    className={`pl-10 text-2xl font-mono font-bold h-14 bg-white focus-visible:ring-2 ${isWater ? 'border-blue-200 focus-visible:ring-blue-400' : 'border-yellow-200 focus-visible:ring-yellow-400'}`}
                                    value={item.amountToPay || ''} 
                                    placeholder="0.00"
                                    onChange={(e) => updateItemAmount(item.id, parseFloat(e.target.value) || 0)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                {[50, 100, 200, 500].map(amt => (
                                    <Button 
                                        key={amt} 
                                        variant="outline" 
                                        size="sm" 
                                        className={`flex-1 bg-white transition-colors ${isWater ? 'hover:bg-blue-100 border-blue-200 text-blue-800' : 'hover:bg-yellow-100 border-yellow-200 text-yellow-800'}`}
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
        )
    }

    // CONSUMER ACCOUNT CARD
    if (item.type === 'CONSUMER_SERVICES') {
        const account = item.originalData as Account;
        return (
            <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="pb-3 bg-muted/20">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">{account.name}</CardTitle>
                                <p className="text-sm text-muted-foreground font-mono mt-1">{account.accountNo}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Outstanding</div>
                            <div className="text-xl font-mono font-bold text-destructive">R {account.outstandingAmount.toFixed(2)}</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-2 gap-8">
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" /> {account.address}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" /> {account.mobile}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" /> {account.email}
                        </div>
                    </div>
                    
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                        <Label htmlFor={`amount-${item.id}`} className="text-primary font-medium">Payment Allocation</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">R</span>
                            <Input 
                                id={`amount-${item.id}`}
                                type="number" 
                                className="pl-8 text-lg font-mono font-semibold"
                                value={item.amountToPay} 
                                onChange={(e) => updateItemAmount(item.id, parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Adjust amount if partial payment</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // CLEARANCE CARD
    if (item.type === 'CLEARANCE') {
        const clr = item.originalData as ClearanceCostSchedule;
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
                                <p className="text-sm text-muted-foreground font-mono mt-1">{clr.scheduleNo}</p>
                            </div>
                        </div>
                         <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Cost</div>
                            <div className="text-xl font-mono font-bold text-foreground">R {clr.totalDue.toFixed(2)}</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div>
                        <h4 className="font-medium mb-3 text-sm">Linked Accounts Breakdown</h4>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Linked Account</TableHead>
                                    <TableHead>Allocation Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clr.section118_1_Breakdown.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-mono text-xs">{clr.linkedAccounts[0]?.accountNo || 'N/A'}</TableCell>
                                        <TableCell className="text-muted-foreground">{row.item}</TableCell>
                                        <TableCell className="text-right font-mono">R {row.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {clr.section118_3_Breakdown.map((row, i) => (
                                    <TableRow key={`hist-${i}`}>
                                        <TableCell className="font-mono text-xs">{clr.linkedAccounts[0]?.accountNo || 'N/A'}</TableCell>
                                        <TableCell className="text-muted-foreground">{row.item} (Sec 118(3))</TableCell>
                                        <TableCell className="text-right font-mono">R {row.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
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
                        value={item.amountToPay} 
                        onChange={(e) => updateItemAmount(item.id, parseFloat(e.target.value) || 0)}
                        className="max-w-[200px]"
                    />
                 </div>
            </CardContent>
        </Card>
    );
}