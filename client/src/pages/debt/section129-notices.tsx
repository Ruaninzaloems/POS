import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  FileWarning,
  Loader2,
  Download,
  Trash2,
  Send,
  XCircle,
  RotateCcw,
  Settings2,
  Filter,
  Mail,
  Phone,
  User,
  ChevronLeft,
  ChevronRight,
  Info,
  Eye,
} from 'lucide-react';
import {
  fetchSection129Config,
  fetchSection129Runs,
  submitSection129TrialRun,
  submitSection129FinalRun,
  fetchBillingCycles,
  fetchTowns,
  type Section129Config,
  type Section129Run,
} from '@/lib/external-api';

type RunType = 'trial-review' | 'trial-run' | 'final';
type HandoverOption = 'account' | 'bulk' | 'rotation';
type DistributionType = 'email' | 'sms' | 'print' | 'all';

export default function Section129Notices() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [finYear, setFinYear] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year - 1}/${year}`;
  });
  const [finMonth, setFinMonth] = useState(() => String(new Date().getMonth() + 1));
  const [runType, setRunType] = useState<RunType>('trial-review');
  const [handoverOption, setHandoverOption] = useState<HandoverOption>('account');

  const [config, setConfig] = useState<Section129Config | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [runs, setRuns] = useState<Section129Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [billingCycles, setBillingCycles] = useState<{ id: string; name: string }[]>([]);
  const [towns, setTowns] = useState<{ id: string; name: string }[]>([]);

  const [billingCycle, setBillingCycle] = useState('');
  const [town, setTown] = useState('');
  const [suburb, setSuburb] = useState('');
  const [propertyCategory, setPropertyCategory] = useState('');
  const [accountType, setAccountType] = useState('');
  const [typeOfPerson, setTypeOfPerson] = useState('');
  const [serviceGroupCode, setServiceGroupCode] = useState('');
  const [ageing, setAgeing] = useState('');
  const [amountGreaterThan, setAmountGreaterThan] = useState('');
  const [includeIndigents, setIncludeIndigents] = useState(false);
  const [includePensioners, setIncludePensioners] = useState(false);
  const [excludeDepositBalances, setExcludeDepositBalances] = useState(false);

  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [distributionType, setDistributionType] = useState<DistributionType>('email');
  const [mustEmailBePrinted, setMustEmailBePrinted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchSection129Config(),
      fetchSection129Runs(),
      fetchBillingCycles(),
      fetchTowns(),
    ]);

    if (results[0].status === 'fulfilled') {
      setConfig(results[0].value);
    } else {
      console.error('[Section129] Failed to load config:', results[0].reason);
    }
    setConfigLoading(false);

    if (results[1].status === 'fulfilled') {
      setRuns(results[1].value);
    } else {
      console.error('[Section129] Failed to load runs:', results[1].reason);
    }
    setRunsLoading(false);

    if (results[2].status === 'fulfilled') {
      setBillingCycles(results[2].value);
    }
    if (results[3].status === 'fulfilled') {
      setTowns(results[3].value);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!billingCycle) {
      toast({ title: 'Validation Error', description: 'Please select a billing cycle.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const params = {
        finYear,
        finMonth,
        runType,
        billingCycle,
        town: town && town !== '__all__' ? town : undefined,
        suburb: suburb && suburb !== '__all__' ? suburb : undefined,
        propertyCategory: propertyCategory && propertyCategory !== '__all__' ? propertyCategory : undefined,
        accountType: accountType && accountType !== '__all__' ? accountType : undefined,
        typeOfPerson: typeOfPerson && typeOfPerson !== '__all__' ? typeOfPerson : undefined,
        serviceGroupCode: serviceGroupCode && serviceGroupCode !== '__all__' ? serviceGroupCode : undefined,
        ageing: ageing && ageing !== '__all__' ? ageing : undefined,
        amountGreaterThan: amountGreaterThan ? parseFloat(amountGreaterThan) : undefined,
        includeIndigents,
        includePensioners,
        excludeDepositBalances,
        contactPerson: contactPerson || undefined,
        phone: contactPhone || undefined,
        email: contactEmail || undefined,
        distributionType,
        mustEmailBePrinted: distributionType === 'email' ? mustEmailBePrinted : undefined,
        handoverOption,
      };
      let result;
      if (runType === 'final') {
        result = await submitSection129FinalRun(params);
      } else {
        result = await submitSection129TrialRun(params);
      }
      toast({ title: 'Run Submitted', description: `Section 129 ${runType} run #${result.runId} has been submitted successfully.` });
      setRuns(prev => [result, ...prev]);
    } catch (err: any) {
      toast({ title: 'Submission Failed', description: err.message || 'Failed to submit Section 129 run.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setBillingCycle('');
    setTown('');
    setSuburb('');
    setPropertyCategory('');
    setAccountType('');
    setTypeOfPerson('');
    setServiceGroupCode('');
    setAgeing('');
    setAmountGreaterThan('');
    setIncludeIndigents(false);
    setIncludePensioners(false);
    setExcludeDepositBalances(false);
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    setDistributionType('email');
    setMustEmailBePrinted(false);
  };

  const handleRowClick = (run: Section129Run) => {
    if (run.status === 'Trial Run Review' || run.status === 'Trial Review') {
      setLocation(`/debt/section129/review/${run.runId}`);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('final')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (s.includes('authorized') || s.includes('approved')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (s.includes('trial run')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (s.includes('trial review') || s.includes('review')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  const finYears = (() => {
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const end = currentFY - i;
      return `${end - 1}/${end}`;
    });
  })();

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  const ageingOptions = [
    { value: '30', label: '30+ Days' },
    { value: '60', label: '60+ Days' },
    { value: '90', label: '90+ Days' },
    { value: '120', label: '120+ Days' },
    { value: '150', label: '150+ Days' },
    { value: '180', label: '180+ Days' },
  ];

  const paginatedRuns = runs.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(runs.length / gridPageSize);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <FileWarning className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight" data-testid="text-page-title">
                Section 129 — Letter of Demand
              </h1>
              <p className="text-xs text-slate-400">Generate and manage Section 129 notices for debt recovery</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 flex items-center gap-1">
                Financial Year
                <HelpTip text="Select the financial year for the Section 129 run" side="right" />
              </Label>
              <Select value={finYear} onValueChange={setFinYear} data-testid="select-fin-year">
                <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white h-9" data-testid="select-fin-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {finYears.map(fy => (
                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 flex items-center gap-1">
                Month
                <HelpTip text="Select the billing month" side="right" />
              </Label>
              <Select value={finMonth} onValueChange={setFinMonth} data-testid="select-fin-month">
                <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white h-9" data-testid="select-fin-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 flex items-center gap-1">
                Run Type
                <HelpTip text="Trial Review: Review accounts before run. Trial Run: Execute trial. Final: Issue notices." side="right" />
              </Label>
              <Select value={runType} onValueChange={(v) => setRunType(v as RunType)} data-testid="select-run-type">
                <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white h-9" data-testid="select-run-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial-review">Trial Review</SelectItem>
                  <SelectItem value="trial-run">Trial Run</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 flex items-center gap-1">
                Handover Option
                <HelpTip text="Account: Single account. Bulk: All qualifying. Rotation: Auto-distribute to attorneys." side="right" />
              </Label>
              <Select value={handoverOption} onValueChange={(v) => setHandoverOption(v as HandoverOption)} data-testid="select-handover-option">
                <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white h-9" data-testid="select-handover-option">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                  <SelectItem value="rotation">Rotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Section 129 Configuration</h2>
                <HelpTip text="Current configuration values from the billing system for Section 129 notices" side="right" />
              </div>
              {configLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading configuration...
                </div>
              ) : config ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <ConfigValue label="Demand Letter Template" value={config.demandLetterTemplate || '—'} testId="text-config-demand-letter" />
                  <ConfigValue label="SMS Template" value={config.smsTemplate || '—'} testId="text-config-sms-template" />
                  <ConfigValue label="Admin Fees" value={`R ${config.adminFees.toFixed(2)}`} testId="text-config-admin-fees" />
                  <ConfigValue label="Lapse Days" value={String(config.lapseDays)} testId="text-config-lapse-days" />
                  <ConfigValue label="Interest Rate" value={`${config.interestRate}%`} testId="text-config-interest-rate" />
                  <ConfigValue label="Minimum Amount" value={`R ${config.minimumAmount.toFixed(2)}`} testId="text-config-min-amount" />
                </div>
              ) : (
                <p className="text-slate-500 text-sm" data-testid="text-config-error">
                  Configuration could not be loaded from the API.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Filter Parameters</h2>
                <HelpTip text="Define criteria for which accounts to include in the Section 129 run" side="right" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Billing Cycle</Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-billing-cycle">
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingCycles.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Town</Label>
                  <Select value={town} onValueChange={setTown}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-town">
                      <SelectValue placeholder="All towns" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Towns</SelectItem>
                      {towns.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Suburb</Label>
                  <Input
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="Enter suburb"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-suburb"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Property Category</Label>
                  <Select value={propertyCategory} onValueChange={setPropertyCategory}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-property-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Categories</SelectItem>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                      <SelectItem value="agricultural">Agricultural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Account Type</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-account-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Types</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="indigent">Indigent</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Type of Person</Label>
                  <Select value={typeOfPerson} onValueChange={setTypeOfPerson}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-type-of-person">
                      <SelectValue placeholder="All persons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      <SelectItem value="natural">Natural Person</SelectItem>
                      <SelectItem value="legal">Legal Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Service Group Code</Label>
                  <Input
                    value={serviceGroupCode}
                    onChange={(e) => setServiceGroupCode(e.target.value)}
                    placeholder="Enter code"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-service-group-code"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Ageing</Label>
                  <Select value={ageing} onValueChange={setAgeing}>
                    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 text-white h-9" data-testid="select-ageing">
                      <SelectValue placeholder="Select ageing" />
                    </SelectTrigger>
                    <SelectContent>
                      {ageingOptions.map(a => (
                        <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Amount Greater Than</Label>
                  <Input
                    type="number"
                    value={amountGreaterThan}
                    onChange={(e) => setAmountGreaterThan(e.target.value)}
                    placeholder="0.00"
                    className="bg-slate-900/60 border-slate-600/50 text-white h-9"
                    data-testid="input-amount-greater-than"
                  />
                </div>

                <div className="space-y-3 col-span-1 sm:col-span-2 lg:col-span-3">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={includeIndigents}
                        onCheckedChange={setIncludeIndigents}
                        data-testid="switch-include-indigents"
                      />
                      <Label className="text-xs text-slate-300 cursor-pointer">
                        Include Indigents
                        <HelpTip text="Include accounts flagged as indigent in the run" side="top" />
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={includePensioners}
                        onCheckedChange={setIncludePensioners}
                        data-testid="switch-include-pensioners"
                      />
                      <Label className="text-xs text-slate-300 cursor-pointer">
                        Include Pensioners
                        <HelpTip text="Include accounts flagged as pensioners in the run" side="top" />
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={excludeDepositBalances}
                        onCheckedChange={setExcludeDepositBalances}
                        data-testid="switch-exclude-deposits"
                      />
                      <Label className="text-xs text-slate-300 cursor-pointer">
                        Exclude Deposit Balances
                        <HelpTip text="Exclude deposit balance amounts from the qualifying total" side="top" />
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Contact Details</h2>
                  <HelpTip text="Contact details to appear on the Section 129 notice" side="right" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Contact Person</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Full name"
                        className="bg-slate-900/60 border-slate-600/50 text-white h-9 pl-8"
                        data-testid="input-contact-person"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Phone number"
                        className="bg-slate-900/60 border-slate-600/50 text-white h-9 pl-8"
                        data-testid="input-contact-phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Email address"
                        className="bg-slate-900/60 border-slate-600/50 text-white h-9 pl-8"
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Distribution Options</h2>
                  <HelpTip text="Choose how Section 129 notices are distributed to account holders" side="right" />
                </div>
                <RadioGroup
                  value={distributionType}
                  onValueChange={(v) => setDistributionType(v as DistributionType)}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="email" id="dist-email" data-testid="radio-dist-email" />
                    <Label htmlFor="dist-email" className="text-sm text-slate-300 cursor-pointer">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sms" id="dist-sms" data-testid="radio-dist-sms" />
                    <Label htmlFor="dist-sms" className="text-sm text-slate-300 cursor-pointer">SMS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="print" id="dist-print" data-testid="radio-dist-print" />
                    <Label htmlFor="dist-print" className="text-sm text-slate-300 cursor-pointer">Print</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="dist-all" data-testid="radio-dist-all" />
                    <Label htmlFor="dist-all" className="text-sm text-slate-300 cursor-pointer">All</Label>
                  </div>
                </RadioGroup>

                {distributionType === 'email' && (
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-700/40">
                    <Switch
                      checked={mustEmailBePrinted}
                      onCheckedChange={setMustEmailBePrinted}
                      data-testid="switch-email-printed"
                    />
                    <Label className="text-xs text-slate-300 cursor-pointer">
                      Must email accounts be printed?
                      <HelpTip text="When enabled, accounts that receive email notices will also have printed copies generated" side="top" />
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-800/40 border-slate-700/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Generated Notice Files</h2>
                  <HelpTip text="List of Section 129 runs and their statuses. Click a Trial Review run to review accounts." side="right" />
                  {runs.length > 0 && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400" data-testid="badge-run-count">
                      {runs.length} run{runs.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  className="text-slate-400 hover:text-white h-7 px-2"
                  data-testid="button-refresh-runs"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Refresh
                </Button>
              </div>

              {runsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading runs...
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm" data-testid="text-no-runs">
                  No Section 129 runs found. Submit a run using the form above.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700/40 hover:bg-transparent">
                          <TableHead className="text-xs text-slate-400 font-medium">Run ID</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium">Status</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium">Distribution</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium hidden sm:table-cell">Actioned By</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium">Date Created</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium hidden md:table-cell">Authorized By</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium hidden lg:table-cell">Billing Cycle</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium hidden xl:table-cell">Parameters</TableHead>
                          <TableHead className="text-xs text-slate-400 font-medium text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRuns.map((run) => (
                          <TableRow
                            key={run.runId}
                            className="border-slate-700/30 hover:bg-slate-700/20 cursor-pointer transition-colors"
                            onClick={() => handleRowClick(run)}
                            data-testid={`row-run-${run.runId}`}
                          >
                            <TableCell className="text-sm text-white font-mono" data-testid={`text-run-id-${run.runId}`}>
                              #{run.runId}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(run.status)}`}
                                data-testid={`badge-status-${run.runId}`}
                              >
                                {run.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-slate-300">{run.distributionType}</TableCell>
                            <TableCell className="text-sm text-slate-300 hidden sm:table-cell">{run.actionedBy}</TableCell>
                            <TableCell className="text-sm text-slate-300">
                              {run.dateCreated ? new Date(run.dateCreated).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-300 hidden md:table-cell">{run.authorizedBy || '—'}</TableCell>
                            <TableCell className="text-sm text-slate-300 hidden lg:table-cell">{run.billingCycle}</TableCell>
                            <TableCell className="text-sm text-slate-400 hidden xl:table-cell max-w-[180px] truncate">{run.runParameters}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                {(run.status === 'Trial Run Review' || run.status === 'Trial Review') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                    onClick={() => setLocation(`/debt/section129/review/${run.runId}`)}
                                    data-testid={`button-review-${run.runId}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-600/30"
                                  data-testid={`button-download-${run.runId}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  data-testid={`button-remove-${run.runId}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalGridPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                      <span className="text-xs text-slate-500">
                        Page {gridPage} of {totalGridPages} ({runs.length} total)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={gridPage <= 1}
                          onClick={() => setGridPage(p => p - 1)}
                          className="h-7 px-2 text-slate-400"
                          data-testid="button-grid-prev"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={gridPage >= totalGridPages}
                          onClick={() => setGridPage(p => p + 1)}
                          className="h-7 px-2 text-slate-400"
                          data-testid="button-grid-next"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pb-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !billingCycle}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium h-10 px-6"
              data-testid="button-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              className="border-slate-600 text-slate-300 hover:bg-slate-700/40 h-10 px-6"
              data-testid="button-clear"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="text-slate-400 hover:text-white h-10 px-6"
              data-testid="button-cancel"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </PosLayout>
  );
}

function ConfigValue({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium truncate" data-testid={testId}>{value}</p>
    </div>
  );
}
