import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOKMA | Mahalleni Keşfet",
  description: "Yerel esnaf ve müşterileri bir araya getiren dijital pazar yeri. Kasap, market, çiçekçi, restoran ve daha fazlası tek platformda.",
  keywords: "yemek siparişi, yerel esnaf, taze ürünler, kurye, restoran kayıt, lokma, lokma uygulamsı, lokma shop, ciftciden",
  openGraph: {
    title: "LOKMA | Mahalleni Keşfet",
    description: "Yerel esnaf ve müşterileri bir araya getiren dijital pazar yeri.",
    url: "https://lokma.shop",
    siteName: "LOKMA",
    images: [
      {
        url: "https://lokma.shop/lokma_logo_wide.png",
        width: 1200,
        height: 630,
        alt: "LOKMA Logo",
      },
    ],
    locale: "tr_TR",
    type: "website",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/lokma_logo.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

import Script from 'next/script';
import { Toaster } from 'react-hot-toast';

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
            <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
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
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
