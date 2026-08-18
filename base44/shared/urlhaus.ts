// === URLhaus malware URL reputation check ===
// Queries the abuse.ch URLhaus API to check if a URL is a known malware distribution site.
// Auth-Key stays on the backend, never exposed to the client.
// Docs: https://urlhaus.abuse.ch/api/

export interface UrlhausReport {
  listed: boolean;              // true = URL is in URLhaus malware database
  url_status?: string;          // "online" | "offline" | ...
  threat?: string;              // e.g. "malware_download"
  tags?: string[];              // e.g. ["emotet", "heodo"]
  date_added?: string;          // when URLhaus first saw it
  payload_count?: number;       // number of malware payloads served by this URL
  blacklists?: Record<string, string>;
}

export async function getUrlhausReport(url: string): Promise<UrlhausReport | null> {
  const apiKey = Deno.env.get("URLHAUS_AUTH_KEY");
  if (!apiKey) return null;

  try {
    const response = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: {
        "Auth-Key": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ url }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();

    if (data.query_status === "ok") {
      return {
        listed: true,
        url_status: data.url_status || "",
        threat: data.threat || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        date_added: data.date_added || "",
        payload_count: Array.isArray(data.payloads) ? data.payloads.length : 0,
        blacklists: data.blacklists || {},
      };
    }

    // query_status === "no_results" — URL is not in the URLhaus database (good sign)
    return { listed: false };
  } catch {
    return null;
  }
}