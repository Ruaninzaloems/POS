import React, { useState } from 'react';
import { usePos } from '@/lib/pos-state';
import { CASH_OFFICES } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function CashierSetup() {
    const { currentUser, startSession } = usePos();
    const [floatAmount, setFloatAmount] = useState<string>('0.00');
    const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
    const [error, setError] = useState<string>('');

    const selectedOffice = CASH_OFFICES.find(o => o.id === selectedOfficeId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOfficeId) {
            setError('Please select a cashier office.');
            return;
        }
        
        const float = parseFloat(floatAmount);
        if (isNaN(float) || float < 0) {
            setError('Please enter a valid float amount.');
            return;
        }

        startSession(selectedOfficeId, float);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="border-b bg-white">
                    <CardTitle className="text-xl text-slate-800">Cashier Setup</CardTitle>
                </CardHeader>
                <CardContent className="p-8 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Name <span className="text-red-500">*</span></Label>
                            <Input 
                                value={currentUser.name} 
                                disabled 
                                className="bg-slate-100 border-slate-300 text-slate-600"
                            />
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Cash Float (Starting Amount Cash On Hand) <span className="text-red-500">*</span></Label>
                            <Input 
                                type="number"
                                step="0.01"
                                value={floatAmount}
                                onChange={(e) => setFloatAmount(e.target.value)}
                                className="bg-slate-100 border-slate-300 text-right"
                            />
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Cashier Office <span className="text-red-500">*</span></Label>
                            <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                                <SelectTrigger className="bg-slate-100 border-slate-300">
                                    <SelectValue placeholder="-- Select --" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {CASH_OFFICES.map(office => (
                                        <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                            <Label className="text-right text-slate-600">Ledger Vote <span className="text-red-500">*</span></Label>
                            <Input 
                                value={selectedOffice ? selectedOffice.ledgerVote : ''} 
                                disabled 
                                className={`bg-slate-100 border-slate-300 ${selectedOffice ? 'text-slate-800 font-medium' : 'text-slate-400'}`}
                                placeholder="Select an office to view ledger vote"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <Separator className="my-6" />

                        <div className="flex justify-center gap-4">
                            <Button type="submit" className="w-32 bg-slate-800 hover:bg-slate-900">
                                Submit
                            </Button>
                            <Button type="button" variant="outline" className="w-32 bg-slate-700 hover:bg-slate-800 text-white hover:text-white border-slate-700">
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
