import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["playwright-core"],
  outputFileTracingIncludes: {
    "/api/branches/*/evaluation/export": [
      "./assets/report-fonts/*",
      "./public/fonts/*.ttf",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
        ],
      },
      {
        source: "/sessions/:id",
        headers: [
          { key: "Permissions-Policy", value: "camera=(), microphone=(self)" },
        ],
      },
      {
        source: "/sessions/:id/speech-check",
        headers: [
          { key: "Permissions-Policy", value: "camera=(), microphone=(self)" },
        ],
      },
    ];
  },
};
export default function nextConfig(phase: string): NextConfig {
  return {
    ...config,
    ...(phase === PHASE_DEVELOPMENT_SERVER ||
    process.env.PERSONA_LOW_DISK_BUILD === "1"
      ? {
          // Avoid optional persistent cache writes on this space-constrained host.
          // Normal production builds retain their default cache behavior.
          experimental: {
            ...(phase === PHASE_DEVELOPMENT_SERVER
              ? { turbopackFileSystemCacheForDev: false }
              : {}),
            ...(process.env.PERSONA_LOW_DISK_BUILD === "1"
              ? { turbopackFileSystemCacheForBuild: false }
              : {}),
          },
        }
      : {}),
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER
        ? process.env.PERSONA_PHONE_REVIEW === "1"
          ? ".next-phone"
          : ".next-dev"
        : ".next",
  };
}
