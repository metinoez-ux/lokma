import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOKMA | Mahalleni Keşfet",
  description: "Yerel esnaf ve müşterileri bir araya getiren dijital pazar yeri. Kasap, market, çiçekçi ve daha fazlası tek platformda.",
  icons: {
    icon: '/lokma_logo.png',
    shortcut: '/lokma_logo.png',
    apple: '/lokma_logo.png',
  },
};

import Script from 'next/script';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
      >
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151'
            }
          }}
        />
        {children}
      </body>
    </html>
  );
}
