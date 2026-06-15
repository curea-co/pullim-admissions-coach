/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone output is needed for the ECS Docker image (Phase 0 산출물).
  // Disabled on Windows local dev because symlinks require admin privileges.
  // CI/Docker builds should set NEXT_OUTPUT=standalone.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  transpilePackages: ['@pullim/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
