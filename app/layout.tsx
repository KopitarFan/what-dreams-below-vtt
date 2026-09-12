import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'The Veil — Call of Cthulhu VTT',
  description: 'A noir virtual tabletop built for The City That Dreams Below.',
  openGraph: {
    title: 'The Veil — Call of Cthulhu VTT',
    description: 'A virtual tabletop for The City That Dreams Below.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Veil — Call of Cthulhu VTT',
    description: 'A virtual tabletop for The City That Dreams Below.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
