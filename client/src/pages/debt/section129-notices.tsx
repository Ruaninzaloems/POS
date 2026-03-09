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
  Play,
} from 'lucide-react';
import {
  fetchSection129Config,
  fetchSection129Runs,
  submitSection129TrialRun,
  submitSection129FinalRun,
  fetchBillingCycles,
  fetchTowns,
  fetchPropertyCategories,
  fetchAccountTypes,
  fetchPersonTypes,
  fetchAgeingRanges,
  fetchSection129RunFiles,
  downloadSection129File,
  type Section129Config,
  type Section129Run,
  type Section129RunFile,
} from '@/lib/external-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RunType, HandoverOption, DistributionType } from '@/models/debt.models';
import { formatFileSize, getFinancialYearList } from '@/services/format.service';
import { getStatusColor } from '@/services/validation.service';

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
  const [propertyCategories, setPropertyCategories] = useState<{ id: string; name: string }[]>([]);
  const [accountTypes, setAccountTypes] = useState<{ id: string; name: string }[]>([]);
  const [personTypes, setPersonTypes] = useState<{ id: string; name: string }[]>([]);
  const [ageingRanges, setAgeingRanges] = useState<{ id: string; name: string }[]>([]);

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

  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [fileModalRunId, setFileModalRunId] = useState<number | null>(null);
  const [runFiles, setRunFiles] = useState<Section129RunFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const [finalRunningId, setFinalRunningId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchSection129Config(),
      fetchSection129Runs(),
      fetchBillingCycles(),
      fetchTowns(),
      fetchPropertyCategories(),
      fetchAccountTypes(),
      fetchPersonTypes(),
      fetchAgeingRanges(),
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
    if (results[4].status === 'fulfilled') {
      setPropertyCategories(results[4].value);
    }
    if (results[5].status === 'fulfilled') {
      setAccountTypes(results[5].value);
    }
    if (results[6].status === 'fulfilled') {
      setPersonTypes(results[6].value);
    }
    if (results[7].status === 'fulfilled') {
      setAgeingRanges(results[7].value);
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
      const result = await submitSection129TrialRun(params);
      toast({ title: 'Run Submitted', description: `Section 129 ${runType} run has been submitted successfully.` });
      await loadData();
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

  const handleOpenFileModal = async (runId: number) => {
    setFileModalRunId(runId);
    setFileModalOpen(true);
    setFilesLoading(true);
    setRunFiles([]);
    try {
      const files = await fetchSection129RunFiles(runId);
      setRunFiles(files);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load run files.', variant: 'destructive' });
    } finally {
      setFilesLoading(false);
    }
  };

  const handleDownloadFile = async (fileId: number) => {
    setDownloadingFileId(fileId);
    try {
      await downloadSection129File(fileId);
      toast({ title: 'Download Started', description: 'File download has started.' });
    } catch (err: any) {
      toast({ title: 'Download Failed', description: err.message || 'Failed to download file.', variant: 'destructive' });
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleFinalRun = async (runId: number) => {
    setFinalRunningId(runId);
    try {
      await submitSection129FinalRun({ runId });
      toast({ title: 'Final Run Submitted', description: `Section 129 final run for run #${runId} has been submitted successfully.` });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Final Run Failed', description: err.message || 'Failed to submit final run.', variant: 'destructive' });
    } finally {
      setFinalRunningId(null);
    }
  };


  const handleRowClick = (run: Section129Run) => {
    if (run.status === 'Trial Run Review' || run.status === 'Trial Review') {
      setLocation(`/debt/section129/review/${run.runId}`);
    }
  };


  const finYears = getFinancialYearList(5);

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];


  const paginatedRuns = runs.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(runs.length / gridPageSize);

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <FileWarning className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Section 129 — Letter of Demand
              </h1>
              <p className="text-xs text-muted-foreground">Generate and manage Section 129 notices for debt recovery</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Financial Year
                <HelpTip text="Select the financial year for the Section 129 run" side="right" />
              </Label>
              <Select value={finYear} onValueChange={setFinYear} data-testid="select-fin-year">
                <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-year">
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
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Month
                <HelpTip text="Select the billing month" side="right" />
              </Label>
              <Select value={finMonth} onValueChange={setFinMonth} data-testid="select-fin-month">
                <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-fin-month">
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
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Run Type
                <HelpTip text="Trial Review: Review accounts before run. Trial Run: Execute trial. Final: Issue notices." side="right" />
              </Label>
              <Select value={runType} onValueChange={(v) => setRunType(v as RunType)} data-testid="select-run-type">
                <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-run-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial-review">Trial Review</SelectItem>
                  <SelectItem value="trial-run">Trial Run</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Handover Option
                <HelpTip text="Account: Single account. Bulk: All qualifying. Rotation: Auto-distribute to attorneys." side="right" />
              </Label>
              <Select value={handoverOption} onValueChange={(v) => setHandoverOption(v as HandoverOption)} data-testid="select-handover-option">
                <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-handover-option">
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

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4 text-[var(--pos-accent)]" />
                <h2 className="text-sm font-semibold text-foreground">Section 129 Configuration</h2>
                <HelpTip text="Current configuration values from the billing system for Section 129 notices" side="right" />
              </div>
              {configLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
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
                <p className="text-muted-foreground text-sm" data-testid="text-config-error">
                  Configuration could not be loaded from the API.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-[var(--pos-accent)]" />
                <h2 className="text-sm font-semibold text-foreground">Filter Parameters</h2>
                <HelpTip text="Define criteria for which accounts to include in the Section 129 run" side="right" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Billing Cycle</Label>
                  <Select value={billingCycle} onValueChange={setBillingCycle}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-billing-cycle">
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
                  <Label className="text-xs text-muted-foreground">Town</Label>
                  <Select value={town} onValueChange={setTown}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-town">
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
                  <Label className="text-xs text-muted-foreground">Suburb</Label>
                  <Input
                    value={suburb}
                    onChange={(e) => setSuburb(e.target.value)}
                    placeholder="Enter suburb"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-suburb"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Property Category</Label>
                  <Select value={propertyCategory} onValueChange={setPropertyCategory}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-property-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Categories</SelectItem>
                      {propertyCategories.map(pc => (
                        <SelectItem key={pc.id} value={pc.id}>{pc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Type</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-account-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Types</SelectItem>
                      {accountTypes.map(at => (
                        <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Type of Person</Label>
                  <Select value={typeOfPerson} onValueChange={setTypeOfPerson}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-type-of-person">
                      <SelectValue placeholder="All persons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {personTypes.map(pt => (
                        <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Service Group Code</Label>
                  <Input
                    value={serviceGroupCode}
                    onChange={(e) => setServiceGroupCode(e.target.value)}
                    placeholder="Enter code"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-service-group-code"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ageing</Label>
                  <Select value={ageing} onValueChange={setAgeing}>
                    <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6] h-9" data-testid="select-ageing">
                      <SelectValue placeholder="Select ageing" />
                    </SelectTrigger>
                    <SelectContent>
                      {ageingRanges.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Amount Greater Than</Label>
                  <Input
                    type="number"
                    value={amountGreaterThan}
                    onChange={(e) => setAmountGreaterThan(e.target.value)}
                    placeholder="0.00"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
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
                      <Label className="text-xs text-foreground cursor-pointer">
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
                      <Label className="text-xs text-foreground cursor-pointer">
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
                      <Label className="text-xs text-foreground cursor-pointer">
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
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-[var(--pos-accent)]" />
                  <h2 className="text-sm font-semibold text-foreground">Contact Details</h2>
                  <HelpTip text="Contact details to appear on the Section 129 notice" side="right" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Contact Person</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Full name"
                        className="bg-[#F7F7F7] border-[#D6D6D6] h-9 pl-8"
                        data-testid="input-contact-person"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Phone number"
                        className="bg-[#F7F7F7] border-[#D6D6D6] h-9 pl-8"
                        data-testid="input-contact-phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="Email address"
                        className="bg-[#F7F7F7] border-[#D6D6D6] h-9 pl-8"
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-4 h-4 text-[var(--pos-accent)]" />
                  <h2 className="text-sm font-semibold text-foreground">Distribution Options</h2>
                  <HelpTip text="Choose how Section 129 notices are distributed to account holders" side="right" />
                </div>
                <RadioGroup
                  value={distributionType}
                  onValueChange={(v) => setDistributionType(v as DistributionType)}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="email" id="dist-email" data-testid="radio-dist-email" />
                    <Label htmlFor="dist-email" className="text-sm text-foreground cursor-pointer">Email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sms" id="dist-sms" data-testid="radio-dist-sms" />
                    <Label htmlFor="dist-sms" className="text-sm text-foreground cursor-pointer">SMS</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="whatsapp" id="dist-whatsapp" data-testid="radio-dist-whatsapp" />
                    <Label htmlFor="dist-whatsapp" className="text-sm text-foreground cursor-pointer">WhatsApp</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="print" id="dist-print" data-testid="radio-dist-print" />
                    <Label htmlFor="dist-print" className="text-sm text-foreground cursor-pointer">Print</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="dist-all" data-testid="radio-dist-all" />
                    <Label htmlFor="dist-all" className="text-sm text-foreground cursor-pointer">All</Label>
                  </div>
                </RadioGroup>

                {distributionType === 'email' && (
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-[#D6D6D6]">
                    <Switch
                      checked={mustEmailBePrinted}
                      onCheckedChange={setMustEmailBePrinted}
                      data-testid="switch-email-printed"
                    />
                    <Label className="text-xs text-foreground cursor-pointer">
                      Must email accounts be printed?
                      <HelpTip text="When enabled, accounts that receive email notices will also have printed copies generated" side="top" />
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[var(--pos-accent)]" />
                  <h2 className="text-sm font-semibold text-foreground">Generated Notice Files</h2>
                  <HelpTip text="List of Section 129 runs and their statuses. Click a Trial Review run to review accounts." side="right" />
                  {runs.length > 0 && (
                    <Badge variant="outline" className="text-xs border-[#D6D6D6] text-muted-foreground" data-testid="badge-run-count">
                      {runs.length} run{runs.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  className="text-muted-foreground hover:text-foreground h-7 px-2"
                  data-testid="button-refresh-runs"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Refresh
                </Button>
              </div>

              {runsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading runs...
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-runs">
                  No Section 129 runs found. Submit a run using the form above.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#D6D6D6] hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground font-medium">Run ID</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Status</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Distribution</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium hidden sm:table-cell">Actioned By</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Date Created</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">Authorized By</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">Billing Cycle</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium hidden xl:table-cell">Parameters</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRuns.map((run) => (
                          <TableRow
                            key={run.runId}
                            className="border-[#E5E5E5] hover:bg-[var(--pos-accent-hover-row)] cursor-pointer transition-colors"
                            onClick={() => handleRowClick(run)}
                            data-testid={`row-run-${run.runId}`}
                          >
                            <TableCell className="text-sm text-foreground font-mono" data-testid={`text-run-id-${run.runId}`}>
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
                            <TableCell className="text-sm text-foreground">{run.distributionType}</TableCell>
                            <TableCell className="text-sm text-foreground hidden sm:table-cell">{run.actionedBy}</TableCell>
                            <TableCell className="text-sm text-foreground">
                              {run.dateCreated ? new Date(run.dateCreated).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-foreground hidden md:table-cell">{run.authorizedBy || '—'}</TableCell>
                            <TableCell className="text-sm text-foreground hidden lg:table-cell">{run.billingCycle}</TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden xl:table-cell max-w-[180px] truncate">{run.runParameters}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                {(run.status === 'Trial Run Review' || run.status === 'Trial Review') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[var(--pos-accent)] hover:text-cyan-300 hover:bg-cyan-500/10"
                                    onClick={() => setLocation(`/debt/section129/review/${run.runId}`)}
                                    data-testid={`button-review-${run.runId}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {(run.status?.toLowerCase().includes('authorized') || run.status?.toLowerCase().includes('approved')) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleFinalRun(run.runId)}
                                    disabled={finalRunningId === run.runId}
                                    data-testid={`button-final-run-${run.runId}`}
                                    title="Execute Final Run"
                                  >
                                    {finalRunningId === run.runId ? (
                                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-[var(--pos-accent-tint)]"
                                  onClick={() => handleOpenFileModal(run.runId)}
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
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E5E5E5]">
                      <span className="text-xs text-muted-foreground">
                        Page {gridPage} of {totalGridPages} ({runs.length} total)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={gridPage <= 1}
                          onClick={() => setGridPage(p => p - 1)}
                          className="h-7 px-2 text-muted-foreground"
                          data-testid="button-grid-prev"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={gridPage >= totalGridPages}
                          onClick={() => setGridPage(p => p + 1)}
                          className="h-7 px-2 text-muted-foreground"
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
              className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm h-10 px-6"
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
              className="border-[#D6D6D6] text-foreground hover:bg-[var(--pos-accent-tint)] h-10 px-6"
              data-testid="button-clear"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="text-muted-foreground hover:text-foreground h-10 px-6"
              data-testid="button-cancel"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={fileModalOpen} onOpenChange={setFileModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Download className="w-4 h-4 text-[var(--pos-accent)]" />
              Run #{fileModalRunId} — Files
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading files...
              </div>
            ) : runFiles.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-files">
                No files found for this run.
              </div>
            ) : (
              runFiles.map((file) => (
                <div
                  key={file.fileId}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#F7F7F7] border border-[#D6D6D6]"
                  data-testid={`file-item-${file.fileId}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-foreground font-medium truncate" data-testid={`text-filename-${file.fileId}`}>
                      {file.fileName}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-[10px] border-[#D6D6D6] text-muted-foreground" data-testid={`badge-filetype-${file.fileId}`}>
                        {file.fileType}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground" data-testid={`text-filesize-${file.fileId}`}>
                        {formatFileSize(file.fileSize)}
                      </span>
                      <span className="text-[10px] text-muted-foreground" data-testid={`text-filedate-${file.fileId}`}>
                        {file.dateCreated ? new Date(file.dateCreated).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-[var(--pos-accent)] hover:text-cyan-300 hover:bg-cyan-500/10 shrink-0"
                    onClick={() => handleDownloadFile(file.fileId)}
                    disabled={downloadingFileId === file.fileId}
                    data-testid={`button-download-file-${file.fileId}`}
                  >
                    {downloadingFileId === file.fileId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}

function ConfigValue({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="bg-[#F7F7F7] rounded-lg p-2.5 border border-[#E5E5E5]">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground font-medium truncate" data-testid={testId}>{value}</p>
    </div>
  );
}
