//@ts-check

const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles a self-contained server + traced node_modules so
  // App Engine can run `node apps/web/server.js` without installing the monorepo.
  // In a monorepo, trace from the repo root so hoisted/workspace deps are included.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
