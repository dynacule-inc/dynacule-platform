/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // In this version of Next.js 14, this key lives inside experimental
    serverExternalPackages: ['ngl'],
  },

  transpilePackages: ['ngl'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('ngl');
      } else {
        config.externals['ngl'] = 'commonjs ngl';
      }
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;