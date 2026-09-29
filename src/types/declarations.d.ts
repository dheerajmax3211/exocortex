declare module 'next-pwa' {
  import type { NextConfig } from 'next';
  export default function withPWA(pwaConfig?: any): (nextConfig?: NextConfig) => NextConfig;
}
