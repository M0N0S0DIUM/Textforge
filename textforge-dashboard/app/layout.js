import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'TextForge - Smart Text Utility API',
  description: '23 text transformation utilities through a single, simple endpoint. Slugify, camelcase, morse code, and more.',
  keywords: 'text, api, transform, slugify, camelcase, morse code, base64',
  authors: [{ name: 'TextForge' }],
  openGraph: {
    title: 'TextForge - Smart Text Utility API',
    description: '23 text transformation utilities through a single, simple endpoint.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
