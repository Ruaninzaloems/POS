import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  LogOut, 
  Printer, 
  History, 
  Search, 
  ShieldCheck, 
  Menu,
  ChevronDown,
  Layers,
  Banknote,
  RefreshCw,
  Users,
  Zap,
  FileBarChart,
  FileSearch,
  Monitor,
  Smartphone,
  Home,
  Calculator,
  BarChart3,
  AlertTriangle,
  MessageSquareMore,
  Power,
  CircleDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Link, useLocation } from "wouter";
import { usePos } from '@/lib/pos-state';
import { logoutUser } from '@/lib/external-api';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface PosLayoutProps {
  children: React.ReactNode;
}

export function PosLayout({ children }: PosLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, activeSession, sessionLoading, endSession, viewMode, toggleViewMode, sessionDetails, dayEndStatus, platinumUser, cashierRegistered, apiSessionActive, clearTransaction } = usePos();

  const isPosPage = location === '/pos';
  const isReceiptingPage = isPosPage || location.startsWith('/view-receipts');

  const prevLocationRef = React.useRef(location);
  useEffect(() => {
      if (prevLocationRef.current === '/pos' && location !== '/pos') {
          clearTransaction();
      }
      prevLocationRef.current = location;
  }, [location, clearTransaction]);

  useEffect(() => {
      if (!activeSession && !sessionLoading && location === '/pos') {
          setLocation('/cashier-setup');
      }
  }, [activeSession, sessionLoading, location, setLocation]);

  if (sessionLoading && isPosPage) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-500/20 border-t-blue-400" />
              <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-[3px] border-transparent border-b-indigo-400" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <p className="text-blue-200/80 text-sm font-medium">Checking session...</p>
          </div>
        </div>
      );
  }

  if (isReceiptingPage && platinumUser?.authMode === 'override') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 max-w-lg w-full p-6 sm:p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Authentication Not Verified</h2>
            <p className="text-blue-200/70 text-sm leading-relaxed">
              This user could not be properly authenticated through the Platinum API. 
              The system was unable to verify the identity via direct login or Azure SSO — 
              a hardcoded override was used instead.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-amber-300">To resolve this, the Platinum administrator needs to:</p>
              <ul className="text-sm text-amber-200/80 list-disc list-inside space-y-1">
                <li>Set up the correct password for the user's direct login, <strong>or</strong></li>
                <li>Configure the Azure SSO mapping to properly resolve this user</li>
              </ul>
            </div>
            <p className="text-xs text-blue-300/50">
              Receipting is disabled until proper authentication is configured.
            </p>
          </div>
        </div>
      );
  }

  if (isReceiptingPage && !platinumUser) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-500/20 border-t-blue-400" />
            </div>
            <p className="text-blue-200/80 text-sm font-medium">Verifying authentication...</p>
          </div>
        </div>
      );
  }

  if (!activeSession && location === '/pos') {
      return null;
  }

  const getPageTitle = (path: string) => {
    if (path === '/pos') return 'POS';
    if (path.startsWith('/direct-deposits/manual')) return 'Direct Deposits Manual';
    if (path.startsWith('/direct-deposits/auto')) return 'Direct Deposits Auto';
    if (path.startsWith('/third-party')) return 'Third Party Payments';
    if (path.startsWith('/utilipay')) return 'Utilipay Distribution';
    if (path.startsWith('/bulk-allocation')) return 'Bulk Allocation Progress';
    if (path.startsWith('/view-receipts')) return 'View Receipts';
    if (path.startsWith('/cashier-day-end')) return 'Day-End Reconciliation';
    if (path.startsWith('/billing-dashboard')) return 'Billing Dashboard';
    if (path.startsWith('/enquiries')) return 'Enquiries';
    if (path.startsWith('/communications')) return 'Client Communications';
    if (path.startsWith('/supervisor')) return 'Supervisor';
    return 'Menu';
  };

  const navItemTooltips: Record<string, string> = {
    'Home': 'Return to the main dashboard',
    'POS': 'Open the point-of-sale receipting screen',
    'Direct Deposits Manual': 'Allocate EFT payments to accounts',
    'Direct Deposits Auto': 'Allocate EFT payments to accounts',
    'Third Party Payments': 'Process third-party payment integrations',
    'Third Party Payment Processing': 'Process third-party payment integrations',
    'Utilipay Distribution Reconciliation Processing': 'Reconcile Utilipay distribution payments',
    'Bulk Allocation Progress': 'Track bulk allocation batch progress',
    'View Receipts': 'Search and reprint receipts',
    'Day-End Reconciliation': 'Submit your end-of-shift reconciliation',
    'Billing Dashboard': 'View billing statistics and reports',
    'Enquiries': 'Look up account details and balances',
    'General Enquiries': 'Look up account details and balances',
    'Client Communications': 'Send messages to account holders',
    'Supervisor': 'Review cashier submissions (supervisor only)',
  };

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'POS', href: '/pos', icon: Layers },
    { label: 'Billing Dashboard', href: '/billing-dashboard', icon: BarChart3 },
    { label: 'Direct Deposits Manual', href: '/direct-deposits/manual', icon: Banknote },
    { label: 'Direct Deposits Auto', href: '/direct-deposits/auto', icon: RefreshCw },
    { 
        label: 'Third Party Payments', 
        icon: Users,
        children: [
            { label: 'Third Party Payment Processing', href: '/third-party/processing', icon: Users },
            { label: 'Utilipay Distribution Reconciliation Processing', href: '/third-party/utilipay-reconciliation', icon: Zap }
        ]
    },
    { label: 'Bulk Allocation Progress', href: '/bulk-allocation', icon: FileBarChart },
    { label: 'View Receipts', href: '/view-receipts', icon: FileSearch },
    { label: 'Day-End Reconciliation', href: '/cashier-day-end', icon: Calculator },
    {
        label: 'Enquiries',
        icon: Search,
        children: [
            { label: 'General Enquiries', href: '/enquiries/general', icon: FileSearch },
        ]
    },
    { label: 'Client Communications', href: '/communications', icon: MessageSquareMore },
    { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck },
  ];

  const sessionDot = apiSessionActive === null ? 'bg-slate-400' : apiSessionActive ? 'bg-emerald-400' : 'bg-red-400';
  const sessionPulse = apiSessionActive === false ? 'animate-pulse' : '';

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="h-11 sm:h-12 bg-gradient-to-r from-slate-900 via-[#1e293b] to-slate-900 text-white flex items-center px-2 sm:px-3 justify-between shrink-0 z-20 relative border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/[0.08] via-transparent to-indigo-600/[0.08]" />
        
        <div className="flex items-center gap-1.5 sm:gap-2 relative z-10">
          <Link href="/">
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/images/platinum-logo.png" alt="Platinum" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs sm:text-sm font-medium text-white/90 hover:bg-white/[0.08] transition-colors" data-testid="button-nav-menu">
                <Menu className="w-3.5 h-3.5 text-white/50" />
                <span className="max-w-[70px] sm:max-w-[130px] truncate">{getPageTitle(location)}</span>
                <ChevronDown className="w-3 h-3 text-white/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-[calc(100vh-60px)] overflow-y-auto">
              <DropdownMenuLabel>Navigation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {navItems.map((item, idx) => (
                item.children ? (
                  <React.Fragment key={idx}>
                    <DropdownMenuLabel className="gap-2 flex items-center text-xs text-muted-foreground font-normal pt-2 pb-1">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {navItemTooltips[item.label] && <HelpTip text={navItemTooltips[item.label]} side="right" />}
                    </DropdownMenuLabel>
                    {item.children.map((child, childIdx) => (
                      <Link key={childIdx} href={child.href}>
                        <DropdownMenuItem className="gap-2 cursor-pointer pl-8">
                          {child.icon && <child.icon className="w-4 h-4 text-muted-foreground" />}
                          <span className="text-sm">{child.label}</span>
                          {navItemTooltips[child.label] && <HelpTip text={navItemTooltips[child.label]} side="right" />}
                        </DropdownMenuItem>
                      </Link>
                    ))}
                  </React.Fragment>
                ) : (
                  <Link key={idx} href={item.href}>
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <span>{item.label}</span>
                      {navItemTooltips[item.label] && <HelpTip text={navItemTooltips[item.label]} side="right" />}
                    </DropdownMenuItem>
                  </Link>
                )
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 relative z-10">
           <HelpTip text="Switch between desktop and mobile-optimized layouts." side="bottom">
             <button 
               className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] rounded-md transition-colors hidden sm:flex" 
               onClick={toggleViewMode} 
               title={viewMode === 'desktop' ? "Switch to Mobile View" : "Switch to Desktop View"}
               data-testid="button-toggle-view"
             >
               {viewMode === 'desktop' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
             </button>
           </HelpTip>

           {activeSession ? (
             <>
               <HelpTip text="Your current cashier session status. An active session is required for receipting." side="bottom">
                 <div
                   className={`flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full transition-all duration-300 ${
                     apiSessionActive === null
                       ? 'bg-white/[0.06] text-white/50'
                       : apiSessionActive === true
                         ? 'bg-emerald-500/15 text-emerald-300'
                         : 'bg-red-500/15 text-red-300 animate-pulse'
                   }`}
                   data-testid="badge-session-status"
                 >
                   <span className={`inline-block w-1.5 h-1.5 rounded-full ${sessionDot} ${sessionPulse}`} />
                   <span className="hidden sm:inline">{apiSessionActive === true ? 'LIVE' : apiSessionActive === false ? 'INACTIVE' : '...'}</span>
                 </div>
               </HelpTip>

               <div className="h-4 w-px bg-white/10 hidden sm:block" />

               <HelpTip text="Logged in as this cashier. Your permissions determine available payment types." side="bottom">
                 <div className="flex items-center gap-1.5">
                   <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-400/30 flex items-center justify-center text-[10px] font-bold text-white/80 border border-white/10 shrink-0">
                     {currentUser.name?.charAt(0) || 'C'}
                   </div>
                   <div className="hidden sm:flex flex-col items-start leading-none">
                     <span className="text-[11px] font-medium text-white/80 truncate max-w-[100px]">{currentUser.name}</span>
                     <span className="text-[9px] text-white/40 truncate max-w-[100px]">{sessionDetails?.officeDesc || currentUser.cashOffice}</span>
                   </div>
                 </div>
               </HelpTip>

               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <button className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] rounded-md transition-colors" data-testid="button-session-menu">
                     <Power className="w-3.5 h-3.5" />
                   </button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-48">
                   <DropdownMenuLabel className="text-xs">Session</DropdownMenuLabel>
                   <DropdownMenuSeparator />
                   {dayEndStatus === 'RECONCILED' ? (
                     <DropdownMenuItem onClick={endSession} className="gap-2 cursor-pointer text-sm">
                       <LogOut className="w-4 h-4" />
                       End Session
                     </DropdownMenuItem>
                   ) : (
                     <DropdownMenuItem disabled className="gap-2 text-sm opacity-50">
                       <LogOut className="w-4 h-4" />
                       End Session (Day-End Required)
                     </DropdownMenuItem>
                   )}
                   <DropdownMenuItem 
                     onClick={async () => { await logoutUser(); window.location.reload(); }} 
                     className="gap-2 cursor-pointer text-sm text-red-600"
                     data-testid="button-sign-out"
                   >
                     <Power className="w-4 h-4" />
                     Sign Out
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             </>
           ) : (
             <div className="flex items-center gap-1">
               <HelpTip text="Begin a new cashier session to start processing receipts." side="bottom">
                 <button 
                   onClick={() => setLocation('/cashier-setup')} 
                   className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-400/20 transition-colors"
                   data-testid="button-start-session"
                 >
                   <Layers className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">Start Session</span>
                   <span className="sm:hidden">Start</span>
                 </button>
               </HelpTip>
               <button
                 className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] rounded-md transition-colors"
                 onClick={async () => { await logoutUser(); window.location.reload(); }}
                 title="Sign out"
                 data-testid="button-sign-out-no-session"
               >
                 <Power className="w-3.5 h-3.5" />
               </button>
             </div>
           )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
