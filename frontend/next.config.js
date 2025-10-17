/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
