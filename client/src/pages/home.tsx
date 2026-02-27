import React from 'react';
import { Link, useLocation } from 'wouter';
import { usePos } from '@/lib/pos-state';
import {
  Layers,
  BarChart3,
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
  ChevronDown,
  MessageSquareMore,
  Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { logoutUser } from '@/lib/external-api';

const menuItems = [
  { label: 'POS', href: '/pos', icon: Layers, description: 'Point of sale receipting and payments', helpTip: 'Process payments for consumer accounts, prepaid, clearance, and direct income' },
  { label: 'Billing Dashboard', href: '/billing-dashboard', icon: BarChart3, description: 'Billing statistics and notifications', helpTip: 'View billing notifications, alerts, and system status across all municipal services' },
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
  const { currentUser, activeSession, endSession, viewMode, toggleViewMode, siteInfo } = usePos();
  const isSite02 = siteInfo?.id === 'site02';

  return (
    <div className="flex flex-col h-screen bg-[#F2F4F7] overflow-hidden">
      <header className={`h-14 text-white flex items-center px-3 sm:px-4 justify-between shrink-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${isSite02 ? 'bg-gradient-to-r from-[#1d3347] via-[#243A53] to-[#1d3347]' : 'bg-[linear-gradient(180deg,#8C8C8C_0%,#6F6F6F_100%)]'}`}>
        <div className="flex items-center gap-2.5">
          <img src={siteInfo?.logo || '/images/platinum-logo.png'} alt="Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
          <h1 className="font-semibold text-base sm:text-lg tracking-tight text-white">{isSite02 ? 'Inzalo EMS' : 'SAMRAS Platinum'} <span className="bg-white/20 text-white/80 text-[10px] px-1.5 py-0.5 rounded-full font-normal ml-1">v2.0</span></h1>
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
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[var(--pos-accent)]/30 flex items-center justify-center text-white text-xs font-mono border border-white/30 shrink-0">
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
          <div className="h-6 w-px bg-white/20 hidden sm:block" />
          <HelpTip text="Sign out and return to the login screen" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-red-300 hover:bg-white/10"
              onClick={async () => { await logoutUser(); window.location.reload(); }}
              title="Sign Out"
              data-testid="button-sign-out-home"
            >
              <Power className="w-4 h-4" />
            </Button>
          </HelpTip>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="md:hidden flex-1 overflow-y-auto overscroll-contain p-4 bg-white">
          <h2 className="text-sm font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">Modules</h2>
          <div className="grid grid-cols-2 gap-2.5 pb-4">
            {menuItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <button
                  className="w-full flex flex-col items-center gap-2 p-3.5 rounded-lg text-center hover:bg-[var(--pos-accent-tint)] active:scale-[0.97] transition-all group border border-[#D6D6D6] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] relative overflow-hidden touch-manipulation"
                  data-testid={`menu-item-${item.href.replace(/\//g, '-').slice(1) || 'home'}`}
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--pos-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-11 h-11 rounded-lg bg-[#F7F7F7] flex items-center justify-center shrink-0 group-hover:bg-[var(--pos-accent-tint)] transition-colors">
                    <item.icon className="w-5 h-5 text-[#6B6B6B] group-hover:text-[var(--pos-accent)]" />
                  </div>
                  <div className="text-[11px] font-medium text-[#2E2E2E] leading-tight inline-flex items-center gap-0.5">{item.label} <HelpTip text={item.helpTip} side="bottom" /></div>
                </button>
              </Link>
            ))}
          </div>
        </div>

        <aside className="hidden md:block w-64 border-r border-[#D6D6D6] bg-[#F7F7F7] overflow-y-auto shrink-0" data-testid="sidebar-menu">
          <div className="bg-[var(--pos-accent)] text-white px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Modules</h2>
          </div>
          <nav className="py-1">
            {menuItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--pos-accent-tint-strong)] transition-colors group border-l-3 border-transparent hover:border-[var(--pos-accent)]"
                  data-testid={`menu-item-desktop-${item.href.replace(/\//g, '-').slice(1) || 'home'}`}
                >
                  <item.icon className="w-[18px] h-[18px] text-[#6B6B6B] group-hover:text-[var(--pos-accent)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2E2E2E] inline-flex items-center gap-1">{item.label} <HelpTip text={item.helpTip} side="right" /></div>
                    <div className="text-xs text-[#6B6B6B] truncate">{item.description}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="hidden md:flex flex-1 items-center justify-center bg-white overflow-auto">
          <div className="text-center max-w-md px-6">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <img src={siteInfo?.logo || '/images/platinum-logo.png'} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-semibold text-[#2E2E2E] mb-2 inline-flex items-center gap-2 justify-center">{isSite02 ? 'Inzalo EMS' : 'SAMRAS Platinum'} <HelpTip text="Your central dashboard for municipal receipting, payments, and account management. Select a module from the sidebar to begin." side="bottom" icon="info" size="md" /></h2>
            <p className="text-[#6B6B6B] mb-6">
              Select a module from the menu to get started.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
