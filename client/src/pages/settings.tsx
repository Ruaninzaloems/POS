import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, ShieldAlert, AlertTriangle, Calculator, Check, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { HelpTip } from '@/components/ui/help-tip';

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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2">System Settings <HelpTip text="Manage POS configuration, security limits, and reconciliation features." /></h1>
              <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Manage POS configuration and security limits</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
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
                    <div className="p-2 bg-[var(--pos-accent-tint)] rounded-lg text-[#6B6B6B]">
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