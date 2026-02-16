import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePos } from '@/lib/pos-state';
import {
    platinumGetDayEndCashierList,
    platinumGetDayEndCashierDetails,
    platinumGetDayEndChequeList,
    platinumGetDayEndCardList,
    platinumGetDayEndDropBoxList,
    platinumGetDayEndReconcileList,
    platinumSaveDayEndReconcileData,
} from '@/lib/external-api';
import {
    Loader2, CreditCard, FileText,
    Banknote, Coins, Save, Box, ChevronDown, ChevronUp
} from 'lucide-react';

interface DenominationState {
    n200: number; n100: number; n50: number; n20: number; n10: number;
    c1: number; c5: number; c10: number; c20: number; c50: number;
    co1: number; co2: number; co5: number;
}

const INITIAL_DENOMINATIONS: DenominationState = {
    n200: 0, n100: 0, n50: 0, n20: 0, n10: 0,
    c1: 0, c5: 0, c10: 0, c20: 0, c50: 0,
    co1: 0, co2: 0, co5: 0,
};

const NOTE_DENOMINATIONS = [
    { key: 'n200', label: 'R200', value: 200 },
    { key: 'n100', label: 'R100', value: 100 },
    { key: 'n50', label: 'R50', value: 50 },
    { key: 'n20', label: 'R20', value: 20 },
    { key: 'n10', label: 'R10', value: 10 },
];

const COIN_DENOMINATIONS = [
    { key: 'co5', label: 'R5', value: 5 },
    { key: 'co2', label: 'R2', value: 2 },
    { key: 'co1', label: 'R1', value: 1 },
    { key: 'c50', label: '50c', value: 0.50 },
    { key: 'c20', label: '20c', value: 0.20 },
    { key: 'c10', label: '10c', value: 0.10 },
    { key: 'c5', label: '5c', value: 0.05 },
    { key: 'c1', label: '1c', value: 0.01 },
];

function extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        return data.items || data.value || data.results || data.data || data.rows || [];
    }
    return [];
}

export default function CashierDayEnd() {
    const { toast } = useToast();
    const { currentUser, systemSettings, platinumCashierId } = usePos();

    const [cashierList, setCashierList] = useState<any[]>([]);
    const [selectedCashierId, setSelectedCashierId] = useState<string>('');
    const [cashierDetails, setCashierDetails] = useState<any>(null);
    const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const [chequeList, setChequeList] = useState<any[]>([]);
    const [cardList, setCardList] = useState<any[]>([]);
    const [dropBoxList, setDropBoxList] = useState<any[]>([]);
    const [reconcileList, setReconcileList] = useState<any[]>([]);
    const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

    const [denominations, setDenominations] = useState<DenominationState>(INITIAL_DENOMINATIONS);
    const [totalCashAmt, setTotalCashAmt] = useState(0);
    const [totalCreditAmt, setTotalCreditAmt] = useState(0);
    const [totalChequeAmt, setTotalChequeAmt] = useState(0);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [showTransactionHistory, setShowTransactionHistory] = useState(false);

    useEffect(() => {
        loadCashierList();
    }, []);

    const loadCashierList = async () => {
        setIsLoadingCashiers(true);
        try {
            const data = await platinumGetDayEndCashierList();
            const items = extractItems(data);
            console.log('[DayEnd] Cashier list loaded:', items.length, 'cashiers', JSON.stringify(items).substring(0, 500));
            setCashierList(items);

            if (platinumCashierId && items.length > 0) {
                const match = items.find((c: any) =>
                    String(c.id) === String(platinumCashierId) ||
                    String(c.cashierId) === String(platinumCashierId) ||
                    String(c.cashier_id) === String(platinumCashierId)
                );
                if (match) {
                    const matchId = String(match.id || match.cashierId || match.cashier_id);
                    console.log(`[DayEnd] Auto-selecting logged-in cashier: ${matchId}`);
                    setSelectedCashierId(matchId);
                    return;
                }
            }

            if (items.length === 1) {
                setSelectedCashierId(String(items[0].id || items[0].cashierId || items[0].cashier_id || ''));
            }
        } catch (e) {
            console.error('Failed to load cashier list', e);
            toast({ title: 'Error', description: 'Failed to load cashier list.', variant: 'destructive' });
        } finally {
            setIsLoadingCashiers(false);
        }
    };

    const loadCashierDetails = useCallback(async (cashierId: string) => {
        if (!cashierId) return;
        setIsLoadingDetails(true);
        try {
            const data = await platinumGetDayEndCashierDetails({ id: cashierId });
            console.log('[DayEnd] Cashier details:', JSON.stringify(data).substring(0, 500));
            setCashierDetails(data);
        } catch (e) {
            console.error('Failed to load cashier details', e);
        } finally {
            setIsLoadingDetails(false);
        }
    }, []);

    const loadReceiptData = useCallback(async (cashierId: string) => {
        if (!cashierId) return;
        setIsLoadingReceipts(true);
        const id = Number(cashierId);
        try {
            const [cheques, cards, dropBoxes, reconciles] = await Promise.all([
                platinumGetDayEndChequeList(id).catch(() => []),
                platinumGetDayEndCardList(id).catch(() => []),
                platinumGetDayEndDropBoxList(id).catch(() => []),
                platinumGetDayEndReconcileList({ id: cashierId }).catch(() => []),
            ]);

            const chequeItems = extractItems(cheques);
            const cardItems = extractItems(cards);
            const dropBoxItems = extractItems(dropBoxes);
            const reconcileItems = extractItems(reconciles);

            console.log(`[DayEnd] Receipt data loaded — cheques: ${chequeItems.length}, cards: ${cardItems.length}, dropbox: ${dropBoxItems.length}, reconcile: ${reconcileItems.length}`);

            setChequeList(chequeItems);
            setCardList(cardItems);
            setDropBoxList(dropBoxItems);
            setReconcileList(reconcileItems);

            const chequeTotal = chequeItems.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
            const cardTotal = cardItems.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
            setTotalChequeAmt(chequeTotal);
            setTotalCreditAmt(cardTotal);
        } catch (e) {
            console.error('Failed to load receipt data', e);
        } finally {
            setIsLoadingReceipts(false);
        }
    }, []);

    useEffect(() => {
        if (selectedCashierId) {
            loadCashierDetails(selectedCashierId);
            loadReceiptData(selectedCashierId);
        }
    }, [selectedCashierId, loadCashierDetails, loadReceiptData]);

    const updateDenomination = (key: string, count: number) => {
        setDenominations(prev => ({ ...prev, [key]: Math.max(0, count) }));
    };

    const totalNotes = NOTE_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key as keyof DenominationState] * d.value), 0);
    const totalCoins = COIN_DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.key as keyof DenominationState] * d.value), 0);
    const calculatedCashTotal = totalNotes + totalCoins;

    useEffect(() => {
        if (systemSettings.enableDenominationCounting) {
            setTotalCashAmt(calculatedCashTotal);
        }
    }, [calculatedCashTotal, systemSettings.enableDenominationCounting]);

    const dropBoxTotal = dropBoxList.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const cashOnHand = systemSettings.enableDenominationCounting ? calculatedCashTotal : totalCashAmt;
    const totalCashOnHandPlusDropBox = cashOnHand + dropBoxTotal;
    const grandTotal = totalCashOnHandPlusDropBox + totalCreditAmt + totalChequeAmt;

    const handleSaveReconcile = async () => {
        if (!selectedCashierId) {
            toast({ title: 'Error', description: 'Please select a cashier first.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const userId = currentUser?.id ? Number(currentUser.id) : 4697;
            const payload = {
                cashierId: Number(selectedCashierId),
                reason: reason || null,
                totalCashAmt: cashOnHand,
                totalChequeAmt: totalChequeAmt,
                totalCoins: totalCoins,
                totalCreditAmt: totalCreditAmt,
                totalAmt: grandTotal,
                n10: denominations.n10,
                n20: denominations.n20,
                n50: denominations.n50,
                n100: denominations.n100,
                n200: denominations.n200,
                co1: denominations.co1,
                co2: denominations.co2,
                co5: denominations.co5,
                c1: denominations.c1,
                c5: denominations.c5,
                c10: denominations.c10,
                c20: denominations.c20,
                c50: denominations.c50,
                finyear: (currentUser as any)?.finYear || null,
            };
            console.log('[DayEnd] Submitting reconcile payload:', JSON.stringify(payload));
            await platinumSaveDayEndReconcileData(userId, payload);
            toast({ title: 'Success', description: 'Day-end reconciliation submitted successfully. Your supervisor will review it.' });
        } catch (e: any) {
            console.error('Failed to save reconcile data', e);
            toast({ title: 'Error', description: e?.message || 'Failed to save reconciliation data.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const getCashierName = (c: any) => c.name || c.cashierName || c.userName || `Cashier ${c.id || c.cashierId}`;
    const today = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit' });

    return (
        <PosLayout>
            <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto">
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 sm:px-6 py-3">
                    <h1 className="text-base sm:text-lg font-bold" data-testid="text-page-title">Cashier Day End Reconcile</h1>
                </div>

                <div className="p-3 sm:p-6 space-y-4">
                    <Card className="shadow-sm">
                        <CardContent className="py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <Label className="text-xs text-slate-500 font-semibold">Cashier Name *</Label>
                                    <Select value={selectedCashierId} onValueChange={setSelectedCashierId}>
                                        <SelectTrigger data-testid="select-cashier" className="mt-1">
                                            <SelectValue placeholder={isLoadingCashiers ? "Loading..." : "Select cashier"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cashierList.map((c, i) => (
                                                <SelectItem key={i} value={String(c.id || c.cashierId || c.cashier_id || i)}>
                                                    {getCashierName(c)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500 font-semibold">Cashier Office *</Label>
                                    <div className="mt-1 text-sm font-medium bg-slate-50 border rounded px-3 py-2">
                                        {cashierDetails?.cashOfficeName || cashierDetails?.cash_office || cashierDetails?.cashOffice || cashierDetails?.officeName || '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500 font-semibold">Reconcile Date</Label>
                                    <div className="mt-1 text-sm font-mono bg-slate-50 border rounded px-3 py-2">{today}</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500 font-semibold">Reason</Label>
                                    <Input
                                        className="mt-1"
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        placeholder="Enter reason..."
                                        data-testid="input-reason"
                                    />
                                </div>
                            </div>
                            {isLoadingDetails && (
                                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading cashier details...
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {selectedCashierId && (
                        <>
                            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-2 text-sm font-semibold rounded-t-md flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Receipt Information
                            </div>

                            <Card className="shadow-sm rounded-t-none -mt-4">
                                <CardContent className="py-4 space-y-6">
                                    {isLoadingReceipts && (
                                        <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" /> Loading receipt data...
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <CreditCard className="w-4 h-4" /> Credit Card Receipts
                                            </h4>
                                            <Badge variant="secondary" className="text-xs">{cardList.length} record{cardList.length !== 1 ? 's' : ''}</Badge>
                                        </div>
                                        <div className="border rounded-md overflow-auto max-h-[250px]">
                                            <Table>
                                                <TableHeader className="bg-gradient-to-b from-slate-600 to-slate-700 sticky top-0">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="text-white font-bold text-xs py-2">No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Account/Invoice Number</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Receipt No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Receipt Date and Time</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Cancelled</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Card No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Expiry Date</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2 text-right">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {cardList.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-4">No records to display</TableCell>
                                                        </TableRow>
                                                    ) : cardList.map((item, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.accountNumber || item.accountId || item.invoiceNumber || '-'}</TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.receiptDate || item.receiptDateTime || item.date || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">
                                                                {item.isCancelled === 1 || item.isCancelled === true ? (
                                                                    <Badge variant="destructive" className="text-[9px]">Yes</Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground">No</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.cardNo || item.cardNumber || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.expiryDate || item.cardExpiryDate || '-'}</TableCell>
                                                            <TableCell className="text-xs text-right font-mono font-medium py-1.5">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex justify-end mt-1 px-2">
                                            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-1 rounded text-xs font-bold">
                                                Total: R {totalCreditAmt.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Cheque Receipts
                                            </h4>
                                            <Badge variant="secondary" className="text-xs">{chequeList.length} record{chequeList.length !== 1 ? 's' : ''}</Badge>
                                        </div>
                                        <div className="border rounded-md overflow-auto max-h-[250px]">
                                            <Table>
                                                <TableHeader className="bg-gradient-to-b from-slate-600 to-slate-700 sticky top-0">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="text-white font-bold text-xs py-2">No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Account/Invoice Number</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Receipt No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Receipt Date and Time</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Cancelled</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Cheque No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2 text-right">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {chequeList.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">No records to display</TableCell>
                                                        </TableRow>
                                                    ) : chequeList.map((item, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.accountNumber || item.accountId || item.invoiceNumber || '-'}</TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.receiptDate || item.receiptDateTime || item.date || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">
                                                                {item.isCancelled === 1 || item.isCancelled === true ? (
                                                                    <Badge variant="destructive" className="text-[9px]">Yes</Badge>
                                                                ) : (
                                                                    <span className="text-muted-foreground">No</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.chequeNo || item.chequeNumber || '-'}</TableCell>
                                                            <TableCell className="text-xs text-right font-mono font-medium py-1.5">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex justify-end mt-1 px-2">
                                            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-1 rounded text-xs font-bold">
                                                Total: R {totalChequeAmt.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                <Box className="w-4 h-4" /> Dropbox Payment
                                            </h4>
                                            <Badge variant="secondary" className="text-xs">{dropBoxList.length} record{dropBoxList.length !== 1 ? 's' : ''}</Badge>
                                        </div>
                                        <div className="border rounded-md overflow-auto max-h-[200px]">
                                            <Table>
                                                <TableHeader className="bg-gradient-to-b from-slate-600 to-slate-700 sticky top-0">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="text-white font-bold text-xs py-2">No</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Description</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Reference Number</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Comment</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2">Status</TableHead>
                                                        <TableHead className="text-white font-bold text-xs py-2 text-right">Total Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {dropBoxList.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">No records to display</TableCell>
                                                        </TableRow>
                                                    ) : dropBoxList.map((item, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            <TableCell className="text-xs py-1.5">{idx + 1}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.description || item.accountNumber || '-'}</TableCell>
                                                            <TableCell className="text-xs font-mono py-1.5">{item.referenceNumber || item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.comment || '-'}</TableCell>
                                                            <TableCell className="text-xs py-1.5">{item.status || '-'}</TableCell>
                                                            <TableCell className="text-xs text-right font-mono font-medium py-1.5">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex justify-end mt-1 px-2">
                                            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-1 rounded text-xs font-bold">
                                                Total: R {dropBoxTotal.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-2 text-sm font-semibold rounded-t-md flex items-center gap-2">
                                <Banknote className="w-4 h-4" /> Cash Information
                            </div>

                            <Card className="shadow-sm rounded-t-none -mt-4">
                                <CardContent className="py-6">
                                    {systemSettings.enableDenominationCounting ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                                                    <Banknote className="w-4 h-4" /> Notes
                                                </h4>
                                                <div className="space-y-2">
                                                    {NOTE_DENOMINATIONS.map(d => (
                                                        <div key={d.key} className="grid grid-cols-[70px_100px_1fr] items-center gap-3">
                                                            <span className="text-sm font-semibold text-slate-700 text-right">{d.label}</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                className="h-9 text-center text-sm font-mono bg-white"
                                                                value={denominations[d.key as keyof DenominationState] || ''}
                                                                onChange={e => updateDenomination(d.key, parseInt(e.target.value) || 0)}
                                                                data-testid={`input-${d.key}`}
                                                            />
                                                            <span className="text-sm text-slate-500 font-mono">
                                                                = R {(denominations[d.key as keyof DenominationState] * d.value).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-end mt-3 pt-2 border-t">
                                                    <span className="text-sm font-bold">Notes Total: R {totalNotes.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-2">
                                                    <Coins className="w-4 h-4" /> Coins
                                                </h4>
                                                <div className="space-y-2">
                                                    {COIN_DENOMINATIONS.map(d => (
                                                        <div key={d.key} className="grid grid-cols-[70px_100px_1fr] items-center gap-3">
                                                            <span className="text-sm font-semibold text-slate-700 text-right">{d.label}</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                className="h-9 text-center text-sm font-mono bg-white"
                                                                value={denominations[d.key as keyof DenominationState] || ''}
                                                                onChange={e => updateDenomination(d.key, parseInt(e.target.value) || 0)}
                                                                data-testid={`input-${d.key}`}
                                                            />
                                                            <span className="text-sm text-slate-500 font-mono">
                                                                = R {(denominations[d.key as keyof DenominationState] * d.value).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-end mt-3 pt-2 border-t">
                                                    <span className="text-sm font-bold">Coins Total: R {totalCoins.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-md mx-auto">
                                            <Label className="text-sm font-semibold text-slate-700">Total Cash on Hand (R)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                className="mt-2 text-lg font-mono text-center"
                                                value={totalCashAmt || ''}
                                                onChange={e => setTotalCashAmt(parseFloat(e.target.value) || 0)}
                                                placeholder="Enter total cash on hand"
                                                data-testid="input-total-cash"
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end mt-4">
                                        <div className="bg-slate-100 border-2 border-slate-300 rounded-lg px-6 py-3 text-right">
                                            <span className="text-sm text-slate-600 mr-4">Total Cash</span>
                                            <span className="text-lg font-bold font-mono text-slate-800">
                                                R {cashOnHand.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-2 border-slate-300">
                                <CardContent className="py-5">
                                    <div className="max-w-lg mx-auto space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm font-semibold text-slate-700">Total Cash on Hand + Drop Box (R)</span>
                                            <span className="font-mono font-bold text-sm bg-slate-50 border px-4 py-1.5 rounded min-w-[120px] text-right">
                                                {totalCashOnHandPlusDropBox.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm font-semibold text-slate-700">Total Cheque Receipts (R)</span>
                                            <span className="font-mono font-bold text-sm bg-slate-50 border px-4 py-1.5 rounded min-w-[120px] text-right">
                                                {totalChequeAmt.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm font-semibold text-slate-700">Total Debit/Credit Card Receipts (R)</span>
                                            <span className="font-mono font-bold text-sm bg-slate-50 border px-4 py-1.5 rounded min-w-[120px] text-right">
                                                {totalCreditAmt.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b-2 border-slate-400">
                                            <span className="text-sm font-bold text-slate-800">Grand Total (R)</span>
                                            <span className="font-mono font-bold text-base bg-blue-50 border-2 border-blue-300 px-4 py-1.5 rounded min-w-[120px] text-right text-blue-900">
                                                {grandTotal.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-center gap-3 mt-6">
                                        <Button
                                            className="bg-slate-700 hover:bg-slate-800 px-8 font-bold"
                                            onClick={handleSaveReconcile}
                                            disabled={isSaving || !selectedCashierId}
                                            data-testid="button-save-reconcile"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Submit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="px-8 font-bold"
                                            onClick={() => {
                                                setDenominations(INITIAL_DENOMINATIONS);
                                                setTotalCashAmt(0);
                                                setReason('');
                                            }}
                                            data-testid="button-reset"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="mt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-500 gap-1"
                                    onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                                    data-testid="button-toggle-history"
                                >
                                    {showTransactionHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {showTransactionHistory ? 'Hide' : 'Show'} Reconcile List
                                </Button>

                                {showTransactionHistory && (
                                    <Card className="mt-2 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm text-slate-600">Reconcile List (System Receipts)</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isLoadingReceipts ? (
                                                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                                                </div>
                                            ) : reconcileList.length === 0 ? (
                                                <div className="text-center py-6 text-muted-foreground text-sm">No reconcile data found.</div>
                                            ) : (
                                                <div className="border rounded-md overflow-auto max-h-[400px]">
                                                    <Table>
                                                        <TableHeader className="bg-slate-100 sticky top-0">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-xs">#</TableHead>
                                                                <TableHead className="font-bold text-xs">Receipt No</TableHead>
                                                                <TableHead className="font-bold text-xs">Account</TableHead>
                                                                <TableHead className="font-bold text-xs">Payment Type</TableHead>
                                                                <TableHead className="font-bold text-xs">Date</TableHead>
                                                                <TableHead className="font-bold text-xs text-right">Amount</TableHead>
                                                                <TableHead className="font-bold text-xs">Status</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {reconcileList.map((item, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.accountNumber || item.accountId || '-'}</TableCell>
                                                                    <TableCell className="text-xs">{item.paymentType || item.payMode || '-'}</TableCell>
                                                                    <TableCell className="text-xs">{item.receiptDate || item.date || '-'}</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-medium">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                                    <TableCell className="text-xs">
                                                                        {item.isCancelled === 1 || item.isCancelled === true ? (
                                                                            <Badge variant="destructive" className="text-[9px]">Cancelled</Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-[9px] text-green-700 border-green-300 bg-green-50">Active</Badge>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </PosLayout>
    );
}
