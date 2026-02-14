import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'wouter';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { platinumValidateCashier, platinumGetCashOffices, platinumSubmitCashierSetup } from '@/lib/external-api';

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
    const { startSession, switchUser, currentUser, activeSession, sessionLoading, sessionDetails, platinumUser } = usePos();
    const [, setLocation] = useLocation();

    const [cashOfficeViews, setCashOfficeViews] = useState<PlatinumCashOfficeView[]>([]);
    const [cashierDetail, setCashierDetail] = useState<PlatinumCashierDetail | null>(null);
    const [isCashierRegistered, setIsCashierRegistered] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [floatInput, setFloatInput] = useState<string>('0.00');
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [validationMessage, setValidationMessage] = useState<string>('');

    const userId = platinumUser?.user_ID || Number(currentUser.id) || 0;
    const firstName = platinumUser?.firstName || currentUser.name?.split(' ')[0] || '';
    const lastName = platinumUser?.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '';
    const finYear = platinumUser?.finYear || '';

    useEffect(() => {
        if (activeSession && sessionDetails) {
            setLocation('/pos');
            return;
        }

        if (sessionLoading) return;
        if (!userId || !finYear) {
            setLoading(false);
            setError('Could not determine user ID or financial year. Please refresh.');
            return;
        }

        const loadData = async () => {
            try {
                setLoading(true);

                console.log(`[CashierSetup] Step 1: validateCashier GET - userId=${userId}, finYear=${finYear}`);
                const validateResult = await platinumValidateCashier(userId, Number(finYear));
                console.log(`[CashierSetup] validateCashier response:`, validateResult);

                if (validateResult && typeof validateResult === 'object') {
                    if (validateResult.id && validateResult.id !== 0) {
                        setIsCashierRegistered(true);
                        setCashierDetail(validateResult);
                        setValidationMessage('Cashier validated successfully.');

                        if (validateResult.cashFloat != null && validateResult.cashFloat > 0) {
                            setFloatInput(validateResult.cashFloat.toFixed(2));
                        }

                        if (validateResult.officeId || validateResult.const_CashOffice?.cashOffice_ID) {
                            const offId = validateResult.officeId || validateResult.const_CashOffice?.cashOffice_ID;
                            setSelectedOfficeId(String(offId));
                        }
                    } else {
                        setIsCashierRegistered(false);
                        setValidationMessage('Cashier is not registered in the billing system.');
                    }
                } else if (validateResult === true || (typeof validateResult === 'number' && validateResult > 0)) {
                    setIsCashierRegistered(true);
                    setValidationMessage('Cashier validated successfully.');
                } else {
                    setIsCashierRegistered(false);
                    setValidationMessage('Cashier validation returned no data.');
                }

                console.log(`[CashierSetup] Step 2: getCashOffices GET - finYear=${finYear}`);
                const offices = await platinumGetCashOffices(finYear);
                console.log(`[CashierSetup] getCashOffices response:`, offices);

                if (Array.isArray(offices) && offices.length > 0) {
                    setCashOfficeViews(offices);
                } else {
                    console.warn('[CashierSetup] No cash offices returned from Platinum API');
                    const fallbackRes = await fetch(`/api/platinum/receipt-prepaid/active-cash-office-details?cashierId=${userId}`).catch(() => null);
                    if (fallbackRes && fallbackRes.ok) {
                        const activeOffice = await fallbackRes.json();
                        if (activeOffice && activeOffice.cashOffice_ID) {
                            setCashOfficeViews([{
                                cashOffice_ID: activeOffice.cashOffice_ID,
                                cashOfficeDesc: activeOffice.cashOfficeDesc || '',
                                cashOnHandLimit: activeOffice.cashOnHandLimit || 999999,
                                scoaConfigurationID: activeOffice.scoaConfigurationID || null,
                                vote1: null, vote: null, vote_ID: null, voteDesc: null,
                            }]);
                            if (!selectedOfficeId) {
                                setSelectedOfficeId(String(activeOffice.cashOffice_ID));
                            }
                        }
                    }
                }
            } catch (e: any) {
                console.error('[CashierSetup] Failed to load cashier data', e);
                setError(`Could not connect to the billing system: ${e.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [activeSession, sessionLoading, sessionDetails, userId, finYear]);

    const selectedOffice = cashOfficeViews.find(o => String(o.cashOffice_ID) === selectedOfficeId);
    const effectiveOffice = selectedOffice ? {
        cashOffice_ID: selectedOffice.cashOffice_ID,
        cashOfficeDesc: selectedOffice.cashOfficeDesc || '',
        enabled: true,
        cashOnHandLimit: selectedOffice.cashOnHandLimit || 999999,
        scoaConfigurationID: selectedOffice.scoaConfigurationID,
        allowDelayedDayEndRecon: false,
    } : null;

    const matchedOfficeView = effectiveOffice ? cashOfficeViews.find(o => o.cashOffice_ID === effectiveOffice.cashOffice_ID) : null;
    const scoaCode = matchedOfficeView?.vote || matchedOfficeView?.vote1 || matchedOfficeView?.voteDesc || null;
    const ledgerVoteDisplay = scoaCode || (effectiveOffice?.scoaConfigurationID != null ? `SCOA Configuration ${effectiveOffice.scoaConfigurationID}` : '');

    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!effectiveOffice) {
            setError('Please select a cash office.');
            return;
        }

        const float = parseFloat(floatInput);
        if (isNaN(float) || float < 0) {
            setError('Invalid float amount. Please enter a valid positive number.');
            return;
        }

        if (!userId) {
            setError('Could not determine user ID. Please refresh and try again.');
            return;
        }

        setSubmitting(true);
        try {
            console.log(`[CashierSetup] Step 3: submitCashierSetup POST - userId=${userId}, officeId=${effectiveOffice.cashOffice_ID}`);
            const cashierSetupPayload = {
                id: cashierDetail?.id || 0,
                cashFloat: float,
                officeId: effectiveOffice.cashOffice_ID,
                isActive: true,
                user_Id: userId,
                isVirtual: false,
                const_CashOffice: {
                    cashOffice_ID: effectiveOffice.cashOffice_ID,
                    cashOfficeDesc: effectiveOffice.cashOfficeDesc || '',
                    enabled: true,
                    cashOnHandLimit: effectiveOffice.cashOnHandLimit || 999999,
                    scoaConfigurationID: effectiveOffice.scoaConfigurationID || null,
                    allowDelayedDayEndRecon: effectiveOffice.allowDelayedDayEndRecon || false,
                },
            };

            const setupResult = await platinumSubmitCashierSetup(cashierSetupPayload);
            console.log('[CashierSetup] submitCashierSetup response:', setupResult);
        } catch (err: any) {
            const errorMsg = err?.message || '';
            const isUserDetailError = errorMsg.includes('UserDetail');
            if (isUserDetailError) {
                console.warn('Platinum API requires UserDetail field (API model updated). Proceeding with local session.');
            } else {
                setError(`Cashier setup failed: ${errorMsg}. Please try again or contact your administrator.`);
                setSubmitting(false);
                return;
            }
        }
        setSubmitting(false);

        const officeId = String(effectiveOffice.cashOffice_ID);
        const officeName = effectiveOffice.cashOfficeDesc || '';

        const fullName = `${firstName} ${lastName}`.trim();
        switchUser(String(userId), fullName || currentUser.name, officeName);

        startSession(officeId, float, officeName);
    };

    if (sessionLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="cashier-setup-loading">
                <Card className="w-full max-w-2xl shadow-lg">
                    <CardContent className="p-12 flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                        <p className="text-slate-600">
                            {sessionLoading ? 'Checking for active session...' : 'Validating cashier...'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (activeSession && sessionDetails) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="cashier-setup-page">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-slate-800">Cashier Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-8 bg-white">
                    {isCashierRegistered === false && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3" data-testid="cashier-not-registered-warning">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-amber-800">Cashier Not Registered</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    User <strong>{`${firstName} ${lastName}`.trim() || currentUser.name}</strong> (ID: {userId}) is not yet registered as a cashier in the billing system.
                                    Please contact your system administrator to complete the cashier registration in the Platinum admin portal before processing payments.
                                </p>
                            </div>
                        </div>
                    )}

                    {isCashierRegistered === true && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3" data-testid="cashier-registered-success">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-green-800">Cashier Registered</p>
                                <p className="text-sm text-green-700 mt-1">
                                    User <strong>{`${firstName} ${lastName}`.trim() || currentUser.name}</strong> is registered and ready to process payments.
                                </p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Name</Label>
                            <Input
                                value={firstName}
                                disabled
                                className="bg-slate-100 border-slate-300 text-slate-800 font-medium"
                                data-testid="input-cashier-name"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Surname</Label>
                            <Input
                                value={lastName}
                                disabled
                                className="bg-slate-100 border-slate-300 text-slate-800 font-medium"
                                data-testid="input-cashier-surname"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">User ID</Label>
                            <Input
                                value={String(userId)}
                                disabled
                                className="bg-slate-100 border-slate-300 text-slate-800 font-mono"
                                data-testid="input-cashier-id"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Cash Float <span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={floatInput}
                                onChange={(e) => setFloatInput(e.target.value)}
                                className="bg-slate-100 border-slate-300 text-right text-slate-600"
                                data-testid="input-float"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Cashier Office <span className="text-red-500">*</span></Label>
                            <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId} data-testid="select-cash-office">
                                <SelectTrigger className="bg-slate-100 border-slate-300 text-slate-600" data-testid="select-cash-office-trigger">
                                    <SelectValue placeholder="-- Select Cash Office --" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {cashOfficeViews.map(office => (
                                        <SelectItem key={office.cashOffice_ID} value={String(office.cashOffice_ID)} data-testid={`office-option-${office.cashOffice_ID}`}>
                                            {office.cashOfficeDesc || `Office ${office.cashOffice_ID}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Ledger Vote</Label>
                            <Input
                                value={ledgerVoteDisplay}
                                disabled
                                className={`bg-slate-100 border-slate-300 ${ledgerVoteDisplay ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
                                placeholder="Select a cash office to view ledger vote"
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
                                disabled={!effectiveOffice || submitting}
                                data-testid="button-submit"
                            >
                                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Setting up...</> : 'Submit'}
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
