import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MCP SDK is plain Node code; keep it out of the bundler so it loads like a normal package.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
};

export default nextConfig;
