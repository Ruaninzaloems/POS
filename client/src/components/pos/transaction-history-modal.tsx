import React from 'react';
import { usePos } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Ban, Receipt, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionHistoryModal({ isOpen, onClose }: TransactionHistoryModalProps) {
  const { recentTransactions, cancelTransaction, dayEndStatus, currentUser } = usePos();
  const { toast } = useToast();

  const handleCancel = (id: string) => {
    const isSupervisor = currentUser.role === 'SUPERVISOR';
    
    if (confirm(isSupervisor 
        ? 'Are you sure you want to CANCEL this receipt? This action cannot be undone.'
        : 'Request cancellation for this receipt? This will be sent to a supervisor for approval.'
    )) {
        cancelTransaction(id);
        
        if (!isSupervisor) {
            toast({
                title: "Cancellation Requested",
                description: "Receipt sent to supervisor for approval.",
            });
        } else {
            toast({
                title: "Receipt Cancelled",
                description: "Transaction has been voided.",
                variant: "destructive"
            });
        }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Transaction History
          </DialogTitle>
          <DialogDescription>
            View and manage recent receipts. Cancellations are only allowed for open shifts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
             {recentTransactions.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                     <p>No transactions recorded for this session.</p>
                 </div>
             ) : (
                 <Table>
                     <TableHeader>
                         <TableRow>
                             <TableHead>Receipt No</TableHead>
                             <TableHead>Time</TableHead>
                             <TableHead>Items</TableHead>
                             <TableHead className="text-right">Amount</TableHead>
                             <TableHead>Payment</TableHead>
                             <TableHead>Status</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                         {recentTransactions.map((tx) => (
                             <TableRow key={tx.id} className={
                                 tx.status === 'CANCELLED' ? 'opacity-60 bg-red-50/50' : 
                                 tx.status === 'PENDING_CANCELLATION' ? 'bg-orange-50/50' : ''
                             }>
                                 <TableCell className="font-mono text-xs">{tx.receiptNumber}</TableCell>
                                 <TableCell className="text-xs text-muted-foreground">
                                     {format(new Date(tx.timestamp), 'HH:mm:ss')}
                                 </TableCell>
                                 <TableCell className="max-w-[200px]">
                                     <div className="text-sm truncate" title={tx.items.map(i => i.description).join(', ')}>
                                         {tx.items[0].description}
                                         {tx.items.length > 1 && <span className="text-xs text-muted-foreground ml-1">+{tx.items.length - 1} more</span>}
                                     </div>
                                 </TableCell>
                                 <TableCell className="text-right font-mono font-medium">
                                     R {tx.totalAmount.toFixed(2)}
                                 </TableCell>
                                 <TableCell>
                                     <div className="flex gap-1">
                                         {tx.payment.cash > 0 && <Badge variant="outline" className="text-[10px] px-1 h-5">Cash</Badge>}
                                         {tx.payment.card > 0 && <Badge variant="outline" className="text-[10px] px-1 h-5">Card</Badge>}
                                     </div>
                                 </TableCell>
                                 <TableCell>
                                     {tx.status === 'COMPLETED' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none">Paid</Badge>}
                                     {tx.status === 'CANCELLED' && <Badge variant="destructive" className="shadow-none">Cancelled</Badge>}
                                     {tx.status === 'PENDING_CANCELLATION' && <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 shadow-none"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>}
                                     {tx.status === 'RECONCILED' && <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Reconciled</Badge>}
                                 </TableCell>
                                 <TableCell className="text-right">
                                     {tx.status === 'COMPLETED' && (
                                         <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            disabled={dayEndStatus === 'RECONCILED'}
                                            onClick={() => handleCancel(tx.id)}
                                            title={dayEndStatus === 'RECONCILED' ? "Cannot cancel reconciled transactions" : "Cancel Receipt"}
                                         >
                                             <Ban className="w-3.5 h-3.5 mr-1" />
                                             Cancel
                                         </Button>
                                     )}
                                     {tx.status === 'PENDING_CANCELLATION' && <span className="text-xs text-muted-foreground italic">Waiting Approval</span>}
                                     {tx.status === 'CANCELLED' && <span className="text-xs text-muted-foreground italic">Voided</span>}
                                 </TableCell>
                             </TableRow>
                         ))}
                     </TableBody>
                 </Table>
             )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close History</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
