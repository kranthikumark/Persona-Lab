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
  id: string;
  createdAt: string;
  branches: { id: string; name: string; revision: number }[];
};
export type SessionView = {
  id: string;
  createdAt: string;
  provider: "mock" | "meta";
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
