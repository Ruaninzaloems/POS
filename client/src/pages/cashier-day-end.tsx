import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
    Loader2, RefreshCw, DollarSign, CreditCard, FileText,
    Banknote, Coins, Save, CheckCircle2, AlertCircle, Box
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
    const { currentUser, systemSettings } = usePos();

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
    const [totalChequeAmt, setTotalChequeAmt] = useState(0);
    const [totalCreditAmt, setTotalCreditAmt] = useState(0);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('cash');

    useEffect(() => {
        loadCashierList();
    }, []);

    const loadCashierList = async () => {
        setIsLoadingCashiers(true);
        try {
            const data = await platinumGetDayEndCashierList();
            const items = extractItems(data);
            setCashierList(items);
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
            setChequeList(extractItems(cheques));
            setCardList(extractItems(cards));
            setDropBoxList(extractItems(dropBoxes));
            setReconcileList(extractItems(reconciles));

            const chequeTotal = extractItems(cheques).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
            const cardTotal = extractItems(cards).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
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

    const systemCashTotal = reconcileList.reduce((s, r) => {
        const payType = (r.paymentType || r.payMode || '').toLowerCase();
        if (payType.includes('cash') || r.paymentTypeId === 1) {
            return s + (Number(r.amount) || 0);
        }
        return s;
    }, 0);

    const systemCardTotal = reconcileList.reduce((s, r) => {
        const payType = (r.paymentType || r.payMode || '').toLowerCase();
        if (payType.includes('card') || payType.includes('credit') || r.paymentTypeId === 2) {
            return s + (Number(r.amount) || 0);
        }
        return s;
    }, 0);

    const systemChequeTotal = reconcileList.reduce((s, r) => {
        const payType = (r.paymentType || r.payMode || '').toLowerCase();
        if (payType.includes('cheque') || payType.includes('check') || r.paymentTypeId === 3) {
            return s + (Number(r.amount) || 0);
        }
        return s;
    }, 0);

    const systemTotal = reconcileList.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const cashierTotal = totalCashAmt + totalChequeAmt + totalCreditAmt;
    const variance = cashierTotal - systemTotal;

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
                totalCashAmt,
                totalChequeAmt,
                totalCoins,
                totalCreditAmt,
                totalAmt: cashierTotal,
                ...denominations,
                finyear: (currentUser as any)?.finYear || null,
            };
            await platinumSaveDayEndReconcileData(userId, payload);
            toast({ title: 'Success', description: 'Day-end reconciliation data saved successfully.' });
        } catch (e: any) {
            console.error('Failed to save reconcile data', e);
            toast({ title: 'Error', description: e?.message || 'Failed to save reconciliation data.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const getCashierName = (c: any) => c.name || c.cashierName || c.userName || `Cashier ${c.id || c.cashierId}`;

    return (
        <PosLayout>
            <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto">
                <div className="bg-white border-b shadow-sm px-6 py-4">
                    <h1 className="text-xl font-bold text-slate-800" data-testid="text-page-title">Cashier Day-End Reconciliation</h1>
                    <p className="text-sm text-muted-foreground mt-1">Submit your cash-on-hand totals for day-end reconciliation</p>
                </div>

                <div className="p-6 space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-blue-600" />
                                    Select Cashier
                                </CardTitle>
                                <Button variant="outline" size="sm" onClick={loadCashierList} disabled={isLoadingCashiers}>
                                    <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingCashiers ? 'animate-spin' : ''}`} /> Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-xs text-slate-500">Cashier</Label>
                                    <Select value={selectedCashierId} onValueChange={setSelectedCashierId}>
                                        <SelectTrigger data-testid="select-cashier">
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
                                {cashierDetails && (
                                    <>
                                        <div>
                                            <Label className="text-xs text-slate-500">Cash Office</Label>
                                            <div className="text-sm font-medium mt-1">
                                                {cashierDetails.cashOfficeName || cashierDetails.cash_office || cashierDetails.cashOffice || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-500">Float Amount</Label>
                                            <div className="text-sm font-medium mt-1">
                                                R {Number(cashierDetails.floatAmount || cashierDetails.float_amount || cashierDetails.cashFloat || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </>
                                )}
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
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="grid w-full grid-cols-5">
                                    <TabsTrigger value="cash" className="text-xs gap-1" data-testid="tab-cash">
                                        <Banknote className="w-3.5 h-3.5" /> Cash
                                    </TabsTrigger>
                                    <TabsTrigger value="cheque" className="text-xs gap-1" data-testid="tab-cheque">
                                        <FileText className="w-3.5 h-3.5" /> Cheques ({chequeList.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="card" className="text-xs gap-1" data-testid="tab-card">
                                        <CreditCard className="w-3.5 h-3.5" /> Cards ({cardList.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="dropbox" className="text-xs gap-1" data-testid="tab-dropbox">
                                        <Box className="w-3.5 h-3.5" /> Drop Box ({dropBoxList.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="reconcile" className="text-xs gap-1" data-testid="tab-reconcile">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Reconcile ({reconcileList.length})
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="cash" className="mt-4">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Cash Count</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {systemSettings.enableDenominationCounting ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                            <Banknote className="w-4 h-4" /> Notes
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {NOTE_DENOMINATIONS.map(d => (
                                                                <div key={d.key} className="grid grid-cols-[80px_100px_1fr] items-center gap-3">
                                                                    <span className="text-sm font-medium text-slate-600">{d.label}</span>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        className="h-8 text-center"
                                                                        value={denominations[d.key as keyof DenominationState] || ''}
                                                                        onChange={e => updateDenomination(d.key, parseInt(e.target.value) || 0)}
                                                                        data-testid={`input-${d.key}`}
                                                                    />
                                                                    <span className="text-sm text-slate-500 font-mono">
                                                                        = R {(denominations[d.key as keyof DenominationState] * d.value).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            <div className="pt-2 border-t flex justify-between">
                                                                <span className="text-sm font-semibold">Total Notes</span>
                                                                <span className="text-sm font-bold font-mono">R {totalNotes.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                            <Coins className="w-4 h-4" /> Coins
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {COIN_DENOMINATIONS.map(d => (
                                                                <div key={d.key} className="grid grid-cols-[80px_100px_1fr] items-center gap-3">
                                                                    <span className="text-sm font-medium text-slate-600">{d.label}</span>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        className="h-8 text-center"
                                                                        value={denominations[d.key as keyof DenominationState] || ''}
                                                                        onChange={e => updateDenomination(d.key, parseInt(e.target.value) || 0)}
                                                                        data-testid={`input-${d.key}`}
                                                                    />
                                                                    <span className="text-sm text-slate-500 font-mono">
                                                                        = R {(denominations[d.key as keyof DenominationState] * d.value).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            <div className="pt-2 border-t flex justify-between">
                                                                <span className="text-sm font-semibold">Total Coins</span>
                                                                <span className="text-sm font-bold font-mono">R {totalCoins.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="max-w-md">
                                                    <Label className="text-sm">Total Cash Amount</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        className="mt-1"
                                                        value={totalCashAmt || ''}
                                                        onChange={e => setTotalCashAmt(parseFloat(e.target.value) || 0)}
                                                        placeholder="Enter total cash on hand"
                                                        data-testid="input-total-cash"
                                                    />
                                                </div>
                                            )}

                                            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-semibold text-blue-800">Total Cash Counted</span>
                                                    <span className="text-lg font-bold text-blue-900 font-mono">
                                                        R {(systemSettings.enableDenominationCounting ? calculatedCashTotal : totalCashAmt).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="cheque" className="mt-4">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Cheque Receipts</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isLoadingReceipts ? (
                                                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading cheque receipts...
                                                </div>
                                            ) : chequeList.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground">No cheque receipts found.</div>
                                            ) : (
                                                <div className="border rounded-md overflow-auto max-h-[400px]">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50 sticky top-0">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-xs">#</TableHead>
                                                                <TableHead className="font-bold text-xs">Receipt No</TableHead>
                                                                <TableHead className="font-bold text-xs">Account</TableHead>
                                                                <TableHead className="font-bold text-xs">Date</TableHead>
                                                                <TableHead className="font-bold text-xs text-right">Amount</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {chequeList.map((item, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.accountNumber || item.accountId || '-'}</TableCell>
                                                                    <TableCell className="text-xs">{item.receiptDate || item.date || '-'}</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-medium">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex justify-between">
                                                <span className="text-sm font-semibold text-amber-800">Total Cheques</span>
                                                <span className="text-sm font-bold text-amber-900 font-mono">R {totalChequeAmt.toFixed(2)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="card" className="mt-4">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Card Receipts</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isLoadingReceipts ? (
                                                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading card receipts...
                                                </div>
                                            ) : cardList.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground">No card receipts found.</div>
                                            ) : (
                                                <div className="border rounded-md overflow-auto max-h-[400px]">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50 sticky top-0">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-xs">#</TableHead>
                                                                <TableHead className="font-bold text-xs">Receipt No</TableHead>
                                                                <TableHead className="font-bold text-xs">Account</TableHead>
                                                                <TableHead className="font-bold text-xs">Date</TableHead>
                                                                <TableHead className="font-bold text-xs text-right">Amount</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {cardList.map((item, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.accountNumber || item.accountId || '-'}</TableCell>
                                                                    <TableCell className="text-xs">{item.receiptDate || item.date || '-'}</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-medium">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                            <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200 flex justify-between">
                                                <span className="text-sm font-semibold text-purple-800">Total Card Payments</span>
                                                <span className="text-sm font-bold text-purple-900 font-mono">R {totalCreditAmt.toFixed(2)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="dropbox" className="mt-4">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Drop Box Receipts</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isLoadingReceipts ? (
                                                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading drop box receipts...
                                                </div>
                                            ) : dropBoxList.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground">No drop box receipts found.</div>
                                            ) : (
                                                <div className="border rounded-md overflow-auto max-h-[400px]">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50 sticky top-0">
                                                            <TableRow>
                                                                <TableHead className="font-bold text-xs">#</TableHead>
                                                                <TableHead className="font-bold text-xs">Receipt No</TableHead>
                                                                <TableHead className="font-bold text-xs">Account</TableHead>
                                                                <TableHead className="font-bold text-xs">Date</TableHead>
                                                                <TableHead className="font-bold text-xs text-right">Amount</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {dropBoxList.map((item, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="text-xs">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.receiptNo || item.receipt_no || '-'}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{item.accountNumber || item.accountId || '-'}</TableCell>
                                                                    <TableCell className="text-xs">{item.receiptDate || item.date || '-'}</TableCell>
                                                                    <TableCell className="text-xs text-right font-mono font-medium">R {Number(item.amount || 0).toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="reconcile" className="mt-4">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base">Reconcile List (System Receipts)</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {isLoadingReceipts ? (
                                                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading reconcile data...
                                                </div>
                                            ) : reconcileList.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground">No reconcile data found.</div>
                                            ) : (
                                                <div className="border rounded-md overflow-auto max-h-[400px]">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50 sticky top-0">
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
                                            <div className="mt-3 grid grid-cols-3 gap-3">
                                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                    <div className="text-xs text-blue-700">System Cash</div>
                                                    <div className="text-sm font-bold text-blue-900 font-mono">R {systemCashTotal.toFixed(2)}</div>
                                                </div>
                                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                    <div className="text-xs text-purple-700">System Card</div>
                                                    <div className="text-sm font-bold text-purple-900 font-mono">R {systemCardTotal.toFixed(2)}</div>
                                                </div>
                                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                    <div className="text-xs text-amber-700">System Cheque</div>
                                                    <div className="text-sm font-bold text-amber-900 font-mono">R {systemChequeTotal.toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        Reconciliation Summary
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-semibold text-slate-700 border-b pb-1">Cashier Totals</h4>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Cash</span>
                                                <span className="font-mono font-medium">R {(systemSettings.enableDenominationCounting ? calculatedCashTotal : totalCashAmt).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Cheques</span>
                                                <span className="font-mono font-medium">R {totalChequeAmt.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Card</span>
                                                <span className="font-mono font-medium">R {totalCreditAmt.toFixed(2)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between text-sm font-bold">
                                                <span>Cashier Grand Total</span>
                                                <span className="font-mono text-blue-700">R {cashierTotal.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-sm font-semibold text-slate-700 border-b pb-1">System Totals</h4>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Cash</span>
                                                <span className="font-mono font-medium">R {systemCashTotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Cheques</span>
                                                <span className="font-mono font-medium">R {systemChequeTotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Card</span>
                                                <span className="font-mono font-medium">R {systemCardTotal.toFixed(2)}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between text-sm font-bold">
                                                <span>System Grand Total</span>
                                                <span className="font-mono text-slate-700">R {systemTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`mt-4 p-4 rounded-lg border-2 flex items-center justify-between ${
                                        Math.abs(variance) < 0.01 ? 'bg-green-50 border-green-300' :
                                        Math.abs(variance) < 10 ? 'bg-amber-50 border-amber-300' :
                                        'bg-red-50 border-red-300'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            {Math.abs(variance) < 0.01 ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                            )}
                                            <span className="text-sm font-semibold">
                                                {Math.abs(variance) < 0.01 ? 'Balanced' : 'Variance'}
                                            </span>
                                        </div>
                                        <span className={`text-lg font-bold font-mono ${
                                            Math.abs(variance) < 0.01 ? 'text-green-700' :
                                            variance > 0 ? 'text-amber-700' : 'text-red-700'
                                        }`}>
                                            {variance > 0 ? '+' : ''}R {variance.toFixed(2)}
                                        </span>
                                    </div>

                                    {Math.abs(variance) >= 0.01 && (
                                        <div className="mt-4">
                                            <Label className="text-sm">Reason for Variance</Label>
                                            <Input
                                                className="mt-1"
                                                value={reason}
                                                onChange={e => setReason(e.target.value)}
                                                placeholder="Provide a reason for the variance..."
                                                data-testid="input-reason"
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end mt-6 gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setDenominations(INITIAL_DENOMINATIONS);
                                                setTotalCashAmt(0);
                                                setReason('');
                                            }}
                                            data-testid="button-reset"
                                        >
                                            <RefreshCw className="w-4 h-4 mr-2" /> Reset
                                        </Button>
                                        <Button
                                            className="bg-green-700 hover:bg-green-800"
                                            onClick={handleSaveReconcile}
                                            disabled={isSaving || !selectedCashierId}
                                            data-testid="button-save-reconcile"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Submit Reconciliation
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </PosLayout>
    );
}
