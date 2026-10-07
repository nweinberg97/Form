/** Extracts an 11-character YouTube video id from any common URL form, or a bare id. */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return valid(url.pathname.slice(1));
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return valid(url.searchParams.get("v"));
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (match) return valid(match[1]);
    }
  } catch {
    return null;
  }
  return null;
}

const valid = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null);

/** Privacy-enhanced embed: no cookies until the viewer presses play. */
export function youTubeEmbedUrl(id: string, opts: { start?: number } = {}) {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1", cc_load_policy: "1" });
  if (opts.start) params.set("start", String(opts.start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export const youTubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
