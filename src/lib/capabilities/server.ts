import "server-only";
import { ApiError } from "@/lib/api";
import { buildCapabilities } from "./registry";
export const capabilities = () => buildCapabilities(process.env);
export function requireTextPractice() {
  if (!capabilities().englishText.available)
    throw new ApiError(
      503,
      "New practice sessions are temporarily unavailable. Your saved sessions are still accessible.",
    );
}
