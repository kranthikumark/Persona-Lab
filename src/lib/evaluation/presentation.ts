export function positiveSummary(id: string, fallback: string) {
  const summaries: Record<string, string> = {
    "claim-boundaries": "You explained that claim approval is conditional.",
    "approved-terms": "You stated a checked fictional policy term.",
    "budget-question": "You asked about Priya's budget.",
    "experience-question": "You explored prior experiences or concerns.",
    acknowledgement: "You acknowledged Priya's concern.",
    "limits-explained": "You explained a checked exclusion or waiting period.",
    "concise-response": "Your responses stayed within the length guideline.",
    "collaborative-language":
      "You used collaborative, permission-based language.",
    "review-offer": "You offered a review or a reasoned pause.",
    "unpressured-choice": "You left the next decision open.",
  };
  return summaries[id] ?? fallback;
}
