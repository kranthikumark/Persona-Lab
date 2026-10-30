import { acceptancePreview } from "@/lib/localization/release";
export { StartPracticeSchema } from "@/lib/practice/metadata";

// Implementation and verification are code-reviewed gates. Flags can disable
// shipped features, but cannot turn a roadmap item into a supported capability.
const definitions = {
  englishText: {
    flag: "PERSONA_ENGLISH_TEXT",
    verified: true,
    defaultOn: true,
  },
  hindiText: { flag: "PERSONA_HINDI_TEXT", verified: false, defaultOn: false },
  teluguText: {
    flag: "PERSONA_TELUGU_TEXT",
    verified: false,
    defaultOn: false,
  },
  personalEdition: {
    flag: "PERSONA_PERSONAL_EDITION",
    verified: false,
    defaultOn: false,
  },
  voice: { flag: "PERSONA_VOICE", verified: false, defaultOn: false },
  videoInput: {
    flag: "PERSONA_VIDEO_INPUT",
    verified: false,
    defaultOn: false,
  },
  cameraCoaching: {
    flag: "PERSONA_CAMERA_COACHING",
    verified: false,
    defaultOn: false,
  },
  avatar3d: { flag: "PERSONA_AVATAR_3D", verified: false, defaultOn: false },
} as const;
export type CapabilityId = keyof typeof definitions;
export function buildCapabilities(
  env: Record<string, string | undefined> = {},
) {
  return Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => {
      const value = env[definition.flag];
      const requested =
        value === undefined ? definition.defaultOn : value === "true";
      const preview =
        (id === "hindiText" || id === "teluguText") && acceptancePreview(env);
      const available = preview || (definition.verified && requested);
      return [
        id,
        {
          available,
          reason: preview
            ? "acceptance_only"
            : available
              ? "available"
              : definition.verified
                ? "disabled"
                : "not_verified",
        },
      ];
    }),
  ) as Record<CapabilityId, { available: boolean; reason: string }>;
}
