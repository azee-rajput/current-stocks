import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PSX history file is read with fs at runtime, so ship it with every server route.
  outputFileTracingIncludes: { "/**": ["./data/**"] },
};

export default nextConfig;
