import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import {
  Settings2,
  Loader2,
  Plus,
  Trash2,
  Search,
  RotateCcw,
  Save,
  XCircle,
  ChevronLeft,
} from 'lucide-react';
import {
  fetchSection129ConfigList,
  saveSection129Config,
  fetchAttorneyList,
  fetchSection129Templates,
  fetchSection129SmsTemplates,
  fetchAdditionalBillingTypes,
  type Section129ConfigEntry,
  type Attorney,
} from '@/lib/external-api';

interface CostItem {
  nr: number;
  additionalBillingTypeId: string;
  additionalBillingTypeName: string;
  amount: number;
}

interface AttorneyRotationItem {
  nr: number;
  attorneyId: number;
  attorneyName: string;
  percentDebtorCount: number;
  percentHandoverAmount: number;
}

type ViewMode = 'landing' | 'detail';

export default function Section129Config() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [isNewEntry, setIsNewEntry] = useState(false);

  const currentFY = (() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year - 1}/${year}`;
  })();

  const [finYear, setFinYear] = useState(currentFY);
  const [configEntries, setConfigEntries] = useState<Section129ConfigEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [selectedFinYear, setSelectedFinYear] = useState(currentFY);
  const [section129Template, setSection129Template] = useState('Section 129 Standard');
  const [smsTemplate, setSmsTemplate] = useState('SMS Notification');
  const [lapseDays, setLapseDays] = useState(14);
  const [noticesPerFile, setNoticesPerFile] = useState(500);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [activateRotation, setActivateRotation] = useState(true);
  const [attorneyRotation, setAttorneyRotation] = useState<AttorneyRotationItem[]>([]);

  const [addBillTypeId, setAddBillTypeId] = useState('');
  const [addBillAmount, setAddBillAmount] = useState('');
  const [addAttorneyId, setAddAttorneyId] = useState('');
  const [addPercentDebtor, setAddPercentDebtor] = useState('');
  const [addPercentHandover, setAddPercentHandover] = useState('');

  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<{ id: string; name: string }[]>([]);
  const [additionalBillingTypes, setAdditionalBillingTypes] = useState<{ id: string; name: string }[]>([]);
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<Section129ConfigEntry | null>(null);

  const finYears = (() => {
    const now = new Date();
    const cy = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    const years: string[] = [];
    for (let y = cy - 5; y <= cy + 1; y++) {
      years.push(`${y - 1}/${y}`);
    }
    return years;
  })();

  const loadDropdowns = useCallback(async () => {
    try {
      const [tpl, smsTpl, billTypes, attyList] = await Promise.all([
        fetchSection129Templates().catch(() => []),
        fetchSection129SmsTemplates().catch(() => []),
        fetchAdditionalBillingTypes().catch(() => []),
        fetchAttorneyList().catch(() => []),
      ]);
      setTemplates(Array.isArray(tpl) ? tpl : []);
      setSmsTemplates(Array.isArray(smsTpl) ? smsTpl : []);
      setAdditionalBillingTypes(Array.isArray(billTypes) ? billTypes : []);
      setAttorneys(Array.isArray(attyList) ? attyList : []);
    } catch (e) {
      console.error('Failed to load dropdowns:', e);
    }
  }, []);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const data = await fetchSection129ConfigList(finYear);
      setConfigEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load config entries', variant: 'destructive' });
      setConfigEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFinYear(currentFY);
    setConfigEntries([]);
    setSearched(false);
  };

  const openAddNew = () => {
    setIsNewEntry(true);
    setSelectedEntry(null);
    setEnabled(true);
    setSelectedFinYear(currentFY);
    setSection129Template('Section 129 Standard');
    setSmsTemplate('SMS Notification');
    setLapseDays(14);
    setNoticesPerFile(500);
    setCostItems([]);
    setActivateRotation(true);
    setAttorneyRotation([]);
    setAddBillTypeId('');
    setAddBillAmount('');
    setAddAttorneyId('');
    setAddPercentDebtor('');
    setAddPercentHandover('');
    setViewMode('detail');
  };

  const openEntryDetail = (entry: Section129ConfigEntry) => {
    setIsNewEntry(false);
    setSelectedEntry(entry);
    setEnabled(entry.enabled);
    setSelectedFinYear(entry.finYear);
    setSection129Template(entry.section129Template || 'Section 129 Standard');
    setSmsTemplate(entry.smsTemplate || 'SMS Notification');
    setLapseDays(entry.lapseDays ?? 14);
    setNoticesPerFile(entry.noticesPerFile ?? 500);
    setCostItems(entry.costItems || []);
    setActivateRotation(entry.activateRotation ?? false);
    setAttorneyRotation(entry.attorneyRotation || []);
    setViewMode('detail');
  };

  const handleAddCostItem = () => {
    if (!addBillTypeId && !addBillAmount) return;
    if ((!addBillTypeId && addBillAmount) || (addBillTypeId && !addBillAmount)) {
      toast({ title: 'Validation Error', description: 'Both or none of the cost parameters must be supplied.', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(addBillAmount);
    if (isNaN(amt) || amt < 0) {
      toast({ title: 'Validation Error', description: 'Amount cannot be less than zero.', variant: 'destructive' });
      return;
    }
    if (costItems.some(c => c.additionalBillingTypeId === addBillTypeId)) {
      const typeName = additionalBillingTypes.find(t => t.id === addBillTypeId)?.name || addBillTypeId;
      toast({ title: 'Validation Error', description: `Duplicate for additional-billing-type "${typeName}" not allowed.`, variant: 'destructive' });
      return;
    }
    const typeName = additionalBillingTypes.find(t => t.id === addBillTypeId)?.name || addBillTypeId;
    setCostItems(prev => [...prev, { nr: prev.length + 1, additionalBillingTypeId: addBillTypeId, additionalBillingTypeName: typeName, amount: amt }]);
    setAddBillTypeId('');
    setAddBillAmount('');
  };

  const removeCostItem = (idx: number) => {
    setCostItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, nr: i + 1 })));
  };

  const handleAddAttorney = () => {
    if (!addAttorneyId) return;
    const pctDebtor = parseInt(addPercentDebtor || '0', 10);
    const pctHandover = parseInt(addPercentHandover || '0', 10);
    if (pctDebtor > 0 && pctHandover > 0) {
      toast({ title: 'Validation Error', description: 'Either/OR one of the percentage parameters must be supplied.', variant: 'destructive' });
      return;
    }
    if (pctDebtor === 0 && pctHandover === 0) {
      toast({ title: 'Validation Error', description: 'Please supply a value for at least one percentage allocation.', variant: 'destructive' });
      return;
    }
    if (pctDebtor < 0 || pctDebtor > 100 || pctHandover < 0 || pctHandover > 100) {
      toast({ title: 'Validation Error', description: 'Percentage must be between 0 and 100.', variant: 'destructive' });
      return;
    }
    const attyId = parseInt(addAttorneyId, 10);
    if (attorneyRotation.some(a => a.attorneyId === attyId)) {
      const name = attorneys.find(a => a.attorneyId === attyId)?.attorneyName || addAttorneyId;
      toast({ title: 'Validation Error', description: `Duplicate for attorney "${name}" not allowed.`, variant: 'destructive' });
      return;
    }
    const name = attorneys.find(a => a.attorneyId === attyId)?.attorneyName || `Attorney ${attyId}`;
    setAttorneyRotation(prev => [...prev, { nr: prev.length + 1, attorneyId: attyId, attorneyName: name, percentDebtorCount: pctDebtor, percentHandoverAmount: pctHandover }]);
    setAddAttorneyId('');
    setAddPercentDebtor('');
    setAddPercentHandover('');
  };

  const removeAttorney = (idx: number) => {
    setAttorneyRotation(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, nr: i + 1 })));
  };

  const validate = (): string | null => {
    if (!selectedFinYear) return 'Please supply a value for Financial Year.';
    if (!section129Template) return 'Please supply a value for Section 129 Template.';
    if (!smsTemplate) return 'Please supply a value for SMS Notification Template.';
    if (lapseDays < 14 || lapseDays > 99) return 'The Section 129 – Letter of Demand lapse days must be > 0 and < 100.';
    if (noticesPerFile < 1) return 'The No-of-notices-per-file cannot be less than 1.';
    if (enabled && isNewEntry) {
      const existingEnabled = configEntries.find(
        (entry) => entry.finYear === selectedFinYear && entry.enabled && entry.id !== selectedEntry?.id
      );
      if (existingEnabled) {
        return 'An enabled configuration already exists for this financial year. Please disable it first.';
      }
    }
    if (activateRotation && attorneyRotation.length > 0) {
      const totalDebtor = attorneyRotation.reduce((sum, a) => sum + a.percentDebtorCount, 0);
      const totalHandover = attorneyRotation.reduce((sum, a) => sum + a.percentHandoverAmount, 0);
      const usingDebtor = attorneyRotation.some(a => a.percentDebtorCount > 0);
      const usingHandover = attorneyRotation.some(a => a.percentHandoverAmount > 0);
      if (usingDebtor && usingHandover) return 'Either/OR one of the percentage parameters must be supplied — cannot mix Debtor Count and Handover Amount allocation.';
      if (usingDebtor && totalDebtor !== 100) return 'Percentage Allocation in Debtor Count must sum to 100%.';
      if (usingHandover && totalHandover !== 100) return 'Percentage Allocation in Handover Amount must sum to 100%.';
      if (!usingDebtor && !usingHandover) return 'Please supply percentage allocation for the attorney rotation.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Validation Error', description: err, variant: 'destructive' });
      return;
    }
    if (enabled && isNewEntry && selectedFinYear !== finYear) {
      try {
        const fyEntries = await fetchSection129ConfigList(selectedFinYear);
        const existingEnabled = Array.isArray(fyEntries) && fyEntries.find(
          (entry: Section129ConfigEntry) => entry.enabled && entry.id !== selectedEntry?.id
        );
        if (existingEnabled) {
          toast({ title: 'Validation Error', description: 'An enabled configuration already exists for this financial year. Please disable it first.', variant: 'destructive' });
          return;
        }
      } catch (e) {
      }
    }
    setSaving(true);
    try {
      await saveSection129Config({
        id: selectedEntry?.id,
        enabled,
        finYear: selectedFinYear,
        section129Template,
        smsTemplate,
        lapseDays,
        noticesPerFile,
        costItems,
        activateRotation,
        attorneyRotation,
      });
      toast({ title: 'Success', description: 'Section 129 configuration saved successfully.' });
      setViewMode('landing');
      handleSearch();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save configuration', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setViewMode('landing');
  };

  if (viewMode === 'detail') {
    return (
      <PosLayout>
        <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={handleCancel} data-testid="button-back-config">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Settings2 className="w-5 h-5 text-[var(--pos-accent)]" />
            <h2 className="text-lg font-semibold text-[#2E2E2E]">{isNewEntry ? 'Add New Configuration' : 'Configuration Detail'}</h2>
          </div>

          <Card>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="cfg-enabled"
                  checked={enabled}
                  onCheckedChange={(v) => setEnabled(!!v)}
                  disabled={!isNewEntry && selectedEntry !== null}
                  data-testid="checkbox-config-enabled"
                />
                <Label htmlFor="cfg-enabled" className="text-sm font-medium">Enabled</Label>
                <HelpTip text="Enable or disable this configuration entry" side="right" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-[#6B6B6B] mb-1 block">Financial Year *</Label>
                  <Select value={selectedFinYear} onValueChange={setSelectedFinYear} disabled={!isNewEntry}>
                    <SelectTrigger data-testid="select-config-finyear">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {finYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-[#6B6B6B] mb-1 block">Section 129 Template *</Label>
                  <Select value={section129Template} onValueChange={setSection129Template} disabled={!isNewEntry}>
                    <SelectTrigger data-testid="select-config-template">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-[#6B6B6B] mb-1 block">SMS Notification Template *</Label>
                  <Select value={smsTemplate} onValueChange={setSmsTemplate} disabled={!isNewEntry}>
                    <SelectTrigger data-testid="select-config-sms-template">
                      <SelectValue placeholder="Select SMS template" />
                    </SelectTrigger>
                    <SelectContent>
                      {smsTemplates.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-[#6B6B6B] mb-1 block">No of Lapse Days * <HelpTip text="Only applicable to workdays. Must be between 14 and 99 (14 days prescribed by law)." side="right" /></Label>
                  <Input
                    type="number"
                    min={14}
                    max={99}
                    value={lapseDays}
                    onChange={e => setLapseDays(parseInt(e.target.value, 10) || 14)}
                    disabled={!isNewEntry}
                    data-testid="input-config-lapse-days"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[#6B6B6B] mb-1 block">No of Notices per File *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={noticesPerFile}
                    onChange={e => setNoticesPerFile(parseInt(e.target.value, 10) || 500)}
                    disabled={!isNewEntry}
                    data-testid="input-config-notices-per-file"
                  />
                </div>
              </div>

              <div className="border-t border-[#E5E5E5] pt-4">
                <h3 className="text-sm font-semibold text-[#2E2E2E] mb-3">Additional Billing (Notice Cost)</h3>

                {isNewEntry && (
                  <div className="flex items-end gap-3 mb-3">
                    <div className="flex-1">
                      <Label className="text-xs text-[#6B6B6B] mb-1 block">Additional Billing Type</Label>
                      <Select value={addBillTypeId} onValueChange={setAddBillTypeId}>
                        <SelectTrigger data-testid="select-add-billing-type">
                          <SelectValue placeholder="--Select--" />
                        </SelectTrigger>
                        <SelectContent>
                          {additionalBillingTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-[#6B6B6B] mb-1 block">Amount</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={addBillAmount}
                        onChange={e => setAddBillAmount(e.target.value)}
                        placeholder="0.00"
                        data-testid="input-add-billing-amount"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddCostItem} data-testid="button-add-cost-item">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}

                {costItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Nr</TableHead>
                        <TableHead>Additional Billing Type</TableHead>
                        <TableHead className="text-right">Total Fees</TableHead>
                        {isNewEntry && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{item.nr}</TableCell>
                          <TableCell>{item.additionalBillingTypeName}</TableCell>
                          <TableCell className="text-right font-mono">R {item.amount.toFixed(2)}</TableCell>
                          {isNewEntry && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => removeCostItem(idx)} data-testid={`button-remove-cost-${idx}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-[#999] italic py-2">No information</p>
                )}
              </div>

              <div className="border-t border-[#E5E5E5] pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    id="cfg-rotation"
                    checked={activateRotation}
                    onCheckedChange={(v) => setActivateRotation(!!v)}
                    disabled={!isNewEntry}
                    data-testid="checkbox-activate-rotation"
                  />
                  <Label htmlFor="cfg-rotation" className="text-sm font-semibold text-[#2E2E2E]">Activate Rotation?</Label>
                  <HelpTip text="Enable attorney rotation for distributing handovers across multiple attorneys" side="right" />
                </div>

                {isNewEntry && activateRotation && (
                  <div className="flex items-end gap-3 mb-3">
                    <div className="flex-1">
                      <Label className="text-xs text-[#6B6B6B] mb-1 block">Attorney</Label>
                      <Select value={addAttorneyId} onValueChange={setAddAttorneyId}>
                        <SelectTrigger data-testid="select-add-attorney">
                          <SelectValue placeholder="--Select--" />
                        </SelectTrigger>
                        <SelectContent>
                          {attorneys.filter(a => a.isActive).map(a => <SelectItem key={String(a.attorneyId)} value={String(a.attorneyId)}>{a.attorneyName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-[#6B6B6B] mb-1 block">% Debtor Count</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={addPercentDebtor}
                        onChange={e => setAddPercentDebtor(e.target.value)}
                        placeholder="0"
                        data-testid="input-add-percent-debtor"
                      />
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-[#6B6B6B] mb-1 block">% Handover Amount</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={addPercentHandover}
                        onChange={e => setAddPercentHandover(e.target.value)}
                        placeholder="0"
                        data-testid="input-add-percent-handover"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddAttorney} data-testid="button-add-attorney">
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}

                {attorneyRotation.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Nr</TableHead>
                        <TableHead>Attorney</TableHead>
                        <TableHead className="text-right">% Allocation in Debtor Count</TableHead>
                        <TableHead className="text-right">% Allocation in Handover Amount</TableHead>
                        {isNewEntry && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attorneyRotation.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{item.nr}</TableCell>
                          <TableCell>{item.attorneyName}</TableCell>
                          <TableCell className="text-right font-mono">{item.percentDebtorCount}%</TableCell>
                          <TableCell className="text-right font-mono">{item.percentHandoverAmount}%</TableCell>
                          {isNewEntry && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => removeAttorney(idx)} data-testid={`button-remove-attorney-${idx}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {attorneyRotation.length > 0 && (
                        <TableRow className="bg-[#F7F7F7]">
                          <TableCell></TableCell>
                          <TableCell className="font-semibold text-xs">Total</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {attorneyRotation.reduce((s, a) => s + a.percentDebtorCount, 0)}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {attorneyRotation.reduce((s, a) => s + a.percentHandoverAmount, 0)}%
                          </TableCell>
                          {isNewEntry && <TableCell></TableCell>}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-[#999] italic py-2">No information</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-config">
              <XCircle className="w-4 h-4 mr-2" /> Cancel
            </Button>
            {isNewEntry && (
              <Button onClick={handleSubmit} disabled={saving} style={{ backgroundColor: 'var(--pos-accent)' }} data-testid="button-submit-config">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Submit
              </Button>
            )}
          </div>
        </div>
      </PosLayout>
    );
  }

  return (
    <PosLayout>
      <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="w-5 h-5 text-[var(--pos-accent)]" />
          <h2 className="text-lg font-semibold text-[#2E2E2E]">Section 129 – Letter of Demand Configuration</h2>
          <HelpTip text="Configure Section 129 notice parameters including templates, lapse days, costs, and attorney rotation settings per financial year." side="right" />
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-48">
                <Label className="text-xs text-[#6B6B6B] mb-1 block">Financial Year *</Label>
                <Select value={finYear} onValueChange={setFinYear}>
                  <SelectTrigger data-testid="select-landing-finyear">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {finYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} disabled={loading} style={{ backgroundColor: 'var(--pos-accent)' }} data-testid="button-search-config">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Search
                </Button>
                <Button variant="outline" onClick={handleClear} data-testid="button-clear-config">
                  <RotateCcw className="w-4 h-4 mr-2" /> Clear
                </Button>
                <Button variant="outline" onClick={openAddNew} data-testid="button-add-new-config">
                  <Plus className="w-4 h-4 mr-2" /> Add New
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {searched && (
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--pos-accent)]" />
                  <span className="ml-2 text-sm text-[#6B6B6B]">Loading configurations...</span>
                </div>
              ) : configEntries.length === 0 ? (
                <div className="text-center py-12 text-sm text-[#999]">No configuration entries found for {finYear}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Financial Year</TableHead>
                        <TableHead>Section 129 Template</TableHead>
                        <TableHead>SMS Template</TableHead>
                        <TableHead>Additional Billing Type</TableHead>
                        <TableHead className="text-right">Total Fees</TableHead>
                        <TableHead className="text-right">Notices per File</TableHead>
                        <TableHead className="text-right">Lapse Days</TableHead>
                        <TableHead>Rotation Activated</TableHead>
                        <TableHead>Enabled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configEntries.map((entry, idx) => (
                        <TableRow
                          key={entry.id || idx}
                          className="cursor-pointer hover:bg-[var(--pos-accent-tint)]"
                          onClick={() => openEntryDetail(entry)}
                          data-testid={`config-row-${entry.id || idx}`}
                        >
                          <TableCell>{entry.finYear}</TableCell>
                          <TableCell>{entry.section129Template}</TableCell>
                          <TableCell>{entry.smsTemplate}</TableCell>
                          <TableCell>{entry.additionalBillingType || '—'}</TableCell>
                          <TableCell className="text-right font-mono">{entry.totalFees != null ? `R ${entry.totalFees.toFixed(2)}` : '—'}</TableCell>
                          <TableCell className="text-right font-mono">{entry.noticesPerFile}</TableCell>
                          <TableCell className="text-right font-mono">{entry.lapseDays}</TableCell>
                          <TableCell>{entry.activateRotation ? 'Yes' : 'No'}</TableCell>
                          <TableCell>{entry.enabled ? 'Yes' : 'No'}</TableCell>
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
    </PosLayout>
  );
}
