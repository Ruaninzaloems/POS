import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Badge } from '@/components/ui/badge';
import {
  X, Loader2, User, Users, Phone, Home, Building2,
  CreditCard, Layers, Droplets, Gauge,
  Activity, FileText, Receipt, CalendarDays, Banknote,
  Clock, ArrowRight, Scale, BarChart3, AlertTriangle,
  Shield, AlertCircle, Gift, Briefcase, Landmark, Send,
  CalendarCheck, ChevronDown
} from 'lucide-react';
import { searchAccounts, getAccountBalance, type EnquirySearchResult } from '@/lib/enquiries-service';
import { ErrorState, TabErrorBoundary } from '@/pages/enquiries/shared';
import { AccountInfoTab, NameTab, BalanceDebtTab, LinkedAccountsTab } from '@/pages/enquiries/account-tabs';
import { ServiceBalanceTab, ConsumptionTab, ServicesMetersTab } from '@/pages/enquiries/service-tabs';
import { TransactionSummaryTab, DetailedTransactionListTab, TransactionHistoryTab, NextBillEstimateTab } from '@/pages/enquiries/transaction-tabs';
import { IncentivesTab, DepositsTab, PaymentPlansTab, PaymentExtensionHistoryTab, DebitOrdersTab, RatesValuationsTab, BilledVsPaidTab } from '@/pages/enquiries/financial-tabs';
import { PropertyDetailsTab, ContactInfoTab, HandoverTab, NotificationsTab, StatementsTab, ClearanceTab, DebtorNotesTab, Section129Tab, OccupiersTab, SendStatementsTab, IndigentHistoryTab } from '@/pages/enquiries/other-tabs';

interface AccountEnquiryDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: number | string;
}

type TabItem = { value: string; label: string; icon: React.ReactNode; color: string };
type TabGroup = { heading: string; tabs: TabItem[] };

const tabGroups: TabGroup[] = [
  {
    heading: 'ACCOUNT',
    tabs: [
      { value: 'account', label: 'Account', icon: <User className="w-3.5 h-3.5" />, color: 'blue' },
      { value: 'name', label: 'Name', icon: <Users className="w-3.5 h-3.5" />, color: 'indigo' },
      { value: 'property', label: 'Property', icon: <Home className="w-3.5 h-3.5" />, color: 'amber' },
      { value: 'contact', label: 'Contact', icon: <Phone className="w-3.5 h-3.5" />, color: 'violet' },
      { value: 'linked-accounts', label: 'Linked', icon: <Building2 className="w-3.5 h-3.5" />, color: 'purple' },
    ],
  },
  {
    heading: 'FINANCIAL',
    tabs: [
      { value: 'balance', label: 'Balance / Debt', icon: <CreditCard className="w-3.5 h-3.5" />, color: 'red' },
      { value: 'txn-detailed', label: 'Transaction Detail', icon: <Activity className="w-3.5 h-3.5" />, color: 'indigo' },
      { value: 'txn-summary', label: 'Transaction Summary', icon: <FileText className="w-3.5 h-3.5" />, color: 'slate' },
      { value: 'transactions', label: 'Receipts', icon: <Receipt className="w-3.5 h-3.5" />, color: 'blue' },
      { value: 'deposits', label: 'Deposits', icon: <Banknote className="w-3.5 h-3.5" />, color: 'lime' },
      { value: 'payment-plans', label: 'Payment Plans', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'purple' },
    ],
  },
  {
    heading: 'SERVICES',
    tabs: [
      { value: 'services', label: 'Services', icon: <Layers className="w-3.5 h-3.5" />, color: 'emerald' },
      { value: 'services-meters', label: 'Meters', icon: <Gauge className="w-3.5 h-3.5" />, color: 'emerald' },
      { value: 'consumption', label: 'Consumption', icon: <Droplets className="w-3.5 h-3.5" />, color: 'cyan' },
    ],
  },
  {
    heading: 'OTHER',
    tabs: [
      { value: 'handover', label: 'Handover', icon: <ArrowRight className="w-3.5 h-3.5" />, color: 'orange' },
      { value: 'clearance', label: 'Clearance', icon: <Shield className="w-3.5 h-3.5" />, color: 'emerald' },
      { value: 'statements', label: 'Statements', icon: <FileText className="w-3.5 h-3.5" />, color: 'blue' },
    ],
  },
];

const tabColorMap: Record<string, { bg: string; border: string; text: string; iconBg: string; activeBg: string; activeBorder: string; activeText: string; activeIconBg: string }> = {
  blue: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]', activeBg: 'bg-[var(--pos-accent-tint)]', activeBorder: 'border-[var(--pos-accent)] ring-1 ring-[var(--pos-accent-light)]', activeText: 'text-[#2E2E2E]', activeIconBg: 'bg-[var(--pos-accent)] text-white' },
  indigo: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-[var(--pos-accent-tint)] text-[var(--pos-accent)]', activeBg: 'bg-[var(--pos-accent-tint)]', activeBorder: 'border-[var(--pos-accent)] ring-1 ring-[var(--pos-accent-light)]', activeText: 'text-[#2E2E2E]', activeIconBg: 'bg-[var(--pos-accent)] text-white' },
  red: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-red-50 text-red-500', activeBg: 'bg-red-50', activeBorder: 'border-red-400 ring-1 ring-red-200', activeText: 'text-red-800', activeIconBg: 'bg-red-500 text-white' },
  emerald: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-emerald-50 text-emerald-500', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-400 ring-1 ring-emerald-200', activeText: 'text-emerald-800', activeIconBg: 'bg-emerald-500 text-white' },
  amber: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-amber-50 text-amber-600', activeBg: 'bg-amber-50', activeBorder: 'border-amber-400 ring-1 ring-amber-200', activeText: 'text-amber-800', activeIconBg: 'bg-amber-500 text-white' },
  cyan: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-cyan-50 text-cyan-500', activeBg: 'bg-cyan-50', activeBorder: 'border-cyan-400 ring-1 ring-cyan-200', activeText: 'text-cyan-800', activeIconBg: 'bg-cyan-500 text-white' },
  violet: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-violet-50 text-violet-500', activeBg: 'bg-violet-50', activeBorder: 'border-violet-400 ring-1 ring-violet-200', activeText: 'text-violet-800', activeIconBg: 'bg-violet-500 text-white' },
  orange: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-orange-50 text-orange-500', activeBg: 'bg-orange-50', activeBorder: 'border-orange-400 ring-1 ring-orange-200', activeText: 'text-orange-800', activeIconBg: 'bg-orange-500 text-white' },
  pink: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-pink-50 text-pink-500', activeBg: 'bg-pink-50', activeBorder: 'border-pink-400 ring-1 ring-pink-200', activeText: 'text-pink-800', activeIconBg: 'bg-pink-500 text-white' },
  lime: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-lime-50 text-lime-600', activeBg: 'bg-lime-50', activeBorder: 'border-lime-400 ring-1 ring-lime-200', activeText: 'text-lime-800', activeIconBg: 'bg-lime-500 text-white' },
  slate: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-[#F2F4F7] text-slate-500', activeBg: 'bg-[#F2F4F7]', activeBorder: 'border-slate-400 ring-1 ring-slate-300', activeText: 'text-slate-800', activeIconBg: 'bg-slate-600 text-white' },
  purple: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-purple-50 text-purple-500', activeBg: 'bg-purple-50', activeBorder: 'border-purple-400 ring-1 ring-purple-200', activeText: 'text-purple-800', activeIconBg: 'bg-purple-500 text-white' },
  teal: { bg: 'bg-white', border: 'border-[#D6D6D6]', text: 'text-slate-600', iconBg: 'bg-teal-50 text-teal-500', activeBg: 'bg-teal-50', activeBorder: 'border-teal-400 ring-1 ring-teal-200', activeText: 'text-teal-800', activeIconBg: 'bg-teal-500 text-white' },
};

export function AccountEnquiryDialog({ open, onClose, accountId }: AccountEnquiryDialogProps) {
  const [account, setAccount] = useState<EnquirySearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('account');
  const [headerBalance, setHeaderBalance] = useState<number | null>(null);
  const loadedAccountRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !accountId) {
      loadedAccountRef.current = null;
      return;
    }
    const key = String(accountId);
    if (loadedAccountRef.current === key) return;
    loadedAccountRef.current = key;

    setLoading(true);
    setError(null);
    setAccount(null);
    setActiveTab('account');
    setHeaderBalance(null);

    searchAccounts({ accountNo: key })
      .then(results => {
        if (results && results.length > 0) {
          setAccount(results[0]);
          const accId = results[0].account_ID || results[0].accountID;
          if (accId) {
            getAccountBalance(accId)
              .then((bal: any) => {
                const total = bal?.totalBalance ?? bal?.outstandingBalance ?? bal?.outStandingAmt ?? null;
                if (total !== null) setHeaderBalance(Number(total));
              })
              .catch((err) => { console.error('[AccountEnquiryDialog] Failed to fetch account balance:', err); });
          }
        } else {
          setError(`No account found for "${key}"`);
        }
      })
      .catch((e: any) => setError(e.message || 'Failed to load account'))
      .finally(() => setLoading(false));
  }, [open, accountId]);

  const numericAccountId = account ? (account.account_ID || account.accountID) : 0;
  const accountNumber = account?.accountNumber || account?.oldAccountCode || String(accountId);
  const accountName = account?.name || account?.surname_Company || '';
  const isActive = (account?.accountStatus || account?.statusDesc)?.toLowerCase() === 'active';
  const propertyId = account?.propertyID ? Number(account.propertyID) : (account?.unitID || account?.unitPartitionID || undefined);
  const unitId = account?.unitID || undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden [&>button.absolute]:hidden" data-testid="account-enquiry-dialog">
        <div className="shrink-0 bg-gradient-to-r from-[var(--pos-accent)] to-[var(--pos-accent-dark)] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {accountName ? (
              <div className="shrink-0 h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                {accountName.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="shrink-0 h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white/70 animate-spin" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {accountName ? (
                  <h2 className="text-sm font-bold text-white truncate">{accountName}</h2>
                ) : (
                  <h2 className="text-sm font-medium text-white/70 truncate">Loading account...</h2>
                )}
                {account && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-300' : 'bg-white/40'}`} />
                    {account.accountStatus || account.statusDesc || ''}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-white/80 font-mono">
                Acc: {accountNumber}
                {account?.oldAccountCode && account.oldAccountCode !== accountNumber && <span className="text-white/60"> | Old: {account.oldAccountCode}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {headerBalance !== null && (
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wider text-white/60 font-semibold">Balance</div>
                <div className={`text-base font-bold font-mono ${headerBalance > 0 ? 'text-red-200' : headerBalance < 0 ? 'text-emerald-200' : 'text-white'}`}>
                  R {headerBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10" onClick={onClose} data-testid="button-close-enquiry-dialog">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--pos-accent)]" />
              <p className="text-sm text-muted-foreground">Loading account {String(accountId)}...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <ErrorState message={error || "Account not found"} />
          </div>
        )}

        {!loading && !error && account && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 py-2">
                <TabsList className="h-auto bg-transparent p-0 w-full block">
                  <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                    {tabGroups.map((group) => (
                      <div key={group.heading}>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{group.heading}</div>
                        <div className="flex flex-wrap gap-1">
                          {group.tabs.map(tab => {
                            const colors = tabColorMap[tab.color] || tabColorMap.blue;
                            const isTabActive = activeTab === tab.value;
                            return (
                              <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={`
                                  inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium
                                  transition-all duration-150 cursor-pointer
                                  ${isTabActive
                                    ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText} shadow-sm font-semibold`
                                    : `${colors.bg} ${colors.border} ${colors.text} hover:border-[#BFBFBF] hover:bg-[#F7F7F7]`
                                  }
                                `}
                                data-testid={`dialog-tab-${tab.value}`}
                              >
                                <span className={`shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors ${isTabActive ? colors.activeIconBg : colors.iconBg}`}>
                                  {tab.icon}
                                </span>
                                {tab.label}
                              </TabsTrigger>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsList>
              </div>
              <div className="flex-1 overflow-auto bg-[#F2F4F7]">
                <TabsContent value="account" className="m-0"><TabErrorBoundary tabName="Account"><AccountInfoTab account={account} /></TabErrorBoundary></TabsContent>
                <TabsContent value="name" className="m-0"><TabErrorBoundary tabName="Name"><NameTab accountId={numericAccountId} onNavigateToAccount={() => {}} /></TabErrorBoundary></TabsContent>
                <TabsContent value="balance" className="m-0"><TabErrorBoundary tabName="Balance"><BalanceDebtTab accountId={numericAccountId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="services" className="m-0"><TabErrorBoundary tabName="Services"><ServiceBalanceTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="property" className="m-0"><TabErrorBoundary tabName="Property"><PropertyDetailsTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="consumption" className="m-0"><TabErrorBoundary tabName="Consumption"><ConsumptionTab accountId={numericAccountId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="contact" className="m-0"><TabErrorBoundary tabName="Contact"><ContactInfoTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="handover" className="m-0"><TabErrorBoundary tabName="Handover"><HandoverTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="deposits" className="m-0"><TabErrorBoundary tabName="Deposits"><DepositsTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="transactions" className="m-0"><TabErrorBoundary tabName="Receipts"><TransactionHistoryTab accountId={numericAccountId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="txn-summary" className="m-0"><TabErrorBoundary tabName="Transaction Summary"><TransactionSummaryTab accountId={numericAccountId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="txn-detailed" className="m-0"><TabErrorBoundary tabName="Detailed Transactions"><DetailedTransactionListTab accountId={numericAccountId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="services-meters" className="m-0"><TabErrorBoundary tabName="Meters"><ServicesMetersTab accountId={numericAccountId} unitId={unitId} accountNumber={accountNumber} /></TabErrorBoundary></TabsContent>
                <TabsContent value="payment-plans" className="m-0"><TabErrorBoundary tabName="Payment Plans"><PaymentPlansTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="linked-accounts" className="m-0"><TabErrorBoundary tabName="Linked Accounts"><LinkedAccountsTab accountId={numericAccountId} onSelectAccount={() => {}} /></TabErrorBoundary></TabsContent>
                <TabsContent value="clearance" className="m-0"><TabErrorBoundary tabName="Clearance"><ClearanceTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
                <TabsContent value="statements" className="m-0"><TabErrorBoundary tabName="Statements"><StatementsTab accountId={numericAccountId} /></TabErrorBoundary></TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
