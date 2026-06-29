export const metadata = {
  title: 'TextForge - Text Transformation API',
  description: '28 text transformation utilities through a single, simple endpoint. Slugify, camelcase, morse code, and more.',
  openGraph: {
    title: 'TextForge - Text Transformation API',
    description: '28 text transformation utilities through a single, simple endpoint. Build powerful text processing pipelines.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
