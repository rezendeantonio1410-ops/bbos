import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bbos/ui', '@bbos/shared'],
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
