import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useMatch } from 'react-router';
import {
  CalendarIcon,
  ChartIcon,
  LearnIcon,
  ProfileIcon,
  PuzzleIcon,
  SettingsIcon,
  StreakPill,
  XpPill,
} from '../components/ui';
import { APP_NAME } from '../config';
import { streakNow } from '../engine/motivation';
import { useProgress } from '../storage/progress';

const navItems: { to: string; label: string; end: boolean; icon: ReactNode }[] = [
  { to: '/', label: 'Today', end: true, icon: <CalendarIcon /> },
  { to: '/subjects', label: 'Learn', end: false, icon: <LearnIcon /> },
  { to: '/practice', label: 'Practice', end: false, icon: <ChartIcon /> },
  { to: '/puzzles', label: 'Puzzles', end: false, icon: <PuzzleIcon /> },
  { to: '/profile', label: 'Profile', end: false, icon: <ProfileIcon /> },
];

function Logo() {
  return (
    <Link to="/" className="flex min-h-[44px] items-center gap-2 text-h3 text-ink no-underline">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-9 w-9">
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="9"
          fill="var(--primary)"
          stroke="var(--outline)"
          strokeWidth="2"
        />
        <path
          d="M8 22h5v-5h5v-5h5V8"
          fill="none"
          stroke="var(--volt)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-extrabold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

function Pills() {
  const progress = useProgress((s) => s.progress);
  const s = streakNow(progress);
  return (
    <div className="flex items-center gap-2">
      <StreakPill days={s.days} charges={s.charges} />
      <XpPill xp={progress.xp.total} />
    </div>
  );
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}
    >
      Skip to content
    </a>
  );
}

/**
 * App shell (§10.2): a top bar on desktop and a floating bottom bar with five tabs on phones.
 * Lesson screens are full-screen with their own header (leave, progress battery, XP).
 */
export function Layout() {
  const inLesson = useMatch('/l/:lessonId');
  if (inLesson)
    return (
      <div className="min-h-screen bg-ground">
        <SkipLink />
        <main id="main" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
      </div>
    );
  return (
    <div className="flex min-h-screen flex-col bg-ground">
      <SkipLink />
      <header>
        <div className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-x-6 gap-y-3 px-[18px] pt-5 pb-2 md:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex flex-wrap gap-1">
              {navItems.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `flex min-h-[44px] items-center gap-2 rounded-full px-4 font-extrabold no-underline ${
                        isActive
                          ? 'border-2 border-outline bg-primary text-on-primary'
                          : 'text-ink-2 hover:text-ink'
                      }`
                    }
                  >
                    {n.icon}
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Pills />
            <NavLink
              to="/settings"
              aria-label="Settings"
              className="press press-s1 hidden h-12 w-12 items-center justify-center rounded-md bg-surface text-ink md:inline-flex"
            >
              <SettingsIcon />
            </NavLink>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-28 outline-none md:pb-0">
        <Outlet />
      </main>
      <footer className="hidden py-6 text-center text-small text-ink-2 md:block">
        {APP_NAME} keeps your progress only in this browser. Export it from your profile to keep a copy.
      </footer>
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-3 z-30 rounded-xl border-2 border-outline bg-surface p-1.5 md:hidden"
      >
        <ul className="flex justify-between">
          {navItems.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg text-[12px] font-bold no-underline ${
                    isActive ? 'bg-primary text-on-primary' : 'text-ink-2'
                  }`
                }
              >
                {n.icon}
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
