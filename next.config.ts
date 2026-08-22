import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Un package-lock.json nella cartella superiore confonderebbe la root di Turbopack.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
