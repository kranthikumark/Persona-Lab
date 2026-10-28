import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/branches/*/evaluation/export": ["./assets/report-fonts/*"],
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
    ];
  },
};
export default function nextConfig(phase: string): NextConfig {
  return {
    ...config,
    distDir:
      phase === PHASE_DEVELOPMENT_SERVER
        ? process.env.PERSONA_PHONE_REVIEW === "1"
          ? ".next-phone"
          : ".next-dev"
        : ".next",
  };
}
