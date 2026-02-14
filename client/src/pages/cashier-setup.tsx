import React, { useState, useEffect } from 'react';
import { usePos } from '@/lib/pos-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { Loader2, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { platinumValidateCashier, platinumGetCashOffices, platinumSubmitCashierSetup } from '@/lib/external-api';

interface CashOfficeViewModel {
    cashOffice_ID: number;
    cashOfficeDesc: string | null;
    cashOnHandLimit: number | null;
    scoaConfigurationID: number | null;
    vote1: string | null;
    vote: string | null;
    vote_ID: number | null;
    voteDesc: string | null;
}

interface POS_CashierReconcile {
    cashierReconcile_Id: number;
    cashierId: number | null;
    totalCashAmt: number | null;
    totalChequeAmt: number | null;
    totalAmt: number | null;
}

type StepStatus = 'pending' | 'loading' | 'success' | 'error';

export default function CashierSetup() {
    const { startSession, switchUser, currentUser, activeSession, sessionLoading, sessionDetails, platinumUser } = usePos();
    const [, setLocation] = useLocation();

    const [step1Status, setStep1Status] = useState<StepStatus>('pending');
    const [step2Status, setStep2Status] = useState<StepStatus>('pending');
    const [step3Status, setStep3Status] = useState<StepStatus>('pending');

    const [validateResult, setValidateResult] = useState<POS_CashierReconcile | null>(null);
    const [cashOffices, setCashOffices] = useState<CashOfficeViewModel[]>([]);
    const [isCashierRegistered, setIsCashierRegistered] = useState<boolean | null>(null);

    const [floatInput, setFloatInput] = useState<string>('0.00');
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

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
            setError('Could not determine user ID or financial year. Please refresh.');
            return;
        }

        const runSetupFlow = async () => {
            setStep1Status('loading');
            setStep2Status('pending');
            setError('');

            try {
                console.log(`[CashierSetup] Step 1: validateCashier GET — userId=${userId}, finYear=${finYear}`);
                const result = await platinumValidateCashier(userId, finYear);
                console.log(`[CashierSetup] Step 1 response:`, JSON.stringify(result));

                let registered = false;

                if (result && typeof result === 'object' && !result._error) {
                    const cashierId = result.cashierId ?? result.cashierReconcile_Id ?? result.id ?? null;
                    if (cashierId !== null && cashierId !== 0) {
                        registered = true;
                        setValidateResult(result);
                    } else if (result.cashierId === null && result.cashierReconcile_Id != null && result.cashierReconcile_Id !== 0) {
                        registered = true;
                        setValidateResult(result);
                    }
                }

                if (!registered) {
                    try {
                        const fallbackRes = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${userId}`);
                        if (fallbackRes.ok) {
                            const fallbackData = await fallbackRes.json();
                            console.log(`[CashierSetup] Step 1 fallback (active-cashier-by-userid):`, JSON.stringify(fallbackData));
                            if (fallbackData.cashierRegistered === true || fallbackData.cashierId) {
                                registered = true;
                                setValidateResult({
                                    cashierReconcile_Id: 0,
                                    cashierId: fallbackData.cashierId || userId,
                                    totalCashAmt: null,
                                    totalChequeAmt: null,
                                    totalAmt: null,
                                });
                            }
                        }
                    } catch {}
                }

                setIsCashierRegistered(registered);
                setStep1Status(registered ? 'success' : 'error');

                if (!registered) {
                    return;
                }
            } catch (e: any) {
                console.error('[CashierSetup] Step 1 failed:', e);
                try {
                    const fallbackRes = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${userId}`);
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        if (fallbackData.cashierRegistered === true || fallbackData.cashierId) {
                            setIsCashierRegistered(true);
                            setValidateResult({
                                cashierReconcile_Id: 0,
                                cashierId: fallbackData.cashierId || userId,
                                totalCashAmt: null,
                                totalChequeAmt: null,
                                totalAmt: null,
                            });
                            setStep1Status('success');
                        } else {
                            setIsCashierRegistered(false);
                            setStep1Status('error');
                            return;
                        }
                    } else {
                        setIsCashierRegistered(false);
                        setStep1Status('error');
                        return;
                    }
                } catch {
                    setError('Unable to connect to the billing system. Please try again later.');
                    setStep1Status('error');
                    return;
                }
            }

            setStep2Status('loading');
            try {
                console.log(`[CashierSetup] Step 2: getCashOffices GET — finYear=${finYear}`);
                const offices = await platinumGetCashOffices(finYear);
                console.log(`[CashierSetup] Step 2 response: ${Array.isArray(offices) ? offices.length : 0} offices`);

                if (Array.isArray(offices) && offices.length > 0) {
                    setCashOffices(offices);
                    setStep2Status('success');
                } else {
                    console.warn('[CashierSetup] No offices returned');
                    setCashOffices([]);
                    setStep2Status('error');
                    setError('No cash offices found. Please contact your administrator.');
                }
            } catch (e: any) {
                console.error('[CashierSetup] Step 2 failed:', e);
                setStep2Status('error');
                setError('Failed to load cash offices. Please try again.');
            }
        };

        runSetupFlow();
    }, [activeSession, sessionLoading, sessionDetails, userId, finYear]);

    const selectedOffice = cashOffices.find(o => String(o.cashOffice_ID) === selectedOfficeId);
    const scoaCode = selectedOffice?.vote || selectedOffice?.vote1 || selectedOffice?.voteDesc || null;
    const ledgerVoteDisplay = scoaCode || (selectedOffice?.scoaConfigurationID != null ? `SCOA Config ${selectedOffice.scoaConfigurationID}` : '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedOffice) {
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
        setStep3Status('loading');

        try {
            console.log(`[CashierSetup] Step 3: submitCashierSetup POST — userId=${userId}, officeId=${selectedOffice.cashOffice_ID}`);

            const cashierSetupPayload = {
                id: validateResult?.cashierId || 0,
                cashFloat: float,
                stsPort: 1,
                plesseyPort: 1,
                officeId: selectedOffice.cashOffice_ID,
                isActive: true,
                user_Id: userId,
                isVirtual: false,
                const_CashOffice: {
                    cashOffice_ID: selectedOffice.cashOffice_ID,
                    cashOfficeDesc: selectedOffice.cashOfficeDesc || '',
                    enabled: true,
                    cashOnHandLimit: selectedOffice.cashOnHandLimit || 999999,
                    scoaConfigurationID: selectedOffice.scoaConfigurationID || null,
                    allowDelayedDayEndRecon: true,
                    delayDaysSincePreviousDayEndRecon: 2,
                },
            };

            console.log('[CashierSetup] Step 3 payload:', JSON.stringify(cashierSetupPayload));
            const setupResult = await platinumSubmitCashierSetup(cashierSetupPayload);
            console.log('[CashierSetup] Step 3 response:', JSON.stringify(setupResult));

            if (setupResult && setupResult._error) {
                throw new Error(setupResult.message || setupResult._error || 'Setup failed');
            }

            setStep3Status('success');
        } catch (err: any) {
            const errorMsg = err?.message || '';
            const isUserDetailError = errorMsg.includes('UserDetail');
            if (isUserDetailError) {
                console.warn('[CashierSetup] UserDetail warning — proceeding with local session');
                setStep3Status('success');
            } else {
                setError(`Cashier setup failed: ${errorMsg}`);
                setStep3Status('error');
                setSubmitting(false);
                return;
            }
        }

        setSubmitting(false);

        const officeId = String(selectedOffice.cashOffice_ID);
        const officeName = selectedOffice.cashOfficeDesc || '';
        const fullName = `${firstName} ${lastName}`.trim();
        switchUser(String(userId), fullName || currentUser.name, officeName);
        startSession(officeId, float, officeName);
    };

    const StepIndicator = ({ step, label, status }: { step: number; label: string; status: StepStatus }) => (
        <div className="flex items-center gap-2 text-sm" data-testid={`step-${step}-indicator`}>
            {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {status === 'error' && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {status === 'pending' && <Circle className="h-4 w-4 text-slate-300" />}
            <span className={status === 'loading' ? 'text-blue-600' : status === 'success' ? 'text-green-700' : status === 'error' ? 'text-red-600' : 'text-slate-400'}>
                Step {step}: {label}
            </span>
            {status === 'loading' && <Badge variant="outline" className="text-xs text-blue-500 border-blue-200">In Progress</Badge>}
            {status === 'success' && <Badge variant="outline" className="text-xs text-green-500 border-green-200">Done</Badge>}
            {status === 'error' && <Badge variant="outline" className="text-xs text-red-500 border-red-200">Failed</Badge>}
        </div>
    );

    if (sessionLoading || (step1Status === 'loading' && step2Status === 'pending')) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="cashier-setup-loading">
                <Card className="w-full max-w-2xl shadow-lg">
                    <CardContent className="p-12 flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                        <p className="text-slate-600">
                            {sessionLoading ? 'Checking for active session...' : 'Validating cashier registration...'}
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
                    <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5" data-testid="step-indicators">
                        <StepIndicator step={1} label="Validate Cashier" status={step1Status} />
                        <StepIndicator step={2} label="Load Cash Offices" status={step2Status} />
                        <StepIndicator step={3} label="Submit Setup" status={step3Status} />
                    </div>

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
                                <p className="font-medium text-green-800">Cashier Validated</p>
                                <p className="text-sm text-green-700 mt-1">
                                    User <strong>{`${firstName} ${lastName}`.trim() || currentUser.name}</strong> is registered.
                                    {validateResult?.cashierId ? ` Cashier ID: ${validateResult.cashierId}` : ''}
                                    {' '}Select your cash office and float amount below.
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
                                disabled={isCashierRegistered !== true}
                                data-testid="input-float"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                            <Label className="text-left sm:text-right text-slate-600 text-sm">Cashier Office <span className="text-red-500">*</span></Label>
                            <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId} disabled={isCashierRegistered !== true || cashOffices.length === 0} data-testid="select-cash-office">
                                <SelectTrigger className="bg-slate-100 border-slate-300 text-slate-600" data-testid="select-cash-office-trigger">
                                    <SelectValue placeholder={step2Status === 'loading' ? 'Loading offices...' : '-- Select Cash Office --'} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {cashOffices.map(office => (
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
                                disabled={!selectedOffice || submitting || isCashierRegistered !== true}
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
