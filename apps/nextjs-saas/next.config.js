/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Source maps exposed by default in Next.js (Vercel default)
  // TC-P1.5-001: tools probe /_next/static/chunks/*.js.map
  productionBrowserSourceMaps: true,
};
module.exports = nextConfig;
