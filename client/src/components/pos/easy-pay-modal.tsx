import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { mockEasyPayQuery, EasyPayBill } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

interface EasyPayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToTransaction: (bill: EasyPayBill) => void;
}

export function EasyPayModal({ open, onOpenChange, onAddToTransaction }: EasyPayModalProps) {
  const [reference, setReference] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EasyPayBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleQuery = async () => {
    if (!reference) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Simulate API call
      const bill = await mockEasyPayQuery(reference);
      setResult(bill);
    } catch (err) {
      setError("EasyPay reference not found or system offline.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    if (result) {
      onAddToTransaction(result);
      onOpenChange(false);
      setReference("");
      setResult(null);
      toast({
        title: "EasyPay Bill Added",
        description: `Added R ${result.amount.toFixed(2)} to current transaction.`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            EasyPay Bill Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="easypay-ref">EasyPay Reference Number</Label>
            <div className="flex gap-2">
              <Input
                id="easypay-ref"
                placeholder="Enter 16-digit reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              />
              <Button onClick={handleQuery} disabled={isLoading || !reference}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Query"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {result && (
            <Card className="border-blue-100 bg-blue-50/50">
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-900">{result.billerName}</h4>
                    <p className="text-sm text-slate-500">{result.accountName}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-lg text-blue-600">
                      R {result.amount.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500">Due Date: {result.dueDate}</span>
                  </div>
                </div>
                
                <div className="text-xs text-slate-500 pt-2 border-t border-blue-100 flex justify-between">
                  <span>Ref: {result.reference}</span>
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!result}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Add to Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
