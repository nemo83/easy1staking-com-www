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
      },{
        protocol: 'https',
        hostname: 'cdn.sanity.io',
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
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };
    return config;
  },
};

export default nextConfig;