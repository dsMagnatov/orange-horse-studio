import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Horse Study',
  description: 'An interactive ASCII horse rendered with WebGL.',
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
