import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePos, TransactionRecord } from '@/lib/pos-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, AlertTriangle, Ban, Receipt, CheckCircle2, Clock, Printer, Search, X, FileWarning, Info, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchPosMultiReceiptPrint } from '@/lib/external-api';
import { openReceiptFromMultiPrint } from '@/lib/receipt-print';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionHistoryModal({ isOpen, onClose }: TransactionHistoryModalProps) {
  const { recentTransactions, cancelTransaction, dayEndStatus, currentUser, refreshTransactions } = usePos();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setHasSearched(false);
    }
  }, [isOpen]);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showOriginalReceiptWarning, setShowOriginalReceiptWarning] = useState(false);
  const [pendingCancelTx, setPendingCancelTx] = useState<TransactionRecord | null>(null);
  

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    if (recentTransactions.length === 0 && refreshTransactions) {
      setIsRefreshing(true);
      refreshTransactions().finally(() => {
        setIsRefreshing(false);
        setHasSearched(true);
      });
    } else {
      setHasSearched(true);
    }
  }, [searchQuery, recentTransactions.length, refreshTransactions]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredTransactions = hasSearched && searchQuery.trim()
    ? recentTransactions.filter(tx => {
        const q = searchQuery.trim().toLowerCase();
        return (tx.receiptNumber || '').toLowerCase().includes(q);
      })
    : [];

  const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);

  const triggerReprint = async (tx: TransactionRecord) => {
    const receiptId = tx.id || tx.receiptNumber;
    if (!receiptId) return;
    setPrintingReceiptId(receiptId);
    try {
      let numericId = '';
      if (tx.splitReceipts && tx.splitReceipts.length > 0 && tx.splitReceipts[0].receiptId) {
        numericId = String(tx.splitReceipts[0].receiptId);
      } else if (tx.receiptNumber && tx.receiptNumber.includes('/')) {
        numericId = tx.receiptNumber.split('/').pop() || '';
      } else if (tx.id && tx.id.startsWith('plt-')) {
        numericId = tx.id.replace('plt-', '');
      } else if (tx.receiptDetail?.receiptId) {
        numericId = String(tx.receiptDetail.receiptId);
      } else {
        numericId = String(receiptId);
      }
      const multiData = await fetchPosMultiReceiptPrint(numericId, 3, tx.receiptNumber || undefined);
      const items = Array.isArray(multiData) ? multiData : [];
      if (items.length > 0) {
        const win = await openReceiptFromMultiPrint(items, true);
        if (!win) {
          toast({ title: "Popup Blocked", description: "Please allow popups for this site to print receipts.", variant: "destructive" });
        } else {
          toast({ title: "Receipt Ready", description: `Receipt ${items[0]?.receiptNo || receiptId} opened for reprinting.` });
        }
        return;
      }
      toast({ title: "Print Failed", description: "The API returned no receipt data for this transaction. Please try again or contact support.", variant: "destructive" });
    } catch {
      toast({ title: "Print Failed", description: "Could not retrieve receipt data from the API.", variant: "destructive" });
    } finally {
      setPrintingReceiptId(null);
    }
  };

  const initiateCancel = (tx: TransactionRecord) => {
    if (dayEndStatus === 'RECONCILED' || dayEndStatus === 'PENDING_APPROVAL') {
      toast({
        title: "Cancellation Not Allowed",
        description: dayEndStatus === 'RECONCILED' 
          ? "This shift has already been reconciled. Receipts cannot be cancelled."
          : "Day-end reconciliation is pending approval. Receipts cannot be cancelled until the shift is re-opened.",
        variant: "destructive",
      });
      return;
    }
    if (tx.isReconciled === 1) {
      toast({
        title: "Receipt Already Reconciled",
        description: "This receipt has been reconciled and cannot be cancelled.",
        variant: "destructive",
      });
      return;
    }
    setPendingCancelTx(tx);
    setShowOriginalReceiptWarning(true);
  };

  const confirmOriginalReceiptAtHand = () => {
    if (!pendingCancelTx) return;
    setShowOriginalReceiptWarning(false);
    setCancellingId(pendingCancelTx.id);
    setCancellationReason('');
  };

  const handleConfirmCancel = () => {
    if (!cancellingId || !cancellationReason.trim()) return;

    const isSupervisor = currentUser.role === 'SUPERVISOR';
    
    cancelTransaction(cancellingId, cancellationReason);
    
    if (!isSupervisor) {
        toast({
            title: "Cancellation Requested",
            description: "Receipt cancellation request sent to supervisor for review.",
        });
    } else {
        toast({
            title: "Receipt Cancelled",
            description: "Transaction has been voided. Cashier totals have been adjusted.",
            variant: "destructive"
        });
    }
    
    setCancellingId(null);
    setCancellationReason('');
    setPendingCancelTx(null);
  };

  const getDeclineReason = (tx: TransactionRecord) => {
    return tx.declineReason || tx.cancellationReason;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
            setCancellingId(null);
            setShowOriginalReceiptWarning(false);
            setPendingCancelTx(null);
            onClose();
        }
    }}>
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Receipt Cancellation Request
          </DialogTitle>
          <DialogDescription>
            Search for a receipt to request cancellation. Only receipts from open shifts that have not been reconciled can be cancelled.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Enter receipt number and press Enter..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setHasSearched(false); }}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-9 h-9"
              data-testid="input-receipt-search"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setHasSearched(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="h-9 gap-1.5"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isRefreshing}
            data-testid="button-search-receipt"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </Button>
          {hasSearched && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredTransactions.length} result{filteredTransactions.length !== 1 ? 's' : ''} found
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
             {isRefreshing ? (
                 <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                     <Search className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
                     <p>Searching for receipt...</p>
                 </div>
             ) : !hasSearched ? (
                 <div className="text-center py-16 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">
                     <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                     <p className="font-medium text-sm">Search for a Receipt</p>
                     <p className="text-xs mt-1 max-w-xs mx-auto">Enter a receipt number above and press Enter or click Search to find a specific transaction.</p>
                 </div>
             ) : filteredTransactions.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                     <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                     <p>No receipts found matching "<span className="font-mono font-medium">{searchQuery}</span>"</p>
                     <p className="text-xs mt-1">Check the receipt number and try again. Only receipts from the current shift are available.</p>
                 </div>
             ) : (
                 <Table>
                     <TableHeader>
                         <TableRow>
                             <TableHead>Receipt No</TableHead>
                             <TableHead>Time</TableHead>
                             <TableHead>Account</TableHead>
                             <TableHead>Type</TableHead>
                             <TableHead>Items</TableHead>
                             <TableHead className="text-right">Amount</TableHead>
                             <TableHead>Payment</TableHead>
                             <TableHead>Status</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                         {filteredTransactions.map((tx) => (
                             <TableRow key={tx.id} className={
                                 tx.status === 'CANCELLED' ? 'opacity-60 bg-red-50/50' : 
                                 tx.status === 'PENDING_CANCELLATION' ? 'bg-orange-50/50' : ''
                             }>
                                 <TableCell className="font-mono text-xs">{tx.receiptNumber}</TableCell>
                                 <TableCell className="text-xs text-muted-foreground">
                                     {new Date(tx.timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                 </TableCell>
                                 <TableCell className="font-mono text-xs">
                                     {tx.items[0]?.reference || tx.items[0]?.originalData?.accountId || tx.items[0]?.originalData?.oldAccountCode || '-'}
                                 </TableCell>
                                 <TableCell>
                                     <Badge variant="outline" className="text-[10px] px-1.5 h-5 whitespace-nowrap">
                                         {tx.paymentOptionName || tx.items[0]?.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '-'}
                                     </Badge>
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
                                     <div className="flex gap-1 flex-wrap">
                                         {(() => {
                                             const billType = tx.paymentTypeName || tx.items[0]?.originalData?.billType || '';
                                             if (billType) {
                                                 return <Badge variant="outline" className="text-[10px] px-1.5 h-5 whitespace-nowrap">{billType}</Badge>;
                                             }
                                             return (
                                                 <>
                                                     {tx.payment.cash > 0 && <Badge variant="outline" className="text-[10px] px-1.5 h-5">Cash</Badge>}
                                                     {tx.payment.card > 0 && <Badge variant="outline" className="text-[10px] px-1.5 h-5">Card</Badge>}
                                                 </>
                                             );
                                         })()}
                                     </div>
                                 </TableCell>
                                 <TableCell>
                                     {tx.status === 'COMPLETED' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none">Paid</Badge>}
                                     {tx.status === 'CANCELLED' && (
                                         <div className="flex flex-col gap-0.5">
                                             <Badge variant="destructive" className="shadow-none">Cancelled</Badge>
                                             {tx.cancellationReason && (
                                                 <span className="text-[10px] text-red-500 max-w-[120px] truncate" title={tx.cancellationReason}>
                                                     {tx.cancellationReason}
                                                 </span>
                                             )}
                                         </div>
                                     )}
                                     {tx.status === 'PENDING_CANCELLATION' && (
                                         <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 shadow-none">
                                             <Clock className="w-3 h-3 mr-1" /> Pending Approval
                                         </Badge>
                                     )}
                                     {tx.status === 'RECONCILED' && <Badge variant="secondary" className="bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] border-[#D6D6D6] shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Reconciled</Badge>}
                                     {tx.status === 'DECLINED' && (
                                         <div className="flex flex-col gap-0.5">
                                             <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 shadow-none">
                                                 <AlertTriangle className="w-3 h-3 mr-1" /> Declined
                                             </Badge>
                                             {getDeclineReason(tx) && (
                                                 <span className="text-[10px] text-amber-600 max-w-[140px] truncate" title={getDeclineReason(tx)}>
                                                     Reason: {getDeclineReason(tx)}
                                                 </span>
                                             )}
                                         </div>
                                     )}
                                 </TableCell>
                                 <TableCell className="text-right">
                                     <div className="flex items-center justify-end gap-1">
                                         {(tx.status === 'COMPLETED' || tx.status === 'RECONCILED' || tx.status === 'DECLINED') && (
                                             <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:bg-[var(--pos-accent-tint)]"
                                                onClick={() => triggerReprint(tx)}
                                                disabled={printingReceiptId === (tx.id || tx.receiptNumber)}
                                                title="Reprint Receipt"
                                                data-testid={`button-reprint-${tx.id}`}
                                             >
                                                 {printingReceiptId === (tx.id || tx.receiptNumber) ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1" />}
                                                 Print
                                             </Button>
                                         )}
                                         {tx.status === 'COMPLETED' && tx.isReconciled !== 1 && (
                                             <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => initiateCancel(tx)}
                                                title="Request Cancellation"
                                                data-testid={`button-cancel-${tx.id}`}
                                             >
                                                 <Ban className="w-3.5 h-3.5 mr-1" />
                                                 Cancel
                                             </Button>
                                         )}
                                         {tx.status === 'DECLINED' && tx.isReconciled !== 1 && (
                                             <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => initiateCancel(tx)}
                                                title="Re-request Cancellation"
                                                data-testid={`button-recancel-${tx.id}`}
                                             >
                                                 <Ban className="w-3.5 h-3.5 mr-1" />
                                                 Re-Request
                                             </Button>
                                         )}
                                         {tx.status === 'COMPLETED' && tx.isReconciled === 1 && (
                                             <span className="text-xs text-muted-foreground italic">Reconciled</span>
                                         )}
                                         {tx.status === 'PENDING_CANCELLATION' && <span className="text-xs text-orange-500 italic">Awaiting Supervisor</span>}
                                         {tx.status === 'CANCELLED' && <span className="text-xs text-muted-foreground italic">Voided</span>}
                                     </div>
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

      {/* Original Receipt Warning Dialog */}
      <Dialog open={showOriginalReceiptWarning} onOpenChange={(o) => { if (!o) { setShowOriginalReceiptWarning(false); setPendingCancelTx(null); } }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <FileWarning className="w-5 h-5" />
                    Original Receipt Required
                </DialogTitle>
                <DialogDescription>
                    Important notice before proceeding with cancellation
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">You must have the original printed receipt at hand before requesting a cancellation.</p>
                            <p className="text-amber-700 text-xs">The original receipt will need to be attached to the cancellation documentation for audit purposes. Do not proceed if you do not have the physical receipt.</p>
                        </div>
                    </div>
                </div>
                {pendingCancelTx && (
                    <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-muted-foreground">Receipt No:</span>
                            <span className="font-mono font-medium">{pendingCancelTx.receiptNumber}</span>
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-mono font-medium">R {pendingCancelTx.totalAmount.toFixed(2)}</span>
                            <span className="text-muted-foreground">Payment:</span>
                            <span>{pendingCancelTx.paymentTypeName || (pendingCancelTx.payment.cash > 0 ? 'Cash' : 'Card')}</span>
                            <span className="text-muted-foreground">Account:</span>
                            <span className="font-mono">{pendingCancelTx.items[0]?.reference || pendingCancelTx.items[0]?.description || '-'}</span>
                        </div>
                    </div>
                )}
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-[var(--pos-accent-tint)] border border-[#D6D6D6] rounded-lg p-2.5">
                    <Info className="w-4 h-4 text-[var(--pos-accent)] flex-shrink-0 mt-0.5" />
                    <span>
                        This cancellation request will be sent to a supervisor for approval. 
                        If approved, the receipt amount will be deducted from your shift totals for the applicable payment method (Cash/Card). 
                        If declined, you will see the reason and the receipt will remain active.
                    </span>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => { setShowOriginalReceiptWarning(false); setPendingCancelTx(null); }}>
                    I Don't Have It
                </Button>
                <Button 
                    variant="default"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={confirmOriginalReceiptAtHand}
                    data-testid="button-confirm-receipt-at-hand"
                >
                    I Have the Original Receipt
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Reason Dialog */}
      <Dialog open={!!cancellingId} onOpenChange={(o) => !o && setCancellingId(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <Ban className="w-5 h-5" />
                    Request Receipt Cancellation
                </DialogTitle>
                <DialogDescription>
                    {currentUser.role !== 'SUPERVISOR' 
                      ? "This request will be sent to a supervisor for approval. The receipt will remain active until approved."
                      : "As a supervisor, this cancellation will take effect immediately."
                    }
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
                {pendingCancelTx && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-muted-foreground">Receipt:</span>
                            <span className="font-mono font-medium">{pendingCancelTx.receiptNumber}</span>
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-mono font-medium text-red-600">R {pendingCancelTx.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                )}
                <div className="space-y-1.5">
                    <Label>Reason for Cancellation <span className="text-red-500">*</span></Label>
                    <Input 
                        placeholder="e.g. Wrong amount entered, Customer request, Duplicate payment..." 
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        autoFocus
                        data-testid="input-cancel-reason"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => { setCancellingId(null); setPendingCancelTx(null); }}>Back</Button>
                <Button 
                    variant="destructive" 
                    disabled={!cancellationReason.trim()}
                    onClick={handleConfirmCancel}
                    data-testid="button-confirm-cancel"
                >
                    {currentUser.role === 'SUPERVISOR' ? 'Cancel Receipt Now' : 'Submit Cancel Request'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
