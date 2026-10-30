import { describe, expect, it } from "vitest";
import {
  acceptedValidation,
  countWords,
  responseLength,
} from "@/lib/response-length";
import { evaluate, validateEvidence } from "@/lib/evaluation/rubric";
import { reportDocument } from "@/lib/reports/data";

describe("versioned lexical whitespace counting", () => {
  it.each([
    ["", 0],
    ["  \n\t", 0],
    ["... 🙂 — !!!", 0],
    ["Hello", 1],
    ["don't 30-day ₹1,250 24/month", 4],
    ["hello\nworld\tagain\u00a0today", 4],
    ["नमस्ते आपका बजट क्या है?", 5],
    ["నమస్తే మీ బడ్జెట్ ఎంత?", 4],
    ["English हिंदी తెలుగు ₹1250 🙂", 4],
    ["hello—world", 1],
    ["a\u200db", 1],
  ])("counts %j as %i", (text, count) => expect(countWords(text)).toBe(count));
  it("accepts 1/70, rejects 0/71, and keeps the independent character safety bound", () => {
    expect(responseLength("word").error).toBeNull();
    expect(responseLength(Array(70).fill("word").join(" ")).error).toBeNull();
    expect(responseLength("...").error).toMatch(/at least one word/);
    expect(responseLength(Array(71).fill("word").join(" ")).error).toMatch(
      /Remove 1/,
    );
    expect(responseLength("x".repeat(2001)).error).toMatch(/2000 characters/);
    expect(acceptedValidation("hello")).toMatchObject({
      wordCount: 1,
      locale: "en-IN",
      inputModality: "text",
      status: "passed",
      countingVersion: "lexical-whitespace-v1",
      constraintVersion: "response-70-v1",
    });
  });
});
function history(content: string, metadata?: unknown) {
  return {
    messages: [
      { id: "m1", turn: 1, sequence: 1, role: "user", content, metadata },
    ],
    events: [{ id: "e1", turn: 1, payload: { messageId: "m1" } }],
  };
}
const scope = { branchId: "branch", revision: 1, forkTurn: null };
describe("quality rubric v3", () => {
  it("keeps five weights and nine checks without awarding length points", () => {
    const report = evaluate(history("Hello"), scope);
    expect(report.totalChecks).toBe(9);
    expect(report.overall).toBe(0);
    expect(report.assessedChecks).toBe(0);
    expect(report.categories.map((c) => c.weight)).toEqual([
      30, 20, 20, 15, 15,
    ]);
    expect(
      report.categories
        .flatMap((c) => c.checks)
        .some((c) => c.id === "concise-response"),
    ).toBe(false);
  });
  it("has identical quality for the same evidence on either side of 70 words", () => {
    const base = "Could we review this together?";
    const short = evaluate(history(base), scope);
    const long = evaluate(history(base + " word".repeat(71)), scope);
    expect(long.categories.map((c) => c.score)).toEqual(
      short.categories.map((c) => c.score),
    );
    expect(short.overall).toBe(long.overall);
    expect(short.categories.find((c) => c.id === "communication")!.score).toBe(
      100,
    );
  });
  it("reports length separately with historical status and rejects tampered length evidence", () => {
    const data = history("Hello", { validation: acceptedValidation("Hello") });
    const report = evaluate(data, scope);
    if (!("length" in report)) throw new Error("Missing length report");
    expect(report.length[0]).toMatchObject({ wordCount: 1, status: "passed" });
    const historical = evaluate(history("word ".repeat(71)), scope);
    if (!("length" in historical)) throw new Error("Missing length report");
    expect(historical.length[0]).toMatchObject({
      wordCount: 71,
      status: "accepted_before_rule",
    });
    const exported = reportDocument(
      report,
      "Original",
      "2026-10-28",
      data.messages,
    );
    expect(exported.totalChecks).toBe(9);
    expect(exported.length).toEqual([
      { turn: 1, wordCount: 1, status: "passed" },
    ]);
    report.length[0].wordCount++;
    expect(() => validateEvidence(report, data, scope)).toThrow();
  });
});
