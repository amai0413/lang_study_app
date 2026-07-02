function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return fence?.[1]?.trim() ?? trimmed;
}

function extractJSONObject(text: string): string {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && start < end) return stripped.slice(start, end + 1);
  return stripped;
}

export function parseAIJSON(text: string): Record<string, unknown> {
  const stripped = stripCodeFence(text);

  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed === "string") return parseAIJSON(parsed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to object extraction.
  }

  const objectText = extractJSONObject(stripped);
  const parsed = JSON.parse(objectText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response was not a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
