/** @type {import('next').NextConfig} */
import createNextIntlPlugin from 'next-intl/plugin';
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Enable instrumentation hook for auto-importing accounts on startup
  experimental: {
    instrumentationHook: true,
  },
}

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
