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
import { Loader2, AlertTriangle, CheckCircle2, Circle, ShieldCheck, CreditCard, Banknote, XCircle, RefreshCw } from 'lucide-react';
import { platinumGetCashOffices, fetchCashierPaymentOptions, fetchCashierPaymentTypes, validateReceiptRange, CashierPaymentOption, CashierPaymentType, ReceiptRangeValidation } from '@/lib/external-api';

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

    const [paymentOptions, setPaymentOptions] = useState<CashierPaymentOption[]>([]);
    const [paymentTypes, setPaymentTypes] = useState<CashierPaymentType[]>([]);
    const [paymentOptionsSource, setPaymentOptionsSource] = useState<string>('');
    const [paymentTypesSource, setPaymentTypesSource] = useState<string>('');
    const [receiptRangeStatus, setReceiptRangeStatus] = useState<ReceiptRangeValidation | null>(null);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState<string>('');

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
                const res = await fetch(`/api/platinum/auth/active-cashier-by-userid?userid=${userId}&finYear=${encodeURIComponent(finYear)}`);
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
                        console.log(`[CashierSetup] Platinum shows active session for office ${data.officeName} (ID: ${data.officeId}) — cashier must confirm to resume`);
                        setResumingSession(true);
                        setStep2Status('success');
                        setStep3Status('pending');
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

    useEffect(() => {
        if (!isCashierRegistered || !cashierId || !selectedOfficeId || !userId) return;

        const loadCashierConfig = async () => {
            setConfigLoading(true);
            setConfigError('');
            const officeId = Number(selectedOfficeId);

            try {
                const [optionsResult, typesResult, rangeResult] = await Promise.all([
                    fetchCashierPaymentOptions(cashierId, userId, officeId),
                    fetchCashierPaymentTypes(cashierId, userId, officeId),
                    validateReceiptRange(userId, cashierId, finYear || undefined, officeId)
                ]);

                setPaymentOptions(optionsResult.data || []);
                setPaymentOptionsSource(optionsResult.source || '');
                setPaymentTypes(typesResult.data || []);
                setPaymentTypesSource(typesResult.source || '');
                setReceiptRangeStatus(rangeResult);

                if (optionsResult.data?.length === 0 && typesResult.data?.length === 0) {
                    setConfigError('Could not load payment configuration from the billing system.');
                }
            } catch (e: any) {
                console.warn('[CashierSetup] Failed to load cashier config:', e);
                setConfigError('Failed to load cashier configuration. Click retry to try again.');
            } finally {
                setConfigLoading(false);
            }
        };

        loadCashierConfig();
    }, [isCashierRegistered, cashierId, selectedOfficeId, userId, finYear]);

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
            setError('Cash float must be a valid number.');
            return;
        }

        if (!userId) {
            setError('Could not determine user ID. Please refresh and try again.');
            return;
        }

        setSubmitting(true);
        setStep3Status('loading');

        try {
            const nowSAST = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().replace('Z', '');
            const prevOffice = cashierDetails?.const_CashOffice || {};

            const payload = {
                id: 0,
                cashFloat: float,
                stsPort: null,
                plesseyPort: null,
                officeId: selectedOffice.cashOffice_ID,
                isActive: true,
                dateCaptured: nowSAST,
                capturerId: userId,
                dateModified: null,
                modifiredId: null,
                user_Id: userId,
                sourceReferenceID: null,
                offlineReconciled: null,
                offlineRelations: null,
                isVirtual: null,
                const_CashOffice: {
                    cashOffice_ID: selectedOffice.cashOffice_ID,
                    cashOfficeDesc: selectedOffice.cashOfficeDesc || '',
                    enabled: prevOffice.enabled ?? true,
                    dateCaptured: prevOffice.dateCaptured || nowSAST,
                    capturerID: prevOffice.capturerID ?? 0,
                    dateModified: prevOffice.dateModified ?? null,
                    modifierID: prevOffice.modifierID ?? null,
                    groupCashiers: prevOffice.groupCashiers ?? false,
                    cashOnHandLimit: selectedOffice.cashOnHandLimit ?? prevOffice.cashOnHandLimit ?? 999999,
                    scoaConfigurationID: selectedOffice.scoaConfigurationID ?? prevOffice.scoaConfigurationID ?? 4,
                    classificationID: prevOffice.classificationID ?? null,
                    allowDelayedDayEndRecon: prevOffice.allowDelayedDayEndRecon ?? true,
                    delayDaysSincePreviousDayEndRecon: prevOffice.delayDaysSincePreviousDayEndRecon ?? 1,
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

            if (apiMessage && apiMessage !== 'Cashier Setup Added') {
                console.error(`[CashierSetup] Platinum rejected setup: "${apiMessage}". Full response:`, JSON.stringify(responseData));
                throw new Error(`Platinum API rejected the setup: "${apiMessage}". Full response: ${JSON.stringify(responseData)}`);
            }

            const submitCashier = responseData?.cashier;
            const submitId = submitCashier?.id || 0;
            const submitIsActive = submitCashier?.isActive === true;

            if (!submitCashier || submitId <= 0 || !submitIsActive) {
                console.error(`[CashierSetup] POST response missing valid cashier record. id=${submitId}, isActive=${submitIsActive}`);
                console.error(`[CashierSetup] Full response: ${JSON.stringify(responseData)}`);
                throw new Error(
                    `Platinum POST failed: submit-cashier-setup returned id=${submitId}, isActive=${submitIsActive}. ` +
                    `Expected a cashier record with id > 0 and isActive=true. ` +
                    `Full response: ${JSON.stringify(responseData)}`
                );
            }

            const verifiedCashierId = submitId;
            const verifiedFloat = submitCashier.cashFloat ?? float;
            const verifiedOfficeId = submitCashier.officeId || selectedOffice.cashOffice_ID;
            const verifiedOfficeName = selectedOffice.cashOfficeDesc || '';

            console.log(`[CashierSetup] POST SUCCESS — Cashier record created. id: ${verifiedCashierId}, isActive: true, Office: ${verifiedOfficeName} (ID: ${verifiedOfficeId}), Float: ${verifiedFloat}`);

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

    const handleResumeSession = () => {
        if (!cashierDetails || !userId) return;
        const officeId = String(cashierDetails.officeId || cashierDetails.const_CashOffice?.cashOffice_ID || '');
        const officeName = cashierDetails.const_CashOffice?.cashOfficeDesc || '';
        const cashFloat = cashierDetails.cashFloat ?? 0;
        const fullName = `${firstName} ${lastName}`.trim();
        switchUser(String(userId), fullName || currentUser.name, officeName);
        startSession(officeId, cashFloat, officeName);
        setStep3Status('success');
        setSetupComplete(true);
        console.log(`[CashierSetup] Cashier confirmed session resume — office: ${officeName} (ID: ${officeId}), float: ${cashFloat}`);
    };

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
                                    {resumingSession
                                        ? ' An active session was found. You can resume it or start a new one below.'
                                        : ' Select your cash office and float amount below.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {resumingSession && cashierDetails && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="resume-session-section">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-blue-800">Active Session Found</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Office: <strong>{cashierDetails.const_CashOffice?.cashOfficeDesc || 'Unknown'}</strong>
                                        {' | '}Float: <strong>R {(cashierDetails.cashFloat ?? 0).toFixed(2)}</strong>
                                    </p>
                                    <div className="mt-3 flex gap-2">
                                        <Button
                                            type="button"
                                            onClick={handleResumeSession}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                            data-testid="button-resume-session"
                                        >
                                            Resume Session
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setResumingSession(false)}
                                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                            data-testid="button-new-session"
                                        >
                                            Start New Session
                                        </Button>
                                    </div>
                                </div>
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

                        {isCashierRegistered && selectedOfficeId && (
                            <div className="mt-6 space-y-4" data-testid="cashier-config-panel">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Cashier Configuration</h3>
                                    <div className="flex items-center gap-2">
                                        {configLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                        {configError && !configLoading && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                                                onClick={() => {
                                                    setConfigError('');
                                                    setPaymentOptions([]);
                                                    setPaymentTypes([]);
                                                    setReceiptRangeStatus(null);
                                                    const officeId = Number(selectedOfficeId);
                                                    setConfigLoading(true);
                                                    Promise.all([
                                                        fetchCashierPaymentOptions(cashierId!, userId, officeId),
                                                        fetchCashierPaymentTypes(cashierId!, userId, officeId),
                                                        validateReceiptRange(userId, cashierId!, finYear || undefined, officeId)
                                                    ]).then(([optR, typR, rangeR]) => {
                                                        setPaymentOptions(optR.data || []);
                                                        setPaymentOptionsSource(optR.source || '');
                                                        setPaymentTypes(typR.data || []);
                                                        setPaymentTypesSource(typR.source || '');
                                                        setReceiptRangeStatus(rangeR);
                                                    }).catch(() => {
                                                        setConfigError('Retry failed. Please check your connection.');
                                                    }).finally(() => setConfigLoading(false));
                                                }}
                                                data-testid="button-retry-config"
                                            >
                                                <RefreshCw className="h-3 w-3 mr-1" /> Retry
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {configError && !configLoading && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700" data-testid="config-error">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        {configError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-4" data-testid="card-payment-options">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-blue-800">Payment Functions</p>
                                                    <p className="text-[10px] text-blue-600">What you can process</p>
                                                </div>
                                            </div>
                                            {paymentOptionsSource && !configLoading && (
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-blue-400 border-blue-200" data-testid="options-source">{paymentOptionsSource === 'platinum' ? 'API' : paymentOptionsSource}</Badge>
                                            )}
                                        </div>
                                        {configLoading ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                                                <span className="text-xs text-blue-500">Loading...</span>
                                            </div>
                                        ) : paymentOptions.length === 0 ? (
                                            <p className="text-xs text-blue-500 italic py-1">No options loaded</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {paymentOptions.map(opt => (
                                                    <div key={opt.posPaymentOption_ID} className="flex items-center justify-between" data-testid={`payment-option-${opt.posPaymentOption_ID}`}>
                                                        <span className="text-xs text-slate-700 truncate mr-2">{opt.posPaymentOptionDesc}</span>
                                                        {opt.isTicked && opt.enabled ? (
                                                            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100" data-testid={`option-status-${opt.posPaymentOption_ID}`}>Enabled</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400 border-slate-200" data-testid={`option-status-${opt.posPaymentOption_ID}`}>Disabled</Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200 rounded-xl p-4" data-testid="card-payment-types">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                                    <CreditCard className="h-4 w-4 text-violet-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-violet-800">Tender Methods</p>
                                                    <p className="text-[10px] text-violet-600">How you can accept payment</p>
                                                </div>
                                            </div>
                                            {paymentTypesSource && !configLoading && (
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-violet-400 border-violet-200" data-testid="types-source">{paymentTypesSource === 'platinum' ? 'API' : paymentTypesSource}</Badge>
                                            )}
                                        </div>
                                        {configLoading ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                                                <span className="text-xs text-violet-500">Loading...</span>
                                            </div>
                                        ) : paymentTypes.length === 0 ? (
                                            <p className="text-xs text-violet-500 italic py-1">No types loaded</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {paymentTypes.map(t => (
                                                    <div key={t.posPaymentType_ID} className="flex items-center justify-between" data-testid={`payment-type-${t.posPaymentType_ID}`}>
                                                        <div className="flex items-center gap-1.5">
                                                            {t.posPaymentType_ID === 1 ? (
                                                                <Banknote className="h-3 w-3 text-green-600" />
                                                            ) : t.posPaymentType_ID === 3 ? (
                                                                <CreditCard className="h-3 w-3 text-violet-600" />
                                                            ) : (
                                                                <Circle className="h-3 w-3 text-slate-400" />
                                                            )}
                                                            <span className="text-xs text-slate-700">{t.posPaymentTypeDesc}</span>
                                                        </div>
                                                        {t.isTicked && t.enabled ? (
                                                            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100" data-testid={`type-status-${t.posPaymentType_ID}`}>Enabled</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400 border-slate-200" data-testid={`type-status-${t.posPaymentType_ID}`}>Disabled</Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className={`bg-gradient-to-br ${receiptRangeStatus?.valid ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' : receiptRangeStatus === null ? 'from-slate-50 to-slate-100/50 border-slate-200' : 'from-red-50 to-red-100/50 border-red-200'} border rounded-xl p-4`} data-testid="card-receipt-range">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${receiptRangeStatus?.valid ? 'bg-emerald-500/10' : receiptRangeStatus === null ? 'bg-slate-500/10' : 'bg-red-500/10'}`}>
                                                {receiptRangeStatus?.valid ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                ) : receiptRangeStatus === null ? (
                                                    <RefreshCw className="h-4 w-4 text-slate-400" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-600" />
                                                )}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-semibold ${receiptRangeStatus?.valid ? 'text-emerald-800' : receiptRangeStatus === null ? 'text-slate-600' : 'text-red-800'}`}>Receipt Status</p>
                                                <p className={`text-[10px] ${receiptRangeStatus?.valid ? 'text-emerald-600' : receiptRangeStatus === null ? 'text-slate-500' : 'text-red-600'}`}>Receipt range allocation</p>
                                            </div>
                                        </div>
                                        {configLoading ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                                <span className="text-xs text-slate-500">Validating...</span>
                                            </div>
                                        ) : receiptRangeStatus === null ? (
                                            <p className="text-xs text-slate-500 italic py-1">Waiting for validation...</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    {receiptRangeStatus.valid ? (
                                                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" data-testid="receipt-range-valid">Ready</Badge>
                                                    ) : (
                                                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100" data-testid="receipt-range-invalid">Not Ready</Badge>
                                                    )}
                                                </div>
                                                {receiptRangeStatus.officeName && (
                                                    <p className="text-[10px] text-slate-600">Office: {receiptRangeStatus.officeName}</p>
                                                )}
                                                {!receiptRangeStatus.valid && receiptRangeStatus.reason && (
                                                    <p className="text-[10px] text-red-600 mt-1">{receiptRangeStatus.reason}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded mt-4" data-testid="text-error">
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
