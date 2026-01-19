'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sales-reps', label: 'Sales Reps' },
  { href: '/outlets', label: 'Outlets' },
  { href: '/orders', label: 'Orders' },
  { href: '/reports/anti-fraud', label: 'Anti-Fraud Report' },
  { href: '/guide', label: 'Guide' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-text">
                SalesMonitor
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'nav-link',
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                      ? 'nav-link-active'
                      : undefined
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      <div className="sm:hidden border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap gap-2 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'nav-link',
                pathname === item.href || pathname?.startsWith(item.href + '/')
                  ? 'nav-link-active'
                  : undefined
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
