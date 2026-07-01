/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfjs-dist / pdf-parse use ESM + native APIs that break under webpack bundling
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
  webpack: (config) => {
    config.cache = false; // disable disk cache to prevent stale chunk errors on Windows
    return config;
  },
};

export default nextConfig;
