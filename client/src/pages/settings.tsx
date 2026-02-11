import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { usePos } from '@/lib/pos-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, ShieldAlert, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, currentUser } = usePos();
  const { toast } = useToast();
  const [localLimit, setLocalLimit] = React.useState(settings.maxTransactionLimit.toString());

  const handleSave = () => {
    const limit = parseFloat(localLimit);
    if (isNaN(limit) || limit < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number for the transaction limit.",
        variant: "destructive"
      });
      return;
    }

    updateSettings({ maxTransactionLimit: limit });
    toast({
      title: "Settings Saved",
      description: `Maximum transaction limit updated to R ${limit.toFixed(2)}`,
    });
  };

  return (
    <PosLayout>
      <div className="flex-1 bg-gray-50/50 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground mt-2">Manage POS configuration and security limits.</p>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle>Transaction Limits</CardTitle>
                        <CardDescription>Control the maximum amount a cashier can process per transaction.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="max-limit">Maximum Cash Transaction Amount (R)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono">R</span>
                            <Input 
                                id="max-limit" 
                                type="number" 
                                className="pl-8 font-mono text-lg" 
                                value={localLimit}
                                onChange={(e) => setLocalLimit(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Transactions exceeding this amount will be blocked and require supervisor override.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">Security Note</p>
                            <p>Changing this limit affects all cashiers immediately. Current active transactions will be validated against this new limit upon completion.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} className="gap-2">
                        <Save className="w-4 h-4" />
                        Save Changes
                    </Button>
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