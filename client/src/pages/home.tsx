import React from 'react';
import { Link, useLocation } from 'wouter';
import { usePos } from '@/lib/pos-state';
import {
  Layers,
  Banknote,
  RefreshCw,
  Users,
  Zap,
  FileBarChart,
  FileSearch,
  Search,
  ShieldCheck,
  LogOut,
  Monitor,
  Smartphone,
  ChevronRight,
  MessageSquareMore,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';

const menuItems = [
  { label: 'POS', href: '/pos', icon: Layers, description: 'Point of sale receipting and payments', helpTip: 'Process payments for consumer accounts, prepaid, clearance, and direct income' },
  { label: 'Direct Deposits Manual', href: '/direct-deposits/manual', icon: Banknote, description: 'Manual allocation of direct deposits', helpTip: 'Allocate EFT and direct deposit payments to consumer accounts' },
  { label: 'Direct Deposits Auto', href: '/direct-deposits/auto', icon: RefreshCw, description: 'Automatic processing of direct deposits', helpTip: 'Allocate EFT and direct deposit payments to consumer accounts automatically' },
  { label: 'Third Party Payment Processing', href: '/third-party/processing', icon: Users, description: 'Process third party payments', helpTip: 'Import and process bulk payment files from external sources' },
  { label: 'Utilipay Distribution Reconciliation', href: '/third-party/utilipay-reconciliation', icon: Zap, description: 'Reconcile Utilipay distribution records', helpTip: 'Import and process bulk payment files from external sources' },
  { label: 'Bulk Allocation Progress', href: '/bulk-allocation', icon: FileBarChart, description: 'View bulk allocation progress and errors', helpTip: 'Track the progress and status of bulk deposit allocations being processed' },
  { label: 'View Receipts', href: '/view-receipts', icon: FileSearch, description: 'Search and view transaction receipts', helpTip: 'Search and reprint previously issued receipts' },
  { label: 'General Enquiries', href: '/enquiries/general', icon: Search, description: 'Search and view account details', helpTip: 'Look up account balances, transaction history, and billing details' },
  { label: 'Client Communications', href: '/communications', icon: MessageSquareMore, description: 'Send custom emails and SMS to account holders', helpTip: 'Send emails and SMS messages to account holders' },
  { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck, description: 'Supervisor dashboard and approvals', helpTip: 'Review and approve cashier day-end submissions and cancellation requests' },
];

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { currentUser, activeSession, endSession, viewMode, toggleViewMode } = usePos();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="h-14 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white flex items-center px-3 sm:px-4 justify-between shrink-0 z-20 shadow-lg">
        <div className="flex items-center gap-2">
          <img src="/images/platinum-logo.png" alt="Platinum" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
          <h1 className="font-semibold text-base sm:text-lg tracking-tight text-white">Platinum POS <span className="bg-white/20 text-white/80 text-[10px] px-1.5 py-0.5 rounded-full font-normal ml-1">v2.0</span></h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <HelpTip text={viewMode === 'desktop' ? "Switch to mobile-optimized layout with touch-friendly controls" : "Switch to desktop layout with full sidebar navigation"} side="bottom" className="hidden sm:inline-flex">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:inline-flex"
              onClick={toggleViewMode}
              title={viewMode === 'desktop' ? "Switch to Mobile View" : "Switch to Desktop View"}
            >
              {viewMode === 'desktop' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </Button>
          </HelpTip>

          {activeSession && (
            <>
              <div className="h-6 w-px bg-white/20 hidden sm:block" />
              <HelpTip text="You have an active cashier session. All transactions will be recorded under your user profile until you end the session." side="bottom" className="text-white/60 hover:text-white/80">
                <div className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2 cursor-help">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-mono border border-white/30 shrink-0">
                    {currentUser.name?.charAt(0) || 'C'}
                  </div>
                  <div className="hidden sm:flex flex-col items-start text-sm leading-tight">
                    <span className="font-medium text-white">{currentUser.name}</span>
                    <span className="text-xs text-white/60">{currentUser.cashOffice}</span>
                  </div>
                </div>
              </HelpTip>
              <div className="h-6 w-px bg-white/20 hidden sm:block" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-red-300 hover:bg-white/10" onClick={endSession} title="End Session">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="md:hidden flex-1 overflow-y-auto overscroll-contain p-4 bg-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Modules</h2>
          <div className="grid grid-cols-2 gap-2.5 pb-4">
            {menuItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <button
                  className="w-full flex flex-col items-center gap-2 p-3.5 rounded-xl text-center hover:bg-blue-50/50 active:scale-[0.97] transition-all group border border-slate-200/80 bg-white shadow-sm relative overflow-hidden touch-manipulation"
                  data-testid={`menu-item-${item.href.replace(/\//g, '-').slice(1) || 'home'}`}
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shrink-0 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors">
                    <item.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-[11px] font-medium text-slate-700 leading-tight inline-flex items-center gap-0.5">{item.label} <HelpTip text={item.helpTip} side="bottom" /></div>
                </button>
              </Link>
            ))}
          </div>
        </div>

        <aside className="hidden md:block w-80 border-r bg-card overflow-y-auto shrink-0" data-testid="sidebar-menu">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Modules</h2>
          </div>
          <nav className="py-2">
            {menuItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50/50 transition-colors group border-l-3 border-transparent hover:border-blue-500"
                  data-testid={`menu-item-desktop-${item.href.replace(/\//g, '-').slice(1) || 'home'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                    <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground inline-flex items-center gap-1">{item.label} <HelpTip text={item.helpTip} side="right" /></div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="hidden md:flex flex-1 items-center justify-center bg-muted/30 overflow-auto relative">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent" />
          </div>
          <div className="text-center max-w-md px-6 relative z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/10">
              <Layers className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 inline-flex items-center gap-2 justify-center">Platinum POS System <HelpTip text="Your central dashboard for municipal receipting, payments, and account management. Select a module from the sidebar to begin." side="bottom" icon="info" size="md" /></h2>
            <p className="text-muted-foreground mb-6">
              Select a module from the menu to get started.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
