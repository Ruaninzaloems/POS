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
import DirectDepositsAutoAllocation from "@/pages/direct-deposits/auto/auto-allocation";
import ThirdPartyPaymentProcessing from "@/pages/third-party/payment-processing";


import BillingDashboard from "@/pages/billing-dashboard";
import GeneralEnquiries from "@/pages/enquiries-general";
import ClientCommunications from "@/pages/client-communications";
import BulkAllocationProgress from "@/pages/bulk-allocation-progress";

import Section129Notices from "@/pages/debt/section129-notices";
import Section129TrialReview from "@/pages/debt/section129-trial-review";
import Section129Authorization from "@/pages/debt/section129-authorization";
import HandoverManagement from "@/pages/debt/handover-management";
import HandoverTermination from "@/pages/debt/handover-termination";

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
      
      {/* Direct Deposits Manual Module */}
      <Route path="/direct-deposits/manual" component={UnmatchedQueue} />
      <Route path="/direct-deposits/manual/allocate/:id" component={AllocateTransaction} />
      <Route path="/direct-deposits/manual/history" component={AllocationHistory} />
      
      <Route path="/direct-deposits/auto">
        <DirectDepositsAutoAllocation />
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

      <Route path="/billing-dashboard" component={BillingDashboard} />
      <Route path="/enquiries/general" component={GeneralEnquiries} />
      <Route path="/communications" component={ClientCommunications} />
      <Route path="/enquiries">
        <Redirect to="/enquiries/general" />
      </Route>
      <Route path="/supervisor" component={SupervisorDashboard} />

      {/* Debt Management Module */}
      <Route path="/debt/section129" component={Section129Notices} />
      <Route path="/debt/section129/review/:runId" component={Section129TrialReview} />
      <Route path="/debt/section129/authorize" component={Section129Authorization} />
      <Route path="/debt/handover" component={HandoverManagement} />
      <Route path="/debt/handover/terminate" component={HandoverTermination} />

      <Route component={NotFound} />
    </Switch>
  );
}

function applyThemeClass(themeClass: string) {
  const root = document.documentElement;
  root.classList.remove('theme-site02');
  if (themeClass) {
    root.classList.add(themeClass);
  }
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authKey, setAuthKey] = useState(0);
  const [siteInfo, setSiteInfo] = useState<any>(null);

  useEffect(() => {
    fetch(resolveApiUrl('/api/auth/status'), {
      credentials: "include",
      headers: { ...getAuthHeaders() },
    })
      .then(res => res.json())
      .then(data => {
        setAuthenticated(data.authenticated === true);
        if (data.authenticated && data.site) {
          setSiteInfo(data.site);
          applyThemeClass(data.site.themeClass || '');
        }
        setAuthChecked(true);
      })
      .catch((err) => {
        console.error('[App] Failed to check auth status:', err);
        setAuthenticated(false);
        setAuthChecked(true);
      });
  }, []);

  const [, setLocation] = useLocation();

  const handleLoginSuccess = (_user: any, site?: any) => {
    setAuthenticated(true);
    setAuthKey(prev => prev + 1);
    if (site) {
      setSiteInfo(site);
      applyThemeClass(site.themeClass || '');
    }
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
    applyThemeClass('');
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
          <PosProvider key={authKey} siteInfo={siteInfo}>
            <Router />
          </PosProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
