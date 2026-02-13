import React from 'react';
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
  Home
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

import CashierSetup from '@/pages/cashier-setup';

interface PosLayoutProps {
  children: React.ReactNode;
}

export function PosLayout({ children }: PosLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, activeSession, sessionLoading, endSession, viewMode, toggleViewMode, sessionDetails, dayEndStatus } = usePos();

  const isPosPage = location === '/pos';

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

  if (!activeSession && isPosPage) {
      return <CashierSetup />;
  }

  const getPageTitle = (path: string) => {
    if (path === '/pos') return 'POS';
    if (path.startsWith('/direct-deposits/manual')) return 'Direct Deposits Manual';
    if (path.startsWith('/direct-deposits/auto')) return 'Direct Deposits Auto';
    if (path.startsWith('/third-party')) return 'Third Party Payments';
    if (path.startsWith('/utilipay')) return 'Utilipay Distribution';
    if (path.startsWith('/bulk-allocation')) return 'Bulk Allocation Progress';
    if (path.startsWith('/view-receipts')) return 'View Receipts';
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
    { label: 'System Settings', href: '/settings', icon: Settings },
    { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 justify-between shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <img src="/images/platinum-logo.png" alt="Platinum" className="w-8 h-8 object-contain" />
              <h1 className="font-semibold text-lg tracking-tight hidden sm:inline-block">Platinum POS <span className="text-muted-foreground text-sm font-normal">v2.0</span></h1>
            </div>
          </Link>
          <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
          
          <nav className="flex items-center">
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-2 min-w-[140px] justify-between">
                   <span className="flex items-center gap-2">
                     <Menu className="w-4 h-4" />
                     <span className="truncate max-w-[150px]">{getPageTitle(location)}</span>
                   </span>
                   <ChevronDown className="w-4 h-4 opacity-50" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-72">
                 <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 {navItems.map((item, idx) => (
                   item.children ? (
                     <DropdownMenuSub key={idx}>
                       <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                         <item.icon className="w-4 h-4 text-muted-foreground" />
                         <span>{item.label}</span>
                       </DropdownMenuSubTrigger>
                       <DropdownMenuPortal>
                         <DropdownMenuSubContent className="w-72">
                           {item.children.map((child, childIdx) => (
                             <Link key={childIdx} href={child.href}>
                               <DropdownMenuItem className="gap-2 cursor-pointer">
                                 {child.icon && <child.icon className="w-4 h-4 text-muted-foreground" />}
                                 <span>{child.label}</span>
                               </DropdownMenuItem>
                             </Link>
                           ))}
                         </DropdownMenuSubContent>
                       </DropdownMenuPortal>
                     </DropdownMenuSub>
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

        <div className="flex items-center gap-4">
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
               <div className="flex items-center gap-3 px-2">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-mono border">
                    {currentUser.name?.charAt(0) || 'C'}
                  </div>
                  <div className="flex flex-col items-start text-sm leading-tight">
                    <span className="font-medium">{currentUser.name}</span>
                    <span className="text-xs text-muted-foreground">{sessionDetails?.officeDesc || currentUser.cashOffice}</span>
                  </div>
                  <div className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full border border-green-200">
                    SESSION ACTIVE
                  </div>
               </div>

               <div className="h-6 w-px bg-border" />

               {dayEndStatus === 'RECONCILED' ? (
                 <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={endSession} title="End Session">
                   <LogOut className="w-4 h-4" />
                 </Button>
               ) : (
                 <Button variant="ghost" size="icon" className="text-muted-foreground opacity-40 cursor-not-allowed" onClick={endSession} title="Session active until day-end reconciliation is completed">
                   <LogOut className="w-4 h-4" />
                 </Button>
               )}
             </>
           ) : (
             <Button variant="outline" size="sm" onClick={() => setLocation('/pos')} className="gap-2">
               <Layers className="w-4 h-4" />
               Start POS Session
             </Button>
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
