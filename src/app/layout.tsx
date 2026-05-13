import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import { PortfolioProvider } from '@/lib/portfolio/store';

export const metadata: Metadata = {
  title: 'JARVIS.Finance - Intelligent Market Analyst',
  description: 'AI-powered market intelligence platform that aggregates data from Reddit, X/Twitter, and financial news to provide actionable stock signals.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased bg-jarvis-black text-jarvis-gray-100 min-h-screen">
        <I18nProvider>
          <PortfolioProvider>
            {children}
            <script dangerouslySetInnerHTML={{ __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
              }
            `}} />
          </PortfolioProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
