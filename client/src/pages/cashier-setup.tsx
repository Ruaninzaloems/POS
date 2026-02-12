import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

interface PlatinumCashier {
    id: number;
    name: string;
}

interface PlatinumCashOfficeView {
    cashOffice_ID: number;
    cashOfficeDesc: string | null;
    cashOnHandLimit: number | null;
    scoaConfigurationID: number | null;
    vote1: string | null;
    vote: string | null;
    vote_ID: number | null;
    voteDesc: string | null;
}

interface PlatinumCashierDetail {
    id: number;
    cashFloat: number | null;
    officeId: number | null;
    isActive: boolean | null;
    user_Id: number | null;
    const_CashOffice: {
        cashOffice_ID: number;
        cashOfficeDesc: string;
        enabled: boolean;
        cashOnHandLimit: number;
        scoaConfigurationID: number | null;
        allowDelayedDayEndRecon: boolean;
    } | null;
}

export default function CashierSetup() {
    const { startSession, switchUser } = usePos();
    const [, setLocation] = useLocation();

    const [cashiers, setCashiers] = useState<PlatinumCashier[]>([]);
    const [cashOfficeViews, setCashOfficeViews] = useState<PlatinumCashOfficeView[]>([]);
    const [selectedCashierId, setSelectedCashierId] = useState<string>('');
    const [cashierDetail, setCashierDetail] = useState<PlatinumCashierDetail | null>(null);
    const [loadingCashiers, setLoadingCashiers] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [floatInput, setFloatInput] = useState<string>('0.00');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoadingCashiers(true);
                const [cashierRes, officesRes] = await Promise.all([
                    fetch('/api/platinum/auth-day-end/cashier-list'),
                    fetch('/api/platinum/receipt-prepaid/cash-offices').catch(() => null)
                ]);
                if (cashierRes.ok) {
                    const data = await cashierRes.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setCashiers(data);
                    }
                }
                if (officesRes && officesRes.ok) {
                    const data = await officesRes.json();
                    if (Array.isArray(data)) {
                        setCashOfficeViews(data);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch cashier list from Platinum API', e);
            } finally {
                setLoadingCashiers(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedCashierId) {
            setCashierDetail(null);
            return;
        }

        const loadCashierDetails = async () => {
            try {
                setLoadingDetails(true);
                setError('');
                const res = await fetch(`/api/platinum/receipt-prepaid/cashier-details-by-id?cashierId=${selectedCashierId}`);
                if (res.ok) {
                    const data = await res.json();
                    setCashierDetail(data);
                    if (data.cashFloat != null) {
                        setFloatInput(data.cashFloat.toFixed(2));
                    } else {
                        setFloatInput('0.00');
                    }
                } else {
                    setError('Could not load cashier details.');
                }
            } catch (e) {
                console.warn('Failed to fetch cashier details', e);
                setError('Could not connect to the server.');
            } finally {
                setLoadingDetails(false);
            }
        };
        loadCashierDetails();
    }, [selectedCashierId]);

    const selectedCashierName = cashiers.find(c => c.id.toString() === selectedCashierId)?.name || '';
    const cashOffice = cashierDetail?.const_CashOffice;
    const matchedOfficeView = cashOffice ? cashOfficeViews.find(o => o.cashOffice_ID === cashOffice.cashOffice_ID) : null;
    const ledgerVoteDisplay = matchedOfficeView?.voteDesc || matchedOfficeView?.vote || matchedOfficeView?.vote1 || (cashOffice?.scoaConfigurationID != null ? String(cashOffice.scoaConfigurationID) : '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedCashierId) {
            setError('Please select a cashier.');
            return;
        }

        if (!cashOffice) {
            setError('No cash office assigned to this cashier.');
            return;
        }

        const float = parseFloat(floatInput);
        if (isNaN(float) || float < 0) {
            setError('Invalid float amount. Please enter a valid positive number.');
            return;
        }

        const officeId = cashOffice.cashOffice_ID.toString();
        const officeName = cashOffice.cashOfficeDesc;

        switchUser(selectedCashierId, selectedCashierName, officeName);

        try {
            await fetch('/api/platinum/receipt-prepaid/submit-cashier-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: parseInt(selectedCashierId),
                    cashFloat: float,
                    officeId: cashOffice.cashOffice_ID,
                    isActive: true,
                    user_Id: parseInt(selectedCashierId),
                }),
            });
        } catch (e) {
            console.warn('Failed to submit cashier setup to Platinum API', e);
        }

        startSession(officeId, float, officeName);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="cashier-setup-page">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-slate-800">Cashier Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-8 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Name <span className="text-red-500">*</span></Label>
                            {loadingCashiers ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading cashiers...
                                </div>
                            ) : (
                                <Select value={selectedCashierId} onValueChange={setSelectedCashierId} data-testid="select-cashier">
                                    <SelectTrigger className="bg-slate-100 border-slate-300 text-slate-600" data-testid="select-cashier-trigger">
                                        <SelectValue placeholder="-- Select Cashier --" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {cashiers.map(cashier => (
                                            <SelectItem key={cashier.id} value={cashier.id.toString()} data-testid={`cashier-option-${cashier.id}`}>
                                                {cashier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Cash Float (Starting Amount Cash On Hand) <span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={floatInput}
                                onChange={(e) => setFloatInput(e.target.value)}
                                className="bg-slate-100 border-slate-300 text-right text-slate-600"
                                data-testid="input-float"
                            />
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Cashier Office <span className="text-red-500">*</span></Label>
                            {loadingDetails ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading office...
                                </div>
                            ) : (
                                <Input
                                    value={cashOffice ? cashOffice.cashOfficeDesc : ''}
                                    disabled
                                    className={`bg-slate-100 border-slate-300 ${cashOffice ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
                                    placeholder={selectedCashierId ? 'No office assigned' : 'Select a cashier first'}
                                    data-testid="input-cash-office"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Ledger Vote <span className="text-red-500">*</span></Label>
                            <Input
                                value={ledgerVoteDisplay}
                                disabled
                                className={`bg-slate-100 border-slate-300 ${ledgerVoteDisplay ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
                                placeholder="Select a cashier to view ledger vote"
                                data-testid="input-ledger-vote"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded" data-testid="text-error">
                                {error}
                            </div>
                        )}

                        <Separator className="my-6" />

                        <div className="flex justify-center gap-4">
                            <Button
                                type="submit"
                                className="w-32 bg-slate-800 hover:bg-slate-900"
                                disabled={!selectedCashierId || loadingDetails || !cashOffice}
                                data-testid="button-submit"
                            >
                                Submit
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-32 bg-slate-700 hover:bg-slate-800 text-white hover:text-white border-slate-700"
                                onClick={() => setLocation('/')}
                                data-testid="button-cancel"
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
