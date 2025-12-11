import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard-layout";
import LoginPage from "@/pages/login";
import LicensesPage from "@/pages/licenses";
import LicenseDetailPage from "@/pages/license-detail";
import NewLicensePage from "@/pages/new-license";
import UsersPage from "@/pages/users";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
          <Skeleton className="w-8 h-8 rounded" />
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Redirect to="/licenses" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={LoginPage} />
      </Route>
      <Route path="/licenses/new">
        <ProtectedRoute component={NewLicensePage} />
      </Route>
      <Route path="/licenses/:id">
        <ProtectedRoute component={LicenseDetailPage} />
      </Route>
      <Route path="/licenses">
        <ProtectedRoute component={LicensesPage} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} />
      </Route>
      <Route path="/">
        <Redirect to="/licenses" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
