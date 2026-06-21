import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} TextForge. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/docs" className="hover:text-gray-900">
              Docs
            </Link>
            <Link href="/billing" className="hover:text-gray-900">
              Pricing
            </Link>
            <a href="mailto:support@textforge.co" className="hover:text-gray-900">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
