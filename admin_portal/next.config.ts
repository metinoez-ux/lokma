import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { execSync } from "child_process";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // @ts-expect-error eslint is sometimes omitted in strict NextConfig typing
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // AI menu multi-image uploads
    },
  },
  env: {
    // Inject at build time for server-side use
    FIREBASE_SERVICE_ACCOUNT_KEY: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    NEXT_PUBLIC_BUILD_TIME: (() => {
      try {
        // Son git commit tarih/saatini al (Europe/Berlin)
        const raw = execSync('git log -1 --format=%cd --date=format:"%d.%m.%Y %H:%M"', { cwd: __dirname }).toString().trim();
        return raw;
      } catch {
        // Git yoksa server baslama saatini goster
        return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
      }
    })(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default withNextIntl(nextConfig);

// Force new Firebase Cloud Run revision hash to bypass 409 conflict
// Timestamp: 2026-04-11T21:19:19Z
