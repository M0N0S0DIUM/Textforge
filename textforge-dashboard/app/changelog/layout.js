export const metadata = {
  title: 'Changelog - TextForge | Text Transformation API Updates',
  description: 'TextForge changelog and release notes. Track updates to the text transformation API including new features, improvements, and bug fixes for all 28 transformation operations.',
  keywords: 'changelog, release notes, TextForge updates, API changes, text transformation updates',
  openGraph: {
    title: 'Changelog - TextForge',
    description: 'Track updates to TextForge text transformation API. New features, improvements, and updates.',
    url: 'https://textforge.co/changelog',
    siteName: 'TextForge',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog - TextForge',
    description: 'See what\'s new in TextForge text transformation API.',
  },
};

export default function ChangelogLayout({ children }) {
  return children;
}
