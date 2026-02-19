import { Component, type ReactNode, useState, useEffect } from "react";
import { resolveApiUrl, getAuthHeaders } from "@/lib/pos-config-context";
import { Switch, Route, Redirect, useLocation } from "wouter";
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
import LoginPage from "@/pages/login";
import CashierSetupPage from "@/pages/cashier-setup";

import UnmatchedQueue from "@/pages/direct-deposits/manual/unmatched-queue";
import AllocateTransaction from "@/pages/direct-deposits/manual/allocate-transaction";
import AllocationHistory from "@/pages/direct-deposits/manual/allocation-history";
import ViewReceipts from "@/pages/view-receipts";
import ThirdPartyPaymentProcessing from "@/pages/third-party/payment-processing";

import SettingsPage from "@/pages/settings";
import CashierDayEnd from "@/pages/cashier-day-end";
import BillingDashboard from "@/pages/billing-dashboard";
import GeneralEnquiries from "@/pages/enquiries-general";
import ClientCommunications from "@/pages/client-communications";
import BulkAllocationProgress from "@/pages/bulk-allocation-progress";

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
      <Route path="/cashier-setup" component={CashierSetupPage} />
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
      <Route path="/bulk-allocation" component={BulkAllocationProgress} />
      <Route path="/view-receipts" component={ViewReceipts} />
      <Route path="/cashier-day-end" component={CashierDayEnd} />
      <Route path="/billing-dashboard" component={BillingDashboard} />
      <Route path="/enquiries/general" component={GeneralEnquiries} />
      <Route path="/communications" component={ClientCommunications} />
      <Route path="/enquiries">
        <Redirect to="/enquiries/general" />
      </Route>
      <Route path="/supervisor" component={SupervisorDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authKey, setAuthKey] = useState(0);

  useEffect(() => {
    fetch(resolveApiUrl('/api/auth/status'), {
      credentials: "include",
      headers: { ...getAuthHeaders() },
    })
      .then(res => res.json())
      .then(data => {
        setAuthenticated(data.authenticated === true);
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthenticated(false);
        setAuthChecked(true);
      });
  }, []);

  const [, setLocation] = useLocation();

  const handleLoginSuccess = (_user: any) => {
    setAuthenticated(true);
    setAuthKey(prev => prev + 1);
    setLocation('/');
  };

  if (!authChecked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#666" }}>Checking authentication...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PosProvider key={authKey}>
            <Router />
          </PosProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
