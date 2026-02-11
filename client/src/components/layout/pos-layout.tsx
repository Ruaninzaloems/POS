import React from 'react';
import { CURRENT_CASHIER } from '@/lib/mock-data';
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
  Refreshcw,
  Users,
  Zap,
  FileBarChart,
  FileSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from "wouter";
import { usePos } from '@/lib/pos-state';
import { CASHIERS } from '@/lib/mock-data';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface PosLayoutProps {
  children: React.ReactNode;
}

export function PosLayout({ children }: PosLayoutProps) {
  const [location, setLocation] = useLocation();
  const { currentUser, switchUser } = usePos();

  const getPageTitle = (path: string) => {
    if (path === '/') return 'POS Receipting';
    if (path === '/unified') return 'POS Unified';
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
    { label: 'POS Receipting', href: '/', icon: LayoutDashboard },
    { label: 'POS Unified', href: '/unified', icon: Layers },
    { label: 'Direct Deposits Manual', href: '/direct-deposits/manual', icon: Banknote },
    { label: 'Direct Deposits Auto', href: '/direct-deposits/auto', icon: Refreshcw },
    { label: 'Third Party Payments', href: '/third-party', icon: Users },
    { label: 'Utilipay Distribution', href: '/utilipay', icon: Zap },
    { label: 'Bulk Allocation Progress', href: '/bulk-allocation', icon: FileBarChart },
    { label: 'View Receipts', href: '/view-receipts', icon: FileSearch },
    { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 justify-between shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              M
            </div>
            <h1 className="font-semibold text-lg tracking-tight hidden sm:inline-block">Municipal POS <span className="text-muted-foreground text-sm font-normal">v2.0</span></h1>
          </div>
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
               <DropdownMenuContent align="start" className="w-64">
                 <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 {navItems.map((item) => (
                   <Link key={item.href} href={item.href}>
                     <DropdownMenuItem className="gap-2 cursor-pointer">
                       <item.icon className="w-4 h-4 text-muted-foreground" />
                       <span>{item.label}</span>
                     </DropdownMenuItem>
                   </Link>
                 ))}
               </DropdownMenuContent>
             </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-4">
           {/* User Switcher for Prototype */}
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-1 pr-3 flex items-center gap-3 hover:bg-muted rounded-full border border-transparent hover:border-border">
                   <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-mono border">
                     {currentUser.id.split('-')[1]}
                   </div>
                   <div className="flex flex-col items-start text-sm leading-tight mr-1">
                     <span className="font-medium">{currentUser.name}</span>
                     <span className="text-xs text-muted-foreground">{currentUser.cashOffice}</span>
                   </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch User (Prototype)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CASHIERS.map(cashier => (
                  <DropdownMenuItem 
                    key={cashier.id} 
                    onClick={() => switchUser(cashier.id)}
                    className="flex flex-col items-start gap-1 cursor-pointer"
                  >
                    <span className="font-medium">{cashier.name}</span>
                    <span className="text-xs text-muted-foreground">{cashier.cashOffice}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
           </DropdownMenu>

           <div className="h-6 w-px bg-border" />

           <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
             <LogOut className="w-4 h-4" />
           </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
