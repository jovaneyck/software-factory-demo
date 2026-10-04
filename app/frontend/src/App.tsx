import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { CalendarDays, Dog, Target, TrendingUp } from 'lucide-react';
import logo from './assets/logo.png';
import { cn, LoadingState } from './ui';
import DogList from './DogList';
import DogForm from './DogForm';
import DogProfile from './DogProfile';
import TrainingList from './TrainingList';
import PlanList from './PlanList';
import PlanForm from './PlanForm';
import PlanDetail from './PlanDetail';
import PlanEdit from './PlanEdit';
import Progress from './Progress';

// Split out routes that pull in heavy deps: markdown (training pages) and d3 (progress report).
const TrainingForm = lazy(() => import('./TrainingForm'));
const TrainingDetail = lazy(() => import('./TrainingDetail'));
const TrainingEdit = lazy(() => import('./TrainingEdit'));
const ProgressReport = lazy(() => import('./ProgressReport'));
const DesignSystem = lazy(() => import('./DesignSystem'));

const TABS = [
  { to: '/', label: 'Dogs', prefix: '/', Icon: Dog },
  { to: '/trainings', label: 'Trainings', prefix: '/trainings', Icon: Target },
  { to: '/plans', label: 'Plans', prefix: '/plans', Icon: CalendarDays },
  { to: '/progress', label: 'Progress', prefix: '/progress', Icon: TrendingUp },
];

// Bottom tab bar on mobile, inline pill tabs in the header from `md` up.
function NavBar() {
  const { pathname } = useLocation();

  const isActive = (prefix: string) => {
    if (prefix === '/') return pathname === '/' || pathname.startsWith('/dogs');
    return pathname.startsWith(prefix);
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:static md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-md md:max-w-none md:gap-1">
        {TABS.map(({ to, label, prefix, Icon }) => {
          const active = isActive(prefix);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
                'md:h-9 md:flex-none md:flex-row md:gap-2 md:rounded-xl md:px-3.5 md:py-0 md:text-sm',
                active
                  ? 'text-brand-600 md:bg-surface md:text-ink md:shadow-card'
                  : 'text-ink-subtle hover:text-ink',
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn('size-6 md:size-4', active && 'md:text-brand-600')}
                strokeWidth={active ? 2.25 : 1.75}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Shell() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div
          aria-hidden="true"
          className="absolute inset-0 border-b border-line/70 bg-canvas/80 backdrop-blur-xl"
        />
        <div className="relative mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-xl">
            <img
              src={logo}
              alt="DogTrainr logo"
              className="size-9 rounded-full shadow-card ring-2 ring-surface"
            />
            <span className="text-lg font-bold tracking-tight text-ink">DogTrainr</span>
          </Link>
          <NavBar />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8 md:pb-16">
        <div key={pathname} className="animate-rise-in">
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/" element={<DogList />} />
              <Route path="/dogs/new" element={<DogForm />} />
              <Route path="/dogs/:id" element={<DogProfile />} />
              <Route path="/dogs/:id/progress" element={<Progress />} />
              <Route path="/trainings" element={<TrainingList />} />
              <Route path="/trainings/new" element={<TrainingForm />} />
              <Route path="/trainings/:id" element={<TrainingDetail />} />
              <Route path="/trainings/:id/edit" element={<TrainingEdit />} />
              <Route path="/plans" element={<PlanList />} />
              <Route path="/plans/new" element={<PlanForm />} />
              <Route path="/plans/:id" element={<PlanDetail />} />
              <Route path="/plans/:id/edit" element={<PlanEdit />} />
              <Route path="/progress" element={<ProgressReport />} />
              <Route path="/design-system" element={<DesignSystem />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

export default App;
