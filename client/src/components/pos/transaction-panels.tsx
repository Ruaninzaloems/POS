import React, { useEffect, useState } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Account, ClearanceCostSchedule } from '@/lib/mock-data';
import { User, MapPin, Phone, Mail, FileCheck } from 'lucide-react';

export function TransactionPanels() {
  const { activeTransactionType, transactionItems } = usePos();

  if (activeTransactionType === 'NONE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
           <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Ready to Receipt</h2>
        <p className="max-w-md text-center">Use the search bar above to find an account, prepaid meter, clearance schedule, or direct income item.</p>
      </div>
    );
  }

  // Determine which panel to show based on the active items
  // In a real app, this might switch if multiple types are mixed, but here we assume uniformity
  
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-muted/10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Badge */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTransactionType === 'CONSUMER_SERVICES' && 'Consumer Account'}
              {activeTransactionType === 'DIRECT_INCOME' && 'Direct Income'}
              {activeTransactionType === 'CLEARANCE' && 'Clearance Certificate'}
              {activeTransactionType === 'MULTI_ACCOUNT' && 'Multi-Account Basket'}
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
    
    // Render distinct cards based on type
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
