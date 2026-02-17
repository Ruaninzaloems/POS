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
import { platinumGetCashOffices } from '@/lib/external-api';

interface CashOfficeViewModel {
    cashOffice_ID: number;
    cashOfficeDesc: string | null;
    cashOnHandLimit: number | null;
    scoaConfigurationID: number | null;
    vote1: string | null;
    vote: string | null;
    vote_ID: number | null;
    voteDesc: string | null;
    cashOfficeScoaItemID?: number | null;
}

type StepStatus = 'pending' | 'loading' | 'success' | 'error';

export default function CashierSetup() {
    const { startSession, switchUser, currentUser, activeSession, sessionLoading, sessionDetails, platinumUser } = usePos();
    const [, setLocation] = useLocation();

    const [step1Status, setStep1Status] = useState<StepStatus>('pending');
    const [step2Status, setStep2Status] = useState<StepStatus>('pending');
    const [step3Status, setStep3Status] = useState<StepStatus>('pending');

    const [cashOffices, setCashOffices] = useState<CashOfficeViewModel[]>([]);
    const [isCashierRegistered, setIsCashierRegistered] = useState<boolean | null>(null);
    const [cashierId, setCashierId] = useState<number | null>(null);
    const [cashierDetails, setCashierDetails] = useState<any>(null);

    const [floatInput, setFloatInput] = useState<string>('0.00');
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const userId = platinumUser?.user_ID || Number(currentUser.id) || 0;
    const firstName = platinumUser?.firstName || currentUser.name?.split(' ')[0] || '';
    const lastName = platinumUser?.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '';
    const finYear = platinumUser?.finYear || '';

    const [setupComplete, setSetupComplete] = useState(false);
    const [resumingSession, setResumingSession] = useState(false);

    useEffect(() => {
        if (setupComplete && activeSession && sessionDetails) {
            setLocation('/pos');
            return;
        }

        if (sessionLoading) return;
        if (!userId) {
            setError('Could not determine user ID. Please refresh.');
            return;
        }

        const runSetupFlow = async () => {
            setStep1Status('loading');
            setStep2Status('pending');
            setError('');

            try {
                console.log(`[CashierSetup] Step 1: Validate cashier registration — userId=${userId}`);
                const res = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${userId}`);
                if (!res.ok) {
                    throw new Error('Failed to check cashier registration');
                }
                const data = await res.json();
                console.log(`[CashierSetup] Step 1 response:`, JSON.stringify(data));

                if (data.cashierRegistered === true && data.cashierId) {
                    setIsCashierRegistered(true);
                    setCashierId(data.cashierId);
                    setCashierDetails(data.details || null);
                    setStep1Status('success');

                    if (data.isActive === true && data.officeId) {
                        console.log(`[CashierSetup] Active session detected — auto-resuming session for office ${data.officeName} (ID: ${data.officeId})`);
                        setResumingSession(true);
                        setStep2Status('success');
                        setStep3Status('success');

                        const officeId = String(data.officeId);
                        const officeName = data.officeName || data.details?.const_CashOffice?.cashOfficeDesc || '';
                        const cashFloat = data.cashFloat ?? data.details?.cashFloat ?? 0;
                        const fullName = `${firstName} ${lastName}`.trim();
                        switchUser(String(userId), fullName || currentUser.name, officeName);
                        startSession(officeId, cashFloat, officeName);

                        setSetupComplete(true);
                        return;
                    }

                    const currentOfficeId = data.officeId || data.details?.officeId;
                    if (currentOfficeId) {
                        setSelectedOfficeId(String(currentOfficeId));
                        console.log(`[CashierSetup] Pre-selected office ID ${currentOfficeId} from Platinum record`);
                    }

                    if (data.cashFloat != null) {
                        setFloatInput(String(data.cashFloat));
                    }
                } else {
                    setIsCashierRegistered(false);
                    setStep1Status('error');
                    return;
                }
            } catch (e: any) {
                console.error('[CashierSetup] Step 1 failed:', e);
                setIsCashierRegistered(false);
                setStep1Status('error');
                setError('Unable to connect to the billing system. Please try again later.');
                return;
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
    const hasValidVote = !!(scoaCode && selectedOffice?.vote_ID);
    const ledgerVoteDisplay = scoaCode || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedOffice) {
            setError('Please select a cash office.');
            return;
        }

        if (!hasValidVote) {
            setError('This cash office does not have a valid SCOA vote configured. Please contact your administrator to set up the SCOA configuration for this office before proceeding.');
            return;
        }

        const float = parseFloat(floatInput);
        if (isNaN(float) || float < 0) {
            setError('Cash float must be 0 or greater.');
            return;
        }

        if (!userId) {
            setError('Could not determine user ID. Please refresh and try again.');
            return;
        }

        setSubmitting(true);
        setStep3Status('loading');

        try {
            const now = new Date().toISOString();
            const prevOffice = cashierDetails?.const_CashOffice || {};

            const payload = {
                id: cashierId || cashierDetails?.id || 0,
                cashFloat: float,
                stsPort: cashierDetails?.stsPort ?? 0,
                plesseyPort: cashierDetails?.plesseyPort ?? 0,
                officeId: selectedOffice.cashOffice_ID,
                isActive: true,
                dateCaptured: cashierDetails?.dateCaptured || now,
                capturerId: cashierDetails?.capturerId ?? 0,
                dateModified: now,
                modifiredId: cashierDetails?.modifiredId ?? 0,
                user_Id: userId,
                sourceReferenceID: cashierDetails?.sourceReferenceID || "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                offlineReconciled: cashierDetails?.offlineReconciled ?? 0,
                offlineRelations: cashierDetails?.offlineRelations || "",
                isVirtual: false,
                const_CashOffice: {
                    cashOffice_ID: selectedOffice.cashOffice_ID,
                    cashOfficeDesc: selectedOffice.cashOfficeDesc || '',
                    enabled: true,
                    dateCaptured: prevOffice.dateCaptured || now,
                    capturerID: prevOffice.capturerID ?? 0,
                    dateModified: prevOffice.dateModified || now,
                    modifierID: prevOffice.modifierID ?? 0,
                    groupCashiers: prevOffice.groupCashiers ?? false,
                    cashOnHandLimit: selectedOffice.cashOnHandLimit ?? prevOffice.cashOnHandLimit ?? 999999,
                    scoaConfigurationID: selectedOffice.scoaConfigurationID ?? prevOffice.scoaConfigurationID ?? 4,
                    classificationID: prevOffice.classificationID ?? 0,
                    allowDelayedDayEndRecon: prevOffice.allowDelayedDayEndRecon ?? true,
                    delayDaysSincePreviousDayEndRecon: prevOffice.delayDaysSincePreviousDayEndRecon ?? 2,
                    cashOfficeScoaItemID: selectedOffice.vote_ID || selectedOffice.cashOfficeScoaItemID || prevOffice.cashOfficeScoaItemID || null,
                },
            };

            console.log(`[CashierSetup] Step 3: submit-cashier-setup POST — userId=${userId}, officeId=${selectedOffice.cashOffice_ID}`);
            console.log(`[CashierSetup] Step 3 payload:`, JSON.stringify(payload));

            const res = await fetch('/api/platinum/receipt-prepaid/submit-cashier-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const responseData = await res.json().catch(() => null);
            console.log(`[CashierSetup] Step 3 submit response:`, JSON.stringify(responseData));

            if (!res.ok) {
                throw new Error(responseData?.detail || responseData?.message || `HTTP ${res.status}`);
            }

            const apiMessage = responseData?.message || '';
            console.log(`[CashierSetup] Platinum submit message: "${apiMessage}"`);

            console.log(`[CashierSetup] Step 3 VERIFY: Calling validate-cashier to confirm session is active for userId=${userId}`);
            const verifyRes = await fetch(`/api/platinum/receipt-prepaid/validate-cashier?userId=${userId}&finYear=${encodeURIComponent(finYear)}`);
            const verifyData = await verifyRes.json().catch(() => null);
            console.log(`[CashierSetup] Step 3 VERIFY (validate-cashier) response:`, JSON.stringify(verifyData));

            const submitCashier = responseData?.cashier;
            const submitIsActive = submitCashier?.isActive === true;
            const submitId = submitCashier?.id || 0;

            const validateCashierId = verifyData?.cashierId || verifyData?.cashierReconcile_Id || 0;
            const verifyConfirmed = validateCashierId > 0 || (submitIsActive && apiMessage === 'Cashier Setup Added' && submitId > 0);

            if (!verifyConfirmed) {
                const reason = apiMessage || 'Platinum did not activate the session.';
                console.error(`[CashierSetup] VERIFY FAILED — submit isActive=${submitIsActive}, submitId=${submitId}, validateCashierId=${validateCashierId}, message="${reason}"`);
                throw new Error(`Session not activated by Platinum: ${reason}. Please check your setup and try again.`);
            }

            const verifiedCashierId = validateCashierId || submitId;
            const verifiedFloat = submitCashier?.cashFloat ?? float;
            const verifiedOfficeId = submitCashier?.officeId || selectedOffice.cashOffice_ID;
            const verifiedOfficeName = selectedOffice.cashOfficeDesc || '';

            console.log(`[CashierSetup] VERIFY PASSED — CashierId: ${verifiedCashierId}, Office: ${verifiedOfficeName} (ID: ${verifiedOfficeId}), Float: ${verifiedFloat}, validate-cashier returned cashierId: ${validateCashierId}, submit returned id: ${submitId}`);

            const officeId = String(verifiedOfficeId || selectedOffice.cashOffice_ID);
            const officeName = verifiedOfficeName;
            const fullName = `${firstName} ${lastName}`.trim();

            switchUser(String(userId), fullName || currentUser.name, officeName);
            startSession(officeId, verifiedFloat, officeName);

            setStep3Status('success');
            setSetupComplete(true);
            console.log(`[CashierSetup] Session started — verified active by Platinum. Cashier record ID: ${verifiedCashierId}`);
        } catch (err: any) {
            console.error('[CashierSetup] Step 3 failed:', err);
            setError(`Failed to start session: ${err?.message || 'Unknown error'}. Please try again.`);
            setStep3Status('error');
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
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

    if (sessionLoading || (step1Status === 'loading' && step2Status === 'pending') || resumingSession) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="cashier-setup-loading">
                <Card className="w-full max-w-2xl shadow-lg">
                    <CardContent className="p-12 flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                        <p className="text-slate-600">
                            {resumingSession ? 'Resuming your active session...' : sessionLoading ? 'Checking for active session...' : 'Validating cashier registration...'}
                        </p>
                        {resumingSession && (
                            <p className="text-sm text-slate-500">You have an active cashier session. Redirecting to POS...</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (setupComplete && activeSession && sessionDetails) {
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
                        <StepIndicator step={3} label="Start Session" status={step3Status} />
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
                                    User <strong>{`${firstName} ${lastName}`.trim() || currentUser.name}</strong> (User ID: {userId}) is registered as a cashier.
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
                            <div className="space-y-1">
                                <Input
                                    value={ledgerVoteDisplay}
                                    disabled
                                    className={`bg-slate-100 border-slate-300 ${hasValidVote ? 'text-slate-800 font-medium' : selectedOffice ? 'text-red-500 border-red-300' : 'text-slate-400'}`}
                                    placeholder="Select a cash office to view ledger vote"
                                    data-testid="input-ledger-vote"
                                />
                                {selectedOffice && !hasValidVote && (
                                    <p className="text-xs text-red-500 flex items-center gap-1" data-testid="text-vote-error">
                                        <AlertTriangle className="h-3 w-3" />
                                        No SCOA vote configured for this cash office. Contact your administrator.
                                    </p>
                                )}
                            </div>
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
