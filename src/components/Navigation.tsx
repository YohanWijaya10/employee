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
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                SalesMonitor
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
      <div className="sm:hidden border-t border-gray-200">
        <div className="flex flex-wrap gap-2 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md',
                pathname === item.href || pathname?.startsWith(item.href + '/')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
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
