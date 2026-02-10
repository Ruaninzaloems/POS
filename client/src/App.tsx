import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PosProvider } from "@/lib/pos-state";
import NotFound from "@/pages/not-found";
import PosPage from "@/pages/pos";
import SupervisorDashboard from "@/pages/supervisor-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PosPage} />
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
