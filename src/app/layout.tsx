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
      <body className="antialiased bg-jarvis-black text-jarvis-gray-100 min-h-screen">
        <I18nProvider>
          <PortfolioProvider>
            {children}
          </PortfolioProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
