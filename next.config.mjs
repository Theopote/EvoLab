/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfjs-dist / pdf-parse use ESM + native APIs that break under webpack bundling
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
  webpack: (config) => {
    // Re-enable disk cache for faster dev navigation; set DISABLE_WEBPACK_CACHE=1 to opt out
    if (process.env.DISABLE_WEBPACK_CACHE === "1") {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
