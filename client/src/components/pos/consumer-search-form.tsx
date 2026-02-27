import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsumerSearchFormProps {
  onSearch: (criteria: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConsumerSearchForm({ onSearch, onCancel, isLoading }: ConsumerSearchFormProps) {
  const [criteria, setCriteria] = useState({
    accountNo: '',
    oldAccountCode: '',
    name: '',
    idNo: '',
    passportNumber: '',
    deliveryAddress: '',
    locationAddress: '',
    allotmentArea: '',
    erfNumber: '',
    trading: '',
    emailAddress: '',
    mobileNumber: '',
    physicalMeterNumber: '',
  });
  const [showMore, setShowMore] = useState(false);

  const handleChange = (field: string, value: string) => {
    setCriteria(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    const hasValue = Object.values(criteria).some(val => val.trim().length > 0);
    if (!hasValue) return;
    onSearch(criteria);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') onCancel();
  };

  const handleClear = () => {
    setCriteria({
      accountNo: '',
      oldAccountCode: '',
      name: '',
      idNo: '',
      passportNumber: '',
      deliveryAddress: '',
      locationAddress: '',
      allotmentArea: '',
      erfNumber: '',
      trading: '',
      emailAddress: '',
      mobileNumber: '',
      physicalMeterNumber: '',
    });
  };

  const filledCount = Object.values(criteria).filter(v => v.trim().length > 0).length;

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] text-white px-3 py-2 text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Advanced Search
                {filledCount > 0 && <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{filledCount} field{filledCount > 1 ? 's' : ''}</span>}
            </span>
            <button 
                onClick={onCancel} 
                className="p-1 hover:bg-white/20 rounded-md transition-colors"
                data-testid="button-close-advanced"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
        
        <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-accountNo">Account ID</label>
                    <Input 
                        placeholder="Account ID"
                        value={criteria.accountNo}
                        onChange={(e) => handleChange('accountNo', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-accountNo"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-oldAccount">Old Account</label>
                    <Input 
                        placeholder="Old Code"
                        value={criteria.oldAccountCode}
                        onChange={(e) => handleChange('oldAccountCode', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-oldAccount"
                    />
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-name">Name</label>
                    <Input 
                        placeholder="Company / Person"
                        value={criteria.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-name"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-idNo">ID Number</label>
                    <Input 
                        placeholder="ID / Reg No"
                        value={criteria.idNo}
                        onChange={(e) => handleChange('idNo', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-idNo"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-meter">Meter No</label>
                    <Input 
                        placeholder="Meter Number"
                        value={criteria.physicalMeterNumber}
                        onChange={(e) => handleChange('physicalMeterNumber', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-meter"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-erf">ERF Number</label>
                    <Input 
                        placeholder="ERF No"
                        value={criteria.erfNumber}
                        onChange={(e) => handleChange('erfNumber', e.target.value)}
                        className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                        data-testid="input-erf"
                    />
                </div>
            </div>

            {showMore && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-passport">Passport</label>
                        <Input 
                            placeholder="Passport No"
                            value={criteria.passportNumber}
                            onChange={(e) => handleChange('passportNumber', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-passport"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-deliveryAddress">Delivery Addr</label>
                        <Input 
                            placeholder="Delivery Address"
                            value={criteria.deliveryAddress}
                            onChange={(e) => handleChange('deliveryAddress', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-deliveryAddress"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-locationAddress">Location Addr</label>
                        <Input 
                            placeholder="Location Address"
                            value={criteria.locationAddress}
                            onChange={(e) => handleChange('locationAddress', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-locationAddress"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-allotment">Allotment</label>
                        <Input 
                            placeholder="Allotment Area"
                            value={criteria.allotmentArea}
                            onChange={(e) => handleChange('allotmentArea', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-allotment"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-trading">Trading</label>
                        <Input 
                            placeholder="Trading"
                            value={criteria.trading}
                            onChange={(e) => handleChange('trading', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-trading"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-email">Email</label>
                        <Input 
                            placeholder="Email Address"
                            value={criteria.emailAddress}
                            onChange={(e) => handleChange('emailAddress', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-email"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase" data-testid="label-mobile">Mobile</label>
                        <Input 
                            placeholder="Mobile Number"
                            value={criteria.mobileNumber}
                            onChange={(e) => handleChange('mobileNumber', e.target.value)}
                            className="h-8 text-sm rounded-lg border-slate-200 focus:border-[var(--pos-accent)]"
                            data-testid="input-mobile"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] hover:from-[var(--pos-accent-dark)] hover:to-[var(--pos-accent-dark)] text-white shadow-sm rounded-lg h-8 px-4 text-xs" data-testid="button-search">
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Search className="w-3 h-3 mr-1" />}
                    Search
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear} className="rounded-lg h-8 px-3 text-xs border-slate-200" data-testid="button-clear">Clear</Button>
                <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-lg h-8 px-3 text-xs" data-testid="button-cancel">Cancel</Button>
                <div className="flex-1" />
                <button 
                    onClick={() => setShowMore(!showMore)}
                    className="text-[11px] text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] flex items-center gap-0.5 font-medium"
                    data-testid="button-toggle-more-fields"
                >
                    {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showMore ? 'Less' : 'More'}
                </button>
            </div>
        </div>
    </div>
  );
}
