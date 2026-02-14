import React, { useState } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ThirdPartyPaymentProcessing() {
  const [cashbook, setCashbook] = useState("ABSA BANK 2025/2026");
  const [paymentRef, setPaymentRef] = useState("");
  const [thirdParty, setThirdParty] = useState("");
  const [postToCashbook, setPostToCashbook] = useState("no");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{success: boolean, message: string} | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    // Mock download
    const element = document.createElement("a");
    const fileContent = "AccountNo,Amount,Reference,Date\nACC12345,100.00,REF001,2025-01-01";
    const fileBlob = new Blob([fileContent], { type: "text/csv" });
    element.href = URL.createObjectURL(fileBlob);
    element.download = "payment_import_template.csv";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleProcess = () => {
    if (!thirdParty || !file) {
      setProcessResult({
        success: false, 
        message: "Please select a third party provider and upload a file."
      });
      return;
    }

    setIsProcessing(true);
    setProcessResult(null);

    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setProcessResult({
        success: true,
        message: `Successfully processed file '${file.name}' for ${thirdParty}. ${postToCashbook === 'yes' ? 'Transactions posted to Cashbook.' : 'Transactions recorded (No Cashbook posting).'}`
      });
    }, 2000);
  };

  return (
    <PosLayout>
      <div className="flex-1 overflow-auto bg-slate-50 p-3 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          
          <div className="flex justify-between items-center">
             <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Third Party Payment Processing</h1>
          </div>

          <Card className="border-t-4 border-t-blue-600 shadow-sm">
            <CardHeader className="bg-slate-100/50 pb-4 border-b">
              <div className="flex items-center gap-2">
                <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                <CardTitle className="text-lg font-medium text-slate-800">
                  Third Party Payments - Import
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {processResult && (
                <Alert variant={processResult.success ? "default" : "destructive"} className={processResult.success ? "bg-green-50 border-green-200 text-green-800" : ""}>
                  {processResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{processResult.success ? "Success" : "Error"}</AlertTitle>
                  <AlertDescription>
                    {processResult.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="cashbook">CashBook</Label>
                  <Select value={cashbook} onValueChange={setCashbook}>
                    <SelectTrigger id="cashbook" className="bg-white">
                      <SelectValue placeholder="Select Cashbook" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABSA BANK 2025/2026">ABSA BANK 2025/2026</SelectItem>
                      <SelectItem value="FNB MAIN 2025/2026">FNB MAIN 2025/2026</SelectItem>
                      <SelectItem value="NEDBANK PRIMARY">NEDBANK PRIMARY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentRef">Payment Reference</Label>
                  <Input 
                    id="paymentRef" 
                    value={paymentRef} 
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Enter reference number"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thirdParty" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                    Select Third Party
                  </Label>
                  <Select value={thirdParty} onValueChange={setThirdParty}>
                    <SelectTrigger id="thirdParty" className={!thirdParty ? "border-red-300 bg-white" : "bg-white"}>
                      <SelectValue placeholder="-- Select --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EasyPay">EasyPay</SelectItem>
                      <SelectItem value="Grid">Grid</SelectItem>
                      <SelectItem value="Post Office">Post Office</SelectItem>
                      <SelectItem value="Utilipay">Utilipay</SelectItem>
                      <SelectItem value="Utilipay Distribution">Utilipay Distribution</SelectItem>
                      <SelectItem value="Generic Import">Generic Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fileUpload">Select File</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="fileUpload" 
                      type="file" 
                      onChange={handleFileChange}
                      accept=".csv,.txt,.xls,.xlsx,.xml"
                      className="cursor-pointer bg-white file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum file size: 5 MB. Allowed extensions: .csv, .txt, .xml
                  </p>
                </div>
              </div>

              {thirdParty === 'Generic Import' && (
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-4">
                   <h3 className="text-sm font-semibold text-blue-900 mb-2">Import Settings</h3>
                   
                   <div className="space-y-3">
                      <Label className="text-slate-700">Post transactions to Cashbook?</Label>
                      <RadioGroup value={postToCashbook} onValueChange={setPostToCashbook} className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="post-yes" />
                          <Label htmlFor="post-yes" className="font-normal cursor-pointer">Yes - Post to Bank & Debtor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="post-no" />
                          <Label htmlFor="post-no" className="font-normal cursor-pointer">No - Only Debtor/Direct Allocation</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-slate-500 italic">
                        {postToCashbook === 'yes' 
                          ? "Transactions will be recognized in the selected Cashbook and allocated to respective accounts." 
                          : "Transactions will only be allocated to accounts or held for direct deposit allocation. No bank entry will be created."}
                      </p>
                   </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleDownloadTemplate}
                  className="gap-2 text-slate-600 w-full sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>

                <Button 
                  onClick={handleProcess} 
                  disabled={isProcessing || !thirdParty || !file}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[150px] w-full sm:w-auto"
                >
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import & Process
                    </>
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}