import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, ShieldAlert, AlertTriangle, Calculator, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  const { officeLimits, updateOfficeLimit, systemSettings, updateSystemSettings, referenceData } = usePos();
  const { toast } = useToast();

  const handleLimitChange = (officeId: string, value: string) => {
      const limit = parseFloat(value);
      if (!isNaN(limit) && limit >= 0) {
          updateOfficeLimit(officeId, limit);
      }
  };

  return (
    <PosLayout>
      <div className="flex-1 bg-gray-50/50 p-3 sm:p-6 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Manage POS configuration and security limits.</p>
          </div>

          <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle>Reconciliation Features</CardTitle>
                            <CardDescription>Configure day-end and cash up processes.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">Denomination Counting</Label>
                            <p className="text-sm text-muted-foreground">
                                Require cashiers to count individual notes and coins during day end reconciliation instead of entering a total.
                            </p>
                        </div>
                        <Switch 
                            checked={systemSettings.enableDenominationCounting}
                            onCheckedChange={(checked) => updateSystemSettings({ enableDenominationCounting: checked })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle>Cash Office Limits</CardTitle>
                        <CardDescription>Control the maximum transaction amount for each cash office.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3 mb-6">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Security Note</p>
                        <p>Changes apply immediately to all active sessions in the respective office. Transactions exceeding these limits will be blocked.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {referenceData.cashOffices.map((office: any) => (
                        <div key={office.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3 sm:gap-4 items-center p-3 sm:p-4 border rounded-lg bg-card hover:bg-muted/20 transition-colors">
                            <div>
                                <h3 className="font-semibold text-sm">{office.name}</h3>
                                <p className="text-xs text-muted-foreground font-mono mt-1">{office.ledgerVote}</p>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono">R</span>
                                <Input 
                                    type="number" 
                                    className="pl-8 font-mono text-right" 
                                    value={officeLimits[office.id] ?? office.maxTransactionLimit ?? 5000}
                                    onChange={(e) => handleLimitChange(office.id, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

              </CardContent>
            </Card>

            <Card className="opacity-60 pointer-events-none">
                <CardHeader>
                    <CardTitle>Receipt Configuration</CardTitle>
                    <CardDescription>Manage receipt templates and printing defaults.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">Additional settings coming soon...</p>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PosLayout>
  );
}