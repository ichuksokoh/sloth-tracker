import { scrapeGeneric, getSeriesSlug } from "./genericScraper";
import { extractChapters } from "./chapterScraper";
import { scrapeInfiniteScrollChapters } from "./infiniteScrollChpScraper";
import { adapters } from "./adapters";
import type { ScrapedManhwa } from "@/types";

// Use for initial scraping of the current page (gather info)
// Used to confirm page is a series page, and to get basic info (title, cover, etc.) without scrolling
export function scrapeCurrentPage(): ScrapedManhwa {
  const url = window.location.href;
  const hostname = window.location.hostname.replace(/^www\./, "");

  const base = scrapeGeneric(document, url);
  const anchors_chps = extractChapters(document, url);
  const totalChapters = Math.max(...anchors_chps.chapters.map((c) => c.number), 0) || null;
  const adapterKey = Object.keys(adapters).find((key) => hostname.includes(key));
  const override = adapterKey ? adapters[adapterKey](document, url) : {};

  return { ...base, chapters: anchors_chps.chapters, totalChapters, ...override };
}

// Use for scraping the current page and following any lazy-load scrolling to get all chapters
// Default used after confirming page is a series (lazy loading only occurs on heuristic otherwise uses scraping with no scrolling)
export async function scrapeCurrentPageFull(): Promise<ScrapedManhwa> {
  const url = window.location.href;
  const hostname = window.location.hostname.replace(/^www\./, "");
  const scrolled_anchor_chps = await scrapeInfiniteScrollChapters(document, url);
  const base = scrapeGeneric(document, url);
  const totalChapters = Math.max(...scrolled_anchor_chps.chapters.map((c) => c.number), 0) || null;
  const adapterKey = Object.keys(adapters).find((key) => hostname.includes(key));
  const override = adapterKey ? adapters[adapterKey](document, url) : {};

  return { ...base, chapters: scrolled_anchor_chps.chapters, totalChapters, ...override };
}

// Finds the index of the segment that represents "this specific chapter" —
// e.g. "chapter-244", or Mangago's "nml_chapter-162.2" (chapter marker
// embedded inside a prefixed segment). Also handles the split form where
// "chapter" is its own segment immediately followed by a numeric one
// (Asura's /chapter/321).
function findChapterSegmentIndex(segments: string[]): number {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (/chapter[-_]?\d/i.test(seg)) return i;
    if (/^chapter$/i.test(seg) && segments[i + 1] && /^\d+(\.\d+)?$/.test(segments[i + 1])) {
      return i;
    }
  }
  return -1;
}

function getChapterSeriesKey(chapterUrl: string): string {
  try {
    const path = new URL(chapterUrl).pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return path;

    const chapterIdx = findChapterSegmentIndex(segments);
    if (chapterIdx > 0) {
      // everything before the chapter marker is the series identity —
      // this also naturally drops any trailing segments after it (like
      // Mangago's "pg-1"), since we only keep what comes BEFORE
      return segments.slice(0, chapterIdx).join("/");
    }

    if (segments.length > 1) {
      // no recognizable chapter marker found — fall back to dropping
      // just the last segment (handles opaque-ID sites like Flame)
      return segments.slice(0, -1).join("/");
    }

    // single flat segment (e.g. "disastrous-necromancer-chapter-1")
    const onlySegment = segments[0];
    const stripped = onlySegment.replace(/-?chapter-?\d+(\.\d+)?.*$/i, "");
    return stripped || onlySegment;
  } catch {
    return "";
  }
}

// True only if the large majority of scraped chapters point back to the same series
function chaptersBelongToOneSeries(chapters: { url: string }[], pageUrl: string, minRatio = 0.8): boolean {
  if (chapters.length === 0) return false;

  const slug = getSeriesSlug(pageUrl).toLowerCase();
  if (!slug) {
    // no usable slug (e.g. Flame's opaque numeric series ID) —
    // fall back to the old segment-based key comparison
    const keys = chapters.map((c) => getChapterSeriesKey(c.url));
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    const maxCount = Math.max(...counts.values());
    return maxCount / keys.length >= minRatio;
  }

  const matching = chapters.filter((c) => c.url.toLowerCase().includes(slug)).length;
  return matching / chapters.length >= minRatio;
}

// Matches a URL that's clearly a chapter/reading page, as opposed to a
// series landing page — checked as a whole path segment, so it won't
// false-positive on words that merely contain "ch" or "c" as a substring.
function isChapterUrl(url: string): boolean {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return false;
  }
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // combined form: chapter-4, chapter_4, ch-4, ch4, c-01, c021
    if (/^(chapter|chap|ch|c)[-_]?\d+(\.\d+)?[a-z]?$/i.test(seg)) return true;

    // split form: "chapter" as its own segment, followed by a numeric one
    if (/^(chapter|chap)$/i.test(seg) && segments[i + 1] && /^\d+(\.\d+)?$/.test(segments[i + 1])) {
      return true;
    }
  }

  return false;
}

export function looksLikeSeriesPage(): boolean {
  // Might want to add check in future if url contains "chapter", "Ch", "C", etc.
  // Could enforce that page is in fact a series page & not a chapter page
  try {
    const result = scrapeCurrentPage();
    if (!result.coverUrl || !result.title || result.chapters.length < 3) return false;
    if (!chaptersBelongToOneSeries(result.chapters, result.sourceUrl)) return false;
    if (isChapterUrl(result.sourceUrl)) return false;
    return true;
  } catch {
    return false;
  }
}
