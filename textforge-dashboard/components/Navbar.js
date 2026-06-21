'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Zap, User, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('tf_token');
    const stored = localStorage.getItem('tf_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setUser(null);
    window.location.href = '/';
  };

  const navLinks = [
    { href: '/docs', label: 'Docs' },
    { href: '/playground', label: 'Playground' },
    { href: '/#pricing', label: 'Pricing' },
  ];

  const isActive = (href) => pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            TextForge
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  isActive(href) ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Auth section */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="max-w-32 truncate">{user.name || user.email}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/keys"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      API Keys
                    </Link>
                    <Link
                      href="/billing"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Billing
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Settings
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary text-sm py-2 px-4">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-2">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-sm font-medium text-gray-700"
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-gray-100 pt-2 mt-2">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-700">
                  Dashboard
                </Link>
                <Link href="/settings" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-700">
                  Settings
                </Link>
                <button onClick={handleLogout} className="block py-2 text-sm text-red-600 w-full text-left">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-700">
                  Sign in
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-primary-600">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
