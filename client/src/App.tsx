import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PosProvider } from "@/lib/pos-state";
import NotFound from "@/pages/not-found";
import PosPage from "@/pages/pos";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import PlaceholderPage from "@/pages/placeholder-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PosPage} />
      <Route path="/direct-deposits/manual">
        <PlaceholderPage title="Direct Deposits Manual" description="Manual allocation of direct deposits" />
      </Route>
      <Route path="/direct-deposits/auto">
        <PlaceholderPage title="Direct Deposits Auto" description="Automatic processing of direct deposits" />
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
      <Route path="/view-receipts">
        <PlaceholderPage title="View Receipts" description="Search and view historical receipts" />
      </Route>
      <Route path="/supervisor" component={SupervisorDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PosProvider>
          <Router />
        </PosProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
