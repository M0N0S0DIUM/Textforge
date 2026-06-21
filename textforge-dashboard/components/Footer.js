import Link from 'next/link';
import { Zap, Github, Twitter } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white mb-3">
              <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              TextForge
            </Link>
            <p className="text-sm leading-relaxed">
              23 text transformation utilities through a single, simple API endpoint.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="/playground" className="hover:text-white transition-colors">API Playground</Link></li>
              <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/keys" className="hover:text-white transition-colors">API Keys</Link></li>
              <li><Link href="/billing" className="hover:text-white transition-colors">Billing</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@textforge.co" className="hover:text-white transition-colors">Support</a></li>
              <li><a href="mailto:sales@textforge.co" className="hover:text-white transition-colors">Sales</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">© {year} TextForge. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
