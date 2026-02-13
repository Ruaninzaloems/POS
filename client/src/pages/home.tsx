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
  Settings,
  ShieldCheck,
  LogOut,
  Monitor,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const menuItems = [
  { label: 'POS Verified', href: '/pos', icon: Layers, description: 'Point of sale receipting and payments' },
  { label: 'Direct Deposits Manual', href: '/direct-deposits/manual', icon: Banknote, description: 'Manual allocation of direct deposits' },
  { label: 'Direct Deposits Auto', href: '/direct-deposits/auto', icon: RefreshCw, description: 'Automatic processing of direct deposits' },
  { label: 'Third Party Payment Processing', href: '/third-party/processing', icon: Users, description: 'Process third party payments' },
  { label: 'Utilipay Distribution Reconciliation', href: '/third-party/utilipay-reconciliation', icon: Zap, description: 'Reconcile Utilipay distribution records' },
  { label: 'Bulk Allocation Progress', href: '/bulk-allocation', icon: FileBarChart, description: 'View bulk allocation progress and errors' },
  { label: 'View Receipts', href: '/view-receipts', icon: FileSearch, description: 'Search and view transaction receipts' },
  { label: 'System Settings', href: '/settings', icon: Settings, description: 'Configure system preferences' },
  { label: 'Supervisor', href: '/supervisor', icon: ShieldCheck, description: 'Supervisor dashboard and approvals' },
];

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { currentUser, activeSession, endSession, viewMode, toggleViewMode } = usePos();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="h-14 border-b bg-card flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            M
          </div>
          <h1 className="font-semibold text-lg tracking-tight hidden sm:inline-block">Municipal POS <span className="text-muted-foreground text-sm font-normal">v2.0</span></h1>
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

          {activeSession && (
            <>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-3 px-2">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-mono border">
                  {currentUser.name?.charAt(0) || 'C'}
                </div>
                <div className="flex flex-col items-start text-sm leading-tight">
                  <span className="font-medium">{currentUser.name}</span>
                  <span className="text-xs text-muted-foreground">{currentUser.cashOffice}</span>
                </div>
              </div>
              <div className="h-6 w-px bg-border" />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={endSession} title="End Session">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r bg-card overflow-y-auto shrink-0" data-testid="sidebar-menu">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Modules</h2>
          </div>
          <nav className="py-2">
            {menuItems.map((item, idx) => (
              <Link key={idx} href={item.href}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors group"
                  data-testid={`menu-item-${item.href.replace(/\//g, '-').slice(1) || 'home'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                    <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex items-center justify-center bg-muted/30 overflow-auto">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Layers className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Municipal POS System</h2>
            <p className="text-muted-foreground mb-6">
              Select a module from the menu on the left to get started.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
