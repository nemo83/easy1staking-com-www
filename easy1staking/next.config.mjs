import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin file-tracing to this app dir; silences the multi-lockfile root warning
  // caused by stray lockfiles in parent directories.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vm.adaseal.eu",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plsk.tosidrop.io",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
