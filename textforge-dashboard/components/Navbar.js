'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-primary-600">
            TextForge
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">Docs</Link>
            <Link href="/faq" className="text-sm text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/changelog" className="text-sm text-gray-600 hover:text-gray-900">Changelog</Link>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/keys" className="text-sm text-gray-600 hover:text-gray-900">API Keys</Link>
            <Link href="/billing" className="btn-primary text-sm">Billing</Link>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/docs" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
            <Link href="/faq" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
            <Link href="/changelog" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>Changelog</Link>
            <Link href="/dashboard" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
            <Link href="/keys" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>API Keys</Link>
            <Link href="/billing" className="block py-2 text-sm" onClick={() => setMobileMenuOpen(false)}>Billing</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
