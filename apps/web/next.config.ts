import type { NextConfig } from 'next';

function apiBaseUrl() {
  const fallback = 'http://localhost:3001/api';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') url.pathname = '/api';
    else if (!pathname.endsWith('/api')) url.pathname = `${pathname}/api`;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@bbos/ui', '@bbos/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiBaseUrl()}/:path*` }];
  },
};

export default nextConfig;
