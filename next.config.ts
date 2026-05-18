import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — silences the Turbopack warning
  // and stops it from walking the parent ~/ tree looking for a lockfile.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
