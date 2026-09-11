import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'STYMA · quanto vale, prima di comprare',
  description:
    'Fotografa un oggetto trovato al mercatino e scopri cos’e’, quanto vale e se conviene comprarlo.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* `pb-24` su telefono: la barra in basso e' fissa, e senza spazio
          coprirebbe l'ultima riga di ogni pagina. */}
      <body className="min-h-full flex flex-col pb-24 sm:pb-0">
        <Header />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
