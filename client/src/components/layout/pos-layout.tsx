import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Settings,
  Monitor,
  Smartphone,
  Home,
  Calculator,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from "wouter";
import { usePos } from '@/lib/pos-state';
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
  const { currentUser, activeSession, sessionLoading, endSession, viewMode, toggleViewMode, sessionDetails, dayEndStatus, platinumUser, cashierRegistered } = usePos();

  const [dbSessionActive, setDbSessionActive] = useState<boolean | null>(null);
  const [dbCheckLoading, setDbCheckLoading] = useState(false);
  const [dbFlash, setDbFlash] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkDbSessionStatus = useCallback(async () => {
    if (!platinumUser?.user_ID) return;
    const userId = platinumUser.user_ID;
    const finYear = platinumUser.finYear || '2025/2026';
    try {
      setDbCheckLoading(true);
      const res = await fetch(`/api/platinum/receipt-prepaid/validate-cashier?userId=${userId}&finYear=${encodeURIComponent(finYear)}`);
      const data = await res.json().catch(() => null);
      const cashierId = data?.cashierId || data?.cashierReconcile_Id || 0;
      const isActive = cashierId > 0;
      console.log(`[SessionBadge] validate-cashier for userId=${userId}: cashierId=${cashierId}, isActive=${isActive}`);
      setDbSessionActive(isActive);
      if (!isActive) {
        setDbFlash(true);
        setTimeout(() => setDbFlash(false), 600);
      }
    } catch (err) {
      console.warn('[SessionBadge] Failed to check session status:', err);
      setDbSessionActive(false);
      setDbFlash(true);
      setTimeout(() => setDbFlash(false), 600);
    } finally {
      setDbCheckLoading(false);
    }
  }, [platinumUser?.user_ID, platinumUser?.finYear]);

  useEffect(() => {
    if (activeSession && platinumUser?.user_ID) {
      checkDbSessionStatus();
      pollTimerRef.current = setInterval(checkDbSessionStatus, 30000);
    } else {
      setDbSessionActive(null);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeSession, platinumUser?.user_ID, checkDbSessionStatus]);

  const isPosPage = location === '/pos';
  const isReceiptingPage = isPosPage || location.startsWith('/view-receipts');

  useEffect(() => {
      if (!activeSession && !sessionLoading && location === '/pos') {
          setLocation('/cashier-setup');
      }
  }, [activeSession, sessionLoading, location, setLocation]);

  if (sessionLoading && isPosPage) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
            <p className="text-slate-600">Checking session status...</p>
          </div>
        </div>
      );
  }

  if (isReceiptingPage && platinumUser?.authMode === 'override') {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-amber-200 max-w-lg w-full p-6 sm:p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Authentication Not Verified</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              This user could not be properly authenticated through the Platinum API. 
              The system was unable to verify the identity via direct login or Azure SSO — 
              a hardcoded override was used instead.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-amber-800">To resolve this, the Platinum administrator needs to:</p>
              <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                <li>Set up the correct password for the user's direct login, <strong>or</strong></li>
                <li>Configure the Azure SSO mapping to properly resolve this user</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              Receipting is disabled until proper authentication is configured. 
              Contact your system administrator for assistance.
            </p>
          </div>
        </div>
      );
  }

  if (isReceiptingPage && !platinumUser) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
            <p className="text-slate-600">Verifying authentication...</p>
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
    if (path.startsWith('/supervisor')) return 'Supervisor';
    return 'Menu';
  };

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'POS', href: '/pos', icon: Layers },
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
    { label: 'Billing Dashboard', href: '/billing-dashboard', icon: BarChart3 },
    { label: 'System Settings', href: '/settings', icon: Settings },
    { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-auto min-h-[3.5rem] border-b bg-card flex flex-wrap items-center px-3 sm:px-4 py-2 justify-between shrink-0 z-20 shadow-sm relative gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <img src="/images/platinum-logo.png" alt="Platinum" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
              <h1 className="font-semibold text-base sm:text-lg tracking-tight hidden sm:inline-block">Platinum POS <span className="text-muted-foreground text-sm font-normal">v2.0</span></h1>
            </div>
          </Link>
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          
          <nav className="flex items-center">
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-1 sm:gap-2 min-w-0 sm:min-w-[140px] justify-between text-xs sm:text-sm px-2 sm:px-3">
                   <span className="flex items-center gap-1 sm:gap-2">
                     <Menu className="w-4 h-4" />
                     <span className="truncate max-w-[80px] sm:max-w-[150px]">{getPageTitle(location)}</span>
                   </span>
                   <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-72">
                 <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 {navItems.map((item, idx) => (
                   item.children ? (
                     <React.Fragment key={idx}>
                       <DropdownMenuLabel className="gap-2 flex items-center text-xs text-muted-foreground font-normal pt-2 pb-1">
                         <item.icon className="w-4 h-4" />
                         <span>{item.label}</span>
                       </DropdownMenuLabel>
                       {item.children.map((child, childIdx) => (
                         <Link key={childIdx} href={child.href}>
                           <DropdownMenuItem className="gap-2 cursor-pointer pl-8">
                             {child.icon && <child.icon className="w-4 h-4 text-muted-foreground" />}
                             <span className="text-sm">{child.label}</span>
                           </DropdownMenuItem>
                         </Link>
                       ))}
                     </React.Fragment>
                   ) : (
                     <Link key={idx} href={item.href}>
                       <DropdownMenuItem className="gap-2 cursor-pointer">
                         <item.icon className="w-4 h-4 text-muted-foreground" />
                         <span>{item.label}</span>
                       </DropdownMenuItem>
                     </Link>
                   )
                 ))}
               </DropdownMenuContent>
             </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
           <Button 
             variant="ghost" 
             size="icon" 
             className="text-muted-foreground hidden sm:inline-flex" 
             onClick={toggleViewMode} 
             title={viewMode === 'desktop' ? "Switch to Mobile View" : "Switch to Desktop View"}
           >
             {viewMode === 'desktop' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
           </Button>

           <div className="h-6 w-px bg-border hidden sm:block" />

           {activeSession ? (
             <>
               <div className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-mono border shrink-0">
                    {currentUser.name?.charAt(0) || 'C'}
                  </div>
                  <div className="hidden sm:flex flex-col items-start text-sm leading-tight">
                    <span className="font-medium">{currentUser.name}</span>
                    <span className="text-xs text-muted-foreground">{sessionDetails?.officeDesc || currentUser.cashOffice}</span>
                  </div>
                  <button
                    onClick={checkDbSessionStatus}
                    disabled={dbCheckLoading}
                    title={dbSessionActive === true ? 'Session is active in POS_Cashier table (click to refresh)' : dbSessionActive === false ? 'Session is NOT active in POS_Cashier table (click to refresh)' : 'Checking session status...'}
                    className={`hidden md:flex items-center gap-1.5 ml-1 px-2.5 py-1 text-[10px] font-semibold rounded-full border whitespace-nowrap cursor-pointer transition-all duration-300 ${
                      dbSessionActive === null
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : dbSessionActive === true
                          ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                          : `border-red-300 text-red-700 hover:bg-red-200 ${dbFlash ? 'bg-red-300 scale-105' : 'bg-red-100 animate-pulse'}`
                    }`}
                    data-testid="badge-session-status"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      dbSessionActive === null ? 'bg-slate-400' : dbSessionActive ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {dbCheckLoading ? 'CHECKING...' : dbSessionActive === true ? 'SESSION ACTIVE' : dbSessionActive === false ? 'SESSION INACTIVE' : 'CHECKING...'}
                  </button>
               </div>

               <div className="h-6 w-px bg-border hidden sm:block" />

               {dayEndStatus === 'RECONCILED' ? (
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={endSession} title="End Session">
                   <LogOut className="w-4 h-4" />
                 </Button>
               ) : (
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-40 cursor-not-allowed" onClick={endSession} title="Session active until day-end reconciliation is completed">
                   <LogOut className="w-4 h-4" />
                 </Button>
               )}
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-8 text-xs text-muted-foreground hover:text-destructive"
                 onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}
                 title="Sign out and switch user"
                 data-testid="button-sign-out"
               >
                 Sign Out
               </Button>
             </>
           ) : (
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={() => setLocation('/cashier-setup')} className="gap-1 sm:gap-2 text-xs sm:text-sm">
                 <Layers className="w-4 h-4" />
                 <span className="hidden sm:inline">Start POS Session</span>
                 <span className="sm:hidden">Start</span>
               </Button>
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-8 text-xs text-muted-foreground hover:text-destructive"
                 onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}
                 title="Sign out and switch user"
                 data-testid="button-sign-out-no-session"
               >
                 Sign Out
               </Button>
             </div>
           )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
