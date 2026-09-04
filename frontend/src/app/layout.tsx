import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'PipelineGuard',
  description:
    'An AI agent that reads your CI/CD pipeline configuration, reasons about risk from history and dependencies, and fixes what it can prove is safe to fix.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Set the theme before first paint so a dark-mode user never sees a
          // white flash on load. Mirrors the default in providers.tsx.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pg.theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
