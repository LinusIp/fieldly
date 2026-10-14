import { NavLink, Outlet, Link } from 'react-router';
import { APP_NAME } from '../config';

const navItems = [
  { to: '/', label: 'Subjects', end: true },
  { to: '/review', label: 'Review', end: false },
  { to: '/profile', label: 'Profile', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-text no-underline"
          >
            <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7">
              <rect width="32" height="32" rx="7" fill="var(--c-accent)" />
              <path
                d="M8 23h5v-5h5v-5h5V8"
                fill="none"
                stroke="var(--c-on-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-lg">{APP_NAME}</span>
          </Link>
          <nav aria-label="Main" className="ml-auto">
            <ul className="flex flex-wrap gap-1 text-sm">
              {navItems.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-1.5 font-medium no-underline transition-colors ${
                        isActive
                          ? 'bg-accent-soft text-accent'
                          : 'text-muted hover:bg-surface-2 hover:text-text'
                      }`
                    }
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted">
        {APP_NAME} — progress is stored only in this browser. Export it from your profile to keep a copy.
      </footer>
    </div>
  );
}
