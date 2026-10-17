// Validates that a URL uses an http: or https: scheme before rendering as a
// clickable link. LLM-generated source URLs can contain javascript: or data:
// schemes that would execute in the app's origin on click.
export function isSafeUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return /^https?:\/\//i.test(url);
  }
}