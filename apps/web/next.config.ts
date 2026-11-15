import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow verification builds to run beside a local development server
  // without both processes writing to the same Next.js artifacts.
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  transpilePackages: ['@bbos/ui', '@bbos/shared'],
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      ],
    }];
  },
};

export default nextConfig;
