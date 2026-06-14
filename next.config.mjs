/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.cache = false; // disable disk cache to prevent stale chunk errors on Windows
    return config;
  },
};

export default nextConfig;
