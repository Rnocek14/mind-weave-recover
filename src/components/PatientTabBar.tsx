/**
 * PatientTabBar — Shared bottom navigation for patient pages
 * Used on /today, /practice, and /progress
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Gamepad2, BarChart3, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'home', icon: Home, label: 'Home', path: '/today' },
  { id: 'practice', icon: Gamepad2, label: 'Practice', path: '/practice' },
  { id: 'progress', icon: BarChart3, label: 'My Progress', path: '/progress' },
] as const;

export function PatientTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname === '/practice' ? 'practice'
    : location.pathname === '/progress' ? 'progress'
    : 'home';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom z-40">
      <div className="flex justify-around max-w-lg mx-auto">
        {TABS.map(({ id, icon: Icon, label, path }) => (
          <button
            key={id}
            onClick={() => navigate(path)}
            className={cn(
              'flex-1 flex flex-col items-center py-3 min-h-[60px] transition-all duration-150 touch-manipulation select-none relative',
              'active:scale-95 active:bg-accent/30',
              currentTab === id
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {currentTab === id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-primary rounded-b-full transition-all" />
            )}
            <Icon className={cn(
              'transition-all duration-150',
              currentTab === id ? 'w-7 h-7' : 'w-6 h-6'
            )} />
            <span className={cn(
              'font-medium mt-1 transition-all duration-150',
              currentTab === id ? 'text-sm' : 'text-xs'
            )}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
