import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

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

  return (
    <div className="w-full bg-white rounded-lg border shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-gradient-to-b from-gray-700 to-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center shadow-md">
             <span className="mr-2 transform rotate-90 inline-block text-[10px]">&#9654;</span> Billing Enquiry Search
        </div>
        
        <div className="p-6 space-y-6 bg-gray-50/50" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-accountNo">Account ID</label>
                    <Input 
                        placeholder="Account ID"
                        value={criteria.accountNo}
                        onChange={(e) => handleChange('accountNo', e.target.value)}
                        className="bg-white"
                        data-testid="input-accountNo"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-oldAccount">Old Account</label>
                    <Input 
                        placeholder="Old Account Code"
                        value={criteria.oldAccountCode}
                        onChange={(e) => handleChange('oldAccountCode', e.target.value)}
                        className="bg-white"
                        data-testid="input-oldAccount"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-name">Company Name</label>
                    <Input 
                        placeholder="Company / Person Name"
                        value={criteria.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="bg-white"
                        data-testid="input-name"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-idNo">ID / Registration Number</label>
                    <Input 
                        placeholder="ID / Registration Number"
                        value={criteria.idNo}
                        onChange={(e) => handleChange('idNo', e.target.value)}
                        className="bg-white"
                        data-testid="input-idNo"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-passport">Passport Number</label>
                    <Input 
                        placeholder="Passport Number"
                        value={criteria.passportNumber}
                        onChange={(e) => handleChange('passportNumber', e.target.value)}
                        className="bg-white"
                        data-testid="input-passport"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-deliveryAddress">Delivery Address</label>
                    <Input 
                        placeholder="Delivery Address"
                        value={criteria.deliveryAddress}
                        onChange={(e) => handleChange('deliveryAddress', e.target.value)}
                        className="bg-white"
                        data-testid="input-deliveryAddress"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-locationAddress">Location Address</label>
                    <Input 
                        placeholder="Location Address"
                        value={criteria.locationAddress}
                        onChange={(e) => handleChange('locationAddress', e.target.value)}
                        className="bg-white"
                        data-testid="input-locationAddress"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-allotment">Allotment Area</label>
                    <Input 
                        placeholder="Allotment Area"
                        value={criteria.allotmentArea}
                        onChange={(e) => handleChange('allotmentArea', e.target.value)}
                        className="bg-white"
                        data-testid="input-allotment"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-erf">ERF Number</label>
                    <Input 
                        placeholder="ERF Number"
                        value={criteria.erfNumber}
                        onChange={(e) => handleChange('erfNumber', e.target.value)}
                        className="bg-white"
                        data-testid="input-erf"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-trading">Trading</label>
                    <Input 
                        placeholder="Trading"
                        value={criteria.trading}
                        onChange={(e) => handleChange('trading', e.target.value)}
                        className="bg-white"
                        data-testid="input-trading"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-email">Email Address</label>
                    <Input 
                        placeholder="Email Address"
                        value={criteria.emailAddress}
                        onChange={(e) => handleChange('emailAddress', e.target.value)}
                        className="bg-white"
                        data-testid="input-email"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-mobile">Mobile Number</label>
                    <Input 
                        placeholder="Mobile Number"
                        value={criteria.mobileNumber}
                        onChange={(e) => handleChange('mobileNumber', e.target.value)}
                        className="bg-white"
                        data-testid="input-mobile"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" data-testid="label-meter">Physical Meter Number</label>
                    <Input 
                        placeholder="Physical Meter Number"
                        value={criteria.physicalMeterNumber}
                        onChange={(e) => handleChange('physicalMeterNumber', e.target.value)}
                        className="bg-white"
                        data-testid="input-meter"
                    />
                </div>
            </div>

            <div className="text-red-600 text-xs font-semibold tracking-tight">
                ** At Least One Search Parameter Must Be Entered
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button onClick={handleSearch} disabled={isLoading} className="w-24 bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-300 shadow-sm" data-testid="button-search">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
                <Button variant="outline" onClick={handleClear} className="w-24 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 shadow-sm" data-testid="button-clear">Clear</Button>
                <Button variant="ghost" onClick={onCancel} className="w-24 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 shadow-sm" data-testid="button-cancel">Cancel</Button>
            </div>
        </div>
    </div>
  );
}
