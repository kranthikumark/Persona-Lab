export function requestKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues is also available for a local HTTP phone-review origin.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function api<T>(
  url: string,
  data?: unknown,
  method?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: method ?? (data ? "POST" : "GET"),
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Connection interrupted. Reload your saved history before retrying.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The studio returned an unreadable response. Reload your saved history before retrying.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "The studio could not complete this request. Please try again.",
    );
  return result as T;
}
export type SessionSummary = {
  title?: string;
  id: string;
  createdAt: string;
  branches: { id: string; name: string; revision: number }[];
};
export type SessionView = {
  id: string;
  createdAt: string;
  provider: "mock" | "meta";
  legacyRules?: boolean;
  presentation?: import("./localization/content").LocalePresentation;
  settings?: import("./practice/metadata").PracticeSettings;
  catalog?: import("zod").infer<
    typeof import("./practice/metadata").CatalogSchema
  >;
  branch: {
    id: string;
    name: string;
    revision: number;
    parentBranchId: string | null;
  };
  branches: SessionView["branch"][];
  messages: {
    id: string;
    role: string;
    content: string;
    turn: number;
    sequence: number;
    inherited: boolean;
    source?: import("./practice/metadata").MessageSource;
    sourceInferred?: boolean;
    length: ReturnType<typeof import("./response-length").lengthRecord> | null;
  }[];
  snapshots: {
    id: string;
    state: import("./simulation/domain").SimulationState;
    turnNumber: number;
  }[];
  state: import("./simulation/domain").SimulationState;
  events: { id: string; type: string; turn: number; payload: unknown }[];
  findings: {
    messageId: string;
    turn: number;
    title: string;
    detail: string;
    source: string;
  }[];
};
