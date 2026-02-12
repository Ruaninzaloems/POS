import { Component, type ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PosProvider } from "@/lib/pos-state";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import PosPage from "@/pages/pos";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import PlaceholderPage from "@/pages/placeholder-page";

import UnmatchedQueue from "@/pages/direct-deposits/manual/unmatched-queue";
import AllocateTransaction from "@/pages/direct-deposits/manual/allocate-transaction";
import AllocationHistory from "@/pages/direct-deposits/manual/allocation-history";
import ViewReceipts from "@/pages/view-receipts";
import ThirdPartyPaymentProcessing from "@/pages/third-party/payment-processing";

import SettingsPage from "@/pages/settings";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("App crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "16px", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ color: "#666" }}>The application encountered an error.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
            data-testid="button-reload"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/pos" component={PosPage} />
      <Route path="/settings" component={SettingsPage} />
      
      {/* Direct Deposits Manual Module */}
      <Route path="/direct-deposits/manual" component={UnmatchedQueue} />
      <Route path="/direct-deposits/manual/allocate/:id" component={AllocateTransaction} />
      <Route path="/direct-deposits/manual/history" component={AllocationHistory} />
      
      <Route path="/direct-deposits/auto">
        <PlaceholderPage title="Direct Deposits Auto" description="Automatic processing of direct deposits" />
      </Route>
      <Route path="/third-party/processing" component={ThirdPartyPaymentProcessing} />
      <Route path="/third-party/utilipay-reconciliation">
        <PlaceholderPage title="Utilipay Distribution Reconciliation" description="Reconciliation of Utilipay distribution records" />
      </Route>
      <Route path="/third-party">
        <PlaceholderPage title="Third Party Payments" description="Integration with third party payment providers" />
      </Route>
      <Route path="/utilipay">
        <PlaceholderPage title="Utilipay Distribution" description="Utility payment distribution management" />
      </Route>
      <Route path="/bulk-allocation">
        <PlaceholderPage title="Bulk Allocation Progress" description="Consolidated view of bulk allocation progress and errors" />
      </Route>
      <Route path="/view-receipts" component={ViewReceipts} />
      <Route path="/supervisor" component={SupervisorDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PosProvider>
            <Router />
          </PosProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
