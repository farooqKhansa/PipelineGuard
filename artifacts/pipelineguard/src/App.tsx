import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Providers } from '@/lib/providers';
import HomePage from '@/app/page';
import AppLayout from '@/app/(app)/layout';
import AuthLayout from '@/app/(auth)/layout';
import OnboardingLayout from '@/app/(onboarding)/layout';
import AgentPage from '@/app/(app)/agent/page';
import AlertsPage from '@/app/(app)/alerts/page';
import AnalyzePage from '@/app/(app)/analyze/page';
import AuditPage from '@/app/(app)/audit/page';
import DemoPage from '@/app/(app)/demo/page';
import FindingDetailPage from '@/app/(app)/findings/[id]/page';
import FindingsPage from '@/app/(app)/findings/page';
import FixDetailPage from '@/app/(app)/fixes/[id]/page';
import FixesPage from '@/app/(app)/fixes/page';
import GraphPage from '@/app/(app)/graph/page';
import HistoryPage from '@/app/(app)/history/page';
import IntegrationsPage from '@/app/(app)/integrations/page';
import LivePage from '@/app/(app)/live/page';
import OverviewPage from '@/app/(app)/overview/page';
import PolicyDetailPage from '@/app/(app)/policies/[id]/page';
import PoliciesPage from '@/app/(app)/policies/page';
import ReasoningDetailPage from '@/app/(app)/reasoning/[id]/page';
import ReasoningPage from '@/app/(app)/reasoning/page';
import ReplayPage from '@/app/(app)/replay/page';
import RepositoryDetailPage from '@/app/(app)/repositories/[id]/page';
import RepositoriesPage from '@/app/(app)/repositories/page';
import ReviewsPage from '@/app/(app)/reviews/page';
import SettingsPage from '@/app/(app)/settings/page';
import TeamPage from '@/app/(app)/team/page';
import TrendsPage from '@/app/(app)/trends/page';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import LoginPage from '@/app/(auth)/login/page';
import SignupPage from '@/app/(auth)/signup/page';
import VerifyEmailPage from '@/app/(auth)/verify-email/page';
import ConnectPage from '@/app/(onboarding)/connect/page';
import SetupPage from '@/app/(onboarding)/setup/page';
import WelcomePage from '@/app/(onboarding)/welcome/page';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/login"><AuthLayout><LoginPage /></AuthLayout></Route>
        <Route path="/signup"><AuthLayout><SignupPage /></AuthLayout></Route>
        <Route path="/forgot-password"><AuthLayout><ForgotPasswordPage /></AuthLayout></Route>
        <Route path="/verify-email"><AuthLayout><VerifyEmailPage /></AuthLayout></Route>
        <Route path="/welcome"><OnboardingLayout><WelcomePage /></OnboardingLayout></Route>
        <Route path="/connect"><OnboardingLayout><ConnectPage /></OnboardingLayout></Route>
        <Route path="/setup"><OnboardingLayout><SetupPage /></OnboardingLayout></Route>
        <Route path="/overview"><AppLayout><OverviewPage /></AppLayout></Route>
        <Route path="/agent"><AppLayout><AgentPage /></AppLayout></Route>
        <Route path="/alerts"><AppLayout><AlertsPage /></AppLayout></Route>
        <Route path="/analyze"><AppLayout><AnalyzePage /></AppLayout></Route>
        <Route path="/audit"><AppLayout><AuditPage /></AppLayout></Route>
        <Route path="/demo"><AppLayout><DemoPage /></AppLayout></Route>
        <Route path="/findings"><AppLayout><FindingsPage /></AppLayout></Route>
        <Route path="/findings/:id"><AppLayout><FindingDetailPage /></AppLayout></Route>
        <Route path="/fixes"><AppLayout><FixesPage /></AppLayout></Route>
        <Route path="/fixes/:id"><AppLayout><FixDetailPage /></AppLayout></Route>
        <Route path="/graph"><AppLayout><GraphPage /></AppLayout></Route>
        <Route path="/history"><AppLayout><HistoryPage /></AppLayout></Route>
        <Route path="/integrations"><AppLayout><IntegrationsPage /></AppLayout></Route>
        <Route path="/live"><AppLayout><LivePage /></AppLayout></Route>
        <Route path="/policies"><AppLayout><PoliciesPage /></AppLayout></Route>
        <Route path="/policies/:id"><AppLayout><PolicyDetailPage /></AppLayout></Route>
        <Route path="/reasoning"><AppLayout><ReasoningPage /></AppLayout></Route>
        <Route path="/reasoning/:id"><AppLayout><ReasoningDetailPage /></AppLayout></Route>
        <Route path="/replay"><AppLayout><ReplayPage /></AppLayout></Route>
        <Route path="/repositories"><AppLayout><RepositoriesPage /></AppLayout></Route>
        <Route path="/repositories/:id"><AppLayout><RepositoryDetailPage /></AppLayout></Route>
        <Route path="/reviews"><AppLayout><ReviewsPage /></AppLayout></Route>
        <Route path="/settings"><AppLayout><SettingsPage /></AppLayout></Route>
        <Route path="/team"><AppLayout><TeamPage /></AppLayout></Route>
        <Route path="/trends"><AppLayout><TrendsPage /></AppLayout></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Providers>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </Providers>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
