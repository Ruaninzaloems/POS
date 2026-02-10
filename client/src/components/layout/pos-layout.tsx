import React from 'react';
import { CURRENT_CASHIER } from '@/lib/mock-data';
import { LayoutDashboard, LogOut, Printer, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PosLayoutProps {
  children: React.ReactNode;
}

export function PosLayout({ children }: PosLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b bg-card flex items-center px-4 justify-between shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              M
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Municipal POS <span className="text-muted-foreground text-sm font-normal">v2.0</span></h1>
          </div>
          <div className="h-6 w-px bg-border mx-2" />
          <nav className="flex items-center gap-1">
             <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
               <History className="w-4 h-4" />
               Recent
             </Button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end text-sm leading-tight">
             <span className="font-medium">{CURRENT_CASHIER.name}</span>
             <span className="text-xs text-muted-foreground">{CURRENT_CASHIER.cashOffice}</span>
           </div>
           <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-mono border">
             {CURRENT_CASHIER.id}
           </div>
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
