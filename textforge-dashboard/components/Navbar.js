import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-primary-600">
            TextForge
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">
              Docs
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/keys" className="text-sm text-gray-600 hover:text-gray-900">
              API Keys
            </Link>
            <Link href="/billing" className="btn-primary text-sm">
              Billing
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
