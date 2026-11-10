/**
 * PubliPulse Web — mature responsive shell (v2 architecture).
 * 10 working areas, role-adaptive UI, offline-aware.
 * Legacy monolithic App preserved as App.legacy.tsx.
 * See docs/RESPONSIVE-UX-ARCHITECTURE.md
 */
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { NewActionModal } from './components/layout/Modals';
import { SignalIntakeWizard } from './components/signals/SignalIntakeWizard';
import { DashboardView } from './areas/DashboardView';
import { SignalsView } from './areas/SignalsView';
import { ActionGapsView } from './areas/ActionGapsView';
import { ResponseActionsView } from './areas/ResponseActionsView';
import { InvestigationsView } from './areas/InvestigationsView';
import { OutcomesView } from './areas/OutcomesView';
import { CommunityIntakeView } from './areas/CommunityIntakeView';
import { CostsView } from './areas/CostsView';
import { StockView } from './areas/StockView';
import { ContextView } from './areas/ContextView';
import { WeeklyReviewView } from './areas/WeeklyReviewView';
import { IntelligenceView } from './areas/IntelligenceView';
import { InteroperabilityView } from './areas/InteroperabilityView';
import { SettingsView } from './areas/SettingsView';
import { WorkspaceProvider } from './context/WorkspaceContext';

function AreaRouter() {
  const { activeTab } = useApp();
  switch (activeTab) {
    case 'dashboard': return <DashboardView />;
    case 'signals': return <SignalsView />;
    case 'gaps': return <ActionGapsView />;
    case 'investigations': return <InvestigationsView />;
    case 'actions': return <ResponseActionsView />;
    case 'outcomes': return <OutcomesView />;
    case 'intake': return <CommunityIntakeView />;
    case 'costs': return <CostsView />;
    case 'stock': return <StockView />;
    case 'context': return <ContextView />;
    case 'weekly': return <WeeklyReviewView />;
    case 'intelligence': return <IntelligenceView />;
    case 'interop': return <InteroperabilityView />;
    case 'settings': return <SettingsView />;
    default: return <DashboardView />;
  }
}

export function App() {
  return (
    <AppProvider>
      <WorkspaceProvider>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AppShell><AreaRouter /></AppShell>
        <SignalIntakeWizard />
        <NewActionModal />
      </WorkspaceProvider>
    </AppProvider>
  );
}

export default App;
