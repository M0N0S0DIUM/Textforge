export const metadata = {
  title: 'API Documentation - TextForge | 28 Text Transformations',
  description: 'Complete API documentation for TextForge text transformation API. Learn how to use all 28 transformation operations including slugify, camelcase, base64, morse code, and more.',
  keywords: 'API documentation, text transformation API, slugify, camelcase, base64, morse code, TextForge',
  openGraph: {
    title: 'API Documentation - TextForge',
    description: 'Complete API documentation for all 28 text transformation operations. Code examples in cURL, Python, and JavaScript.',
    url: 'https://textforge.co/docs',
    siteName: 'TextForge',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'API Documentation - TextForge',
    description: 'Learn to use all 28 text transformation operations with code examples.',
  },
};

export default function DocsLayout({ children }) {
  return children;
}
