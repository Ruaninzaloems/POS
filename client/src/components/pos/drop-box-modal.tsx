import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';
import { platinumSubmitDropBox, platinumGetDropBoxList } from '@/lib/external-api';
import { Box, Loader2, CheckCircle2, AlertTriangle, Banknote, ArrowDown, History } from 'lucide-react';
import { HelpTip } from '@/components/ui/help-tip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DropBoxModalProps {
    isOpen: boolean;
    onClose: () => void;
    triggerReason?: string;
}

export function DropBoxModal({ isOpen, onClose, triggerReason }: DropBoxModalProps) {
    const { toast } = useToast();
    const { platinumUser, platinumCashierId, currentUser, sessionDetails, officeLimits } = usePos();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [step, setStep] = useState<'input' | 'confirm' | 'submitting' | 'success' | 'error'>('input');
    const [errorMessage, setErrorMessage] = useState('');
    const [receiptNo, setReceiptNo] = useState<string | null>(null);
    const [dropHistory, setDropHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    const officeId = sessionDetails?.officeId || '';
    const cashOnHandLimit = (officeId && officeLimits[officeId]) ? officeLimits[officeId] : 999999;
    const officeName = sessionDetails?.officeDesc || currentUser?.cashOffice || 'Unknown Office';
    const cashierId = platinumCashierId;

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setDescription('');
            setStep('input');
            setErrorMessage('');
            setReceiptNo(null);
            setShowHistory(false);
        }
    }, [isOpen]);

    const parsedAmount = parseFloat(amount) || 0;

    const formatCurrency = (val: number) =>
        `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleNext = () => {
        if (parsedAmount <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a valid drop amount greater than zero.', variant: 'destructive' });
            return;
        }
        setStep('confirm');
    };

    const handleSubmit = async () => {
        setStep('submitting');
        try {
            const userId = platinumUser?.user_ID || Number(currentUser?.id) || 213;
            const finYear = platinumUser?.finYear || '2025/2026';

            const result = await platinumSubmitDropBox({
                amount: parsedAmount,
                description: description.trim() || 'Cash Drop to Drop Box',
                userId,
                finYear,
                paymentType: 1,
            });

            if (result?.success === false || result?.error) {
                const errMsg = result?.message || result?.error || 'Failed to submit drop box payment.';
                setErrorMessage(errMsg);
                setStep('error');
                return;
            }

            setReceiptNo(result?.receiptNo || null);
            setStep('success');
            toast({ title: 'Drop Box Submitted', description: `${formatCurrency(parsedAmount)} has been dropped to the drop box.` });
        } catch (e: any) {
            setErrorMessage(e?.message || 'Failed to submit drop box payment.');
            setStep('error');
        }
    };

    const loadHistory = async () => {
        if (!cashierId) return;
        setHistoryLoading(true);
        try {
            const result = await platinumGetDropBoxList(cashierId);
            setDropHistory(result?.items || []);
        } catch {
            setDropHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleShowHistory = () => {
        setShowHistory(!showHistory);
        if (!showHistory && dropHistory.length === 0) {
            loadHistory();
        }
    };

    const denominations = [
        { label: 'R 200', value: 200 },
        { label: 'R 100', value: 100 },
        { label: 'R 50', value: 50 },
        { label: 'R 20', value: 20 },
        { label: 'R 10', value: 10 },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Box className="w-5 h-5 text-amber-600" />
                        Drop Box — Cash Drop
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        Remove cash from your drawer and place it in the drop box/safe.
                        {officeName && <span className="block mt-0.5 text-muted-foreground">Office: <strong>{officeName}</strong> | Limit: <strong>{formatCurrency(cashOnHandLimit)}</strong></span>}
                    </DialogDescription>
                </DialogHeader>

                {triggerReason && step === 'input' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                        <span>{triggerReason}</span>
                    </div>
                )}

                {step === 'input' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                                Drop Amount
                                <HelpTip text="Enter the total cash amount you are placing in the drop box. This will reduce your cash-on-hand balance." />
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="pl-8 text-lg font-mono h-12"
                                    autoFocus
                                    data-testid="input-drop-amount"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {denominations.map(d => (
                                <Button
                                    key={d.value}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 px-3 hover:bg-amber-50 hover:border-amber-300"
                                    onClick={() => setAmount(prev => String((parseFloat(prev) || 0) + d.value))}
                                    data-testid={`button-add-${d.value}`}
                                >
                                    +{d.label}
                                </Button>
                            ))}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs h-8 px-3 text-red-500 hover:text-red-700"
                                onClick={() => setAmount('')}
                                data-testid="button-clear-amount"
                            >
                                Clear
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm text-muted-foreground">Description (optional)</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Midday cash drop, Shift change drop..."
                                className="text-sm"
                                data-testid="input-drop-description"
                            />
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={handleShowHistory}
                            data-testid="button-toggle-history"
                        >
                            <History className="w-3.5 h-3.5 mr-1" />
                            {showHistory ? 'Hide' : 'Show'} Today's Drops
                        </Button>

                        {showHistory && (
                            <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                {historyLoading ? (
                                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                                    </div>
                                ) : dropHistory.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-muted-foreground">No drop box entries found for today</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="text-xs py-1.5">Description</TableHead>
                                                <TableHead className="text-xs py-1.5">Reference</TableHead>
                                                <TableHead className="text-xs py-1.5 text-right">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dropHistory.map((item: any, idx: number) => (
                                                <TableRow key={idx} className="text-xs">
                                                    <TableCell className="py-1.5">{item.description || item.accountNumber || '-'}</TableCell>
                                                    <TableCell className="py-1.5 font-mono">{item.referenceNumber || item.receiptNo || '-'}</TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono font-medium">{formatCurrency(Number(item.amount || item.paidAmount || 0))}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-4 py-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                            <div className="w-14 h-14 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                                <ArrowDown className="w-7 h-7 text-amber-700" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-amber-800">Confirm Cash Drop</p>
                                <p className="text-xs text-amber-600 mt-1">This amount will be removed from your cash-on-hand.</p>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-amber-200">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Drop Amount</p>
                                <p className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(parsedAmount)}</p>
                            </div>
                            {description && (
                                <p className="text-xs text-amber-700">
                                    Note: <em>{description}</em>
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {step === 'submitting' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                        <p className="font-semibold text-slate-800">Processing Drop Box</p>
                        <p className="text-sm text-slate-500">Recording your cash drop...</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-green-800">Cash Drop Recorded</h3>
                            <p className="text-2xl font-bold text-green-700 mt-2">{formatCurrency(parsedAmount)}</p>
                            <p className="text-sm text-slate-500 mt-2">has been moved to the drop box.</p>
                            {receiptNo && (
                                <Badge variant="outline" className="mt-2 text-xs">Receipt: {receiptNo}</Badge>
                            )}
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="space-y-3 py-4">
                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-800">
                                <p className="font-bold mb-1">Drop Box Failed</p>
                                <p className="text-red-600">{errorMessage}</p>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    {step === 'input' && (
                        <>
                            <Button variant="ghost" onClick={onClose} className="text-slate-500">Cancel</Button>
                            <Button
                                onClick={handleNext}
                                disabled={parsedAmount <= 0}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6"
                                data-testid="button-next"
                            >
                                <Banknote className="w-4 h-4 mr-1.5" />
                                Review Drop
                            </Button>
                        </>
                    )}
                    {step === 'confirm' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="text-slate-500">Back</Button>
                            <Button
                                onClick={handleSubmit}
                                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold px-6"
                                data-testid="button-confirm-drop"
                            >
                                <Box className="w-4 h-4 mr-1.5" />
                                Confirm Drop
                            </Button>
                        </>
                    )}
                    {step === 'submitting' && (
                        <Button disabled className="w-full bg-slate-200 text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...
                        </Button>
                    )}
                    {step === 'success' && (
                        <Button
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold"
                            data-testid="button-done"
                        >
                            Done
                        </Button>
                    )}
                    {step === 'error' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="text-slate-500">Back to Edit</Button>
                            <Button onClick={handleSubmit} className="bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold px-6">Retry</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
