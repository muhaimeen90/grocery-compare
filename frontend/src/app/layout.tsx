import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Deals by Sysnolodge — Best grocery prices',
  description: 'Find and compare grocery prices instantly across IGA, Woolworths, Coles, and Aldi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable}`}>
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen bg-[#f8faf7]">
          {children}
        </main>
        <footer className="border-t border-zinc-200 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-zinc-900">Deals by Sysnolodge</p>
                <p className="text-xs text-zinc-400 mt-0.5">Grocery price comparison</p>
              </div>
              <div className="flex items-center gap-6 text-xs text-zinc-500">
                <span>IGA</span>
                <span className="text-zinc-300">·</span>
                <span>Woolworths</span>
                <span className="text-zinc-300">·</span>
                <span>Coles</span>
                <span className="text-zinc-300">·</span>
                <span>Aldi</span>
              </div>
              <p className="text-xs text-zinc-400">© {new Date().getFullYear()} <span className="font-medium text-zinc-500">Sysnolodge</span></p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

