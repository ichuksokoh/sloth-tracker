import { getSeriesSlug, extractChapterFromSegments } from "./genericScraper";
import type { ScrapedChapter } from "@/types";

const MAX_PLAUSIBLE_CHAPTER = 5000;

function formatChapterLabel(number: number, volume?: string, unit: "Ch." | "Ep." = "Ch."): string {
  return volume ? `Vol. ${volume} ${unit} ${number}` : `${unit} ${number}`;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

// Primary strategy: chapter number lives in the href itself
// (e.g. /series/nano-machine/chapter-244), scoped to this series' slug.
function extractFromHrefs(doc: Document, url: string): ScrapedChapter[] {
  const slug = getSeriesSlug(url).toLowerCase();
  if (!slug) return [];

  const anchors = Array.from(doc.querySelectorAll("a[href]")).filter((a) =>
    (a.getAttribute("href") ?? "").toLowerCase().includes(slug)
  );

  const byNumber = new Map<number, ScrapedChapter>();
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    const match = extractChapterFromSegments(href);
    if (match === null || match.number > MAX_PLAUSIBLE_CHAPTER) continue;
    byNumber.set(match.number, {
      number: match.number,
      label: formatChapterLabel(match.number, undefined, match.unit),
      url: resolveUrl(href, url),
      read: false
    });
  }

  return Array.from(byNumber.values());
}

// Fallback strategy: chapter number isn't in the URL at all (opaque
// IDs), so read it from the anchor's visible text instead. Requires
// the text to START with "Chapter" to avoid picking up unrelated
// links elsewhere on the page.
function extractFromText(doc: Document, url: string): ScrapedChapter[] {
  const pattern = /^(?:vol\.?\s*(\d+)\s*)?(?:(chapter|ch\.?)|(episode|ep\.?))\s*(\d+(?:\.\d+)?)/i;
  const byNumber = new Map<number, ScrapedChapter>();

  for (const a of doc.querySelectorAll("a[href]")) {
    const text = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const match = text.match(pattern);
    if (!match) continue;

    const volume = match[1];
    const isEpisode = match[3] !== undefined;
    const number = parseFloat(match[4]);
    if (number > MAX_PLAUSIBLE_CHAPTER) continue;
    if (byNumber.has(number)) continue; // first occurrence wins

    const href = a.getAttribute("href") ?? "";
    byNumber.set(number, {
      number,
      label: formatChapterLabel(number, volume, isEpisode ? "Ep." : "Ch."),
      url: resolveUrl(href, url),
      read: false
    });
  }

  return Array.from(byNumber.values());
}

export function extractChapters(doc: Document, url: string): ScrapedChapter[] {
  const fromHrefs = extractFromHrefs(doc, url);
  const chapters = fromHrefs.length > 0 ? fromHrefs : extractFromText(doc, url);
  return chapters.sort((a, b) => a.number - b.number);
}
