import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface ConsumerSearchFormProps {
  onSearch: (criteria: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConsumerSearchForm({ onSearch, onCancel, isLoading }: ConsumerSearchFormProps) {
  const [criteria, setCriteria] = useState({
    accountNo: '',
    name: '',
    idNo: '',
    sgNumber: '',
    oldAccountCode: '',
    street: '',
    physicalMeterNumber: ''
  });

  const handleChange = (field: string, value: string) => {
    setCriteria(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    // Basic validation
    const hasValue = Object.values(criteria).some(val => val.trim().length > 0);
    if (!hasValue) return;
    
    onSearch(criteria);
  };

  const handleClear = () => {
    setCriteria({
      accountNo: '',
      name: '',
      idNo: '',
      sgNumber: '',
      oldAccountCode: '',
      street: '',
      physicalMeterNumber: ''
    });
  };

  return (
    <div className="w-full bg-white rounded-lg border shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-gradient-to-b from-gray-700 to-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center shadow-md">
             <span className="mr-2 transform rotate-90 inline-block text-[10px]">▶</span> Consumer Payment Search
        </div>
        
        <div className="p-6 space-y-6 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                    <Input 
                        placeholder="Account Number" 
                        value={criteria.accountNo}
                        onChange={(e) => handleChange('accountNo', e.target.value)}
                        className="bg-white"
                    />
                </div>
                <div className="space-y-1">
                    <Input 
                        placeholder="Name" 
                        value={criteria.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-1">
                    <Input 
                        placeholder="ID Number" 
                        value={criteria.idNo}
                        onChange={(e) => handleChange('idNo', e.target.value)}
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-1">
                    <Input 
                        placeholder="SG Number" 
                        value={criteria.sgNumber}
                        onChange={(e) => handleChange('sgNumber', e.target.value)}
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-1">
                    <Input 
                        placeholder="Old Account Code" 
                        value={criteria.oldAccountCode}
                        onChange={(e) => handleChange('oldAccountCode', e.target.value)}
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-1">
                    <Input 
                        placeholder="Street" 
                        value={criteria.street}
                        onChange={(e) => handleChange('street', e.target.value)}
                        className="bg-white"
                    />
                </div>
                 <div className="space-y-1">
                    <Input 
                        placeholder="Physical Meter Number" 
                        value={criteria.physicalMeterNumber}
                        onChange={(e) => handleChange('physicalMeterNumber', e.target.value)}
                        className="bg-white"
                    />
                </div>
            </div>

            <div className="text-red-600 text-xs font-semibold tracking-tight">
                ** At Least One Search Parameter Must Be Entered
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button onClick={handleSearch} className="w-24 bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-300 shadow-sm">Search</Button>
                <Button variant="outline" onClick={handleClear} className="w-24 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 shadow-sm">Clear</Button>
                <Button variant="ghost" onClick={onCancel} className="w-24 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 shadow-sm">Cancel</Button>
            </div>
        </div>
    </div>
  );
}
