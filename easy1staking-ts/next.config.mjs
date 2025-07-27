/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vm.adaseal.eu',
        port: '',
        pathname: '/**',
      }, {
        protocol: 'https',
        hostname: 'plsk.tosidrop.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: function (config, options) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;