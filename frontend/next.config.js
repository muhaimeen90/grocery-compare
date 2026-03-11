/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ['72.62.70.246'],
  images: {
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn1.woolworths.media',
      },
      {
        protocol: 'https',
        hostname: '**.coles.com.au',
      },
      {
        protocol: 'https',
        hostname: '**.iga.com.au',
      },
      {
        protocol: 'https',
        hostname: 'www.igashop.com.au',
      },
      {
        protocol: 'https',
        hostname: 'cdn.metcash.media',
      },
      {
        protocol: 'https',
        hostname: '**.aldi.com.au',
      },
      {
        protocol: 'https',
        hostname: 'www.aldi.com.au',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://72.62.70.246:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
