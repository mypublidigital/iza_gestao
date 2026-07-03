import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fixa a raiz do workspace neste diretório (há outro lockfile no diretório pai).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
