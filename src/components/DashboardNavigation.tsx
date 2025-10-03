'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DashboardNavigation() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/',
      name: 'Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      description: 'General overview and comparison'
    },
    {
      href: '/daily',
      name: 'Daily',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Hourly breakdown (0-24h)'
    },
    {
      href: '/weekly',
      name: 'Weekly',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      description: 'Daily breakdown (Mon-Sun)'
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto">
        <div className="relative">
          {/* Scroll container */}
          <div className="overflow-x-auto scrollbar-hide">
            <nav className="flex px-4 md:px-4" aria-label="Tabs">
              {navItems.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors flex-shrink-0 ${
                      index < navItems.length - 1 ? 'mr-4 md:mr-8' : ''
                    }`}
                  >
                    {item.icon}
                    <div className="text-left">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs opacity-75 hidden sm:block">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Scroll indicators */}
          <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none md:hidden"></div>
          <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden"></div>
        </div>
      </div>
    </div>
  );
}
