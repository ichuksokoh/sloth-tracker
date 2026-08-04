import { getSeriesSlug, extractChapterFromSegments } from "./genericScraper";
import type { ScrapedChapter, ChapterScraperItem } from "@/types";

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

// Composite identity key: a chapter is only "the same chapter" if both its
// number AND its volume (when present) match. Prevents e.g. Vol.9 Ch.4 from
// clobbering a plain Ch.4 that belongs to a different, earlier point in the
// series — sites sometimes switch from global chapter numbering to
// volume-relative numbering partway through, and the two schemes can
// legitimately reuse the same small numbers.
function chapterKey(number: number, volume?: string): string {
  return volume ? `v${volume}:${number}` : `${number}`;
}

// Volume-scoped chapters (numbered relative to their volume) sort after all
// globally-numbered chapters, then by volume, then by number within volume.
// Globally-numbered chapters just sort by number. This matches the common
// case where a series starts with continuous numbering and later switches
// to per-volume numbering; it's a heuristic, not guaranteed for every site.
function sortChapters(chapters: ScrapedChapter[]): ScrapedChapter[] {
  const volOf = (c: ScrapedChapter) => c.label.match(/^Vol\.\s*(\d+(?:\.\d+)?)/i)?.[1];
  return [...chapters].sort((a, b) => {
    const va = volOf(a);
    const vb = volOf(b);
    if (!va && !vb) return a.number - b.number;
    if (!va) return -1;
    if (!vb) return 1;
    const volDiff = parseFloat(va) - parseFloat(vb);
    return volDiff !== 0 ? volDiff : a.number - b.number;
  });
}

// Primary strategy: chapter number lives in the href itself
// (e.g. /series/nano-machine/chapter-244), scoped to this series' slug.
function extractFromHrefs(doc: Document, url: string): ChapterScraperItem {
  const slug = getSeriesSlug(url).toLowerCase();
  if (!slug) return { anchors: [], chapters: [] };
  const anchors = Array.from(doc.querySelectorAll("a[href]")).filter((a) =>
    (a.getAttribute("href") ?? "").toLowerCase().includes(slug)
  );

  const byKey = new Map<string, ScrapedChapter>();
  const anchorsToGetChpContainer = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    const match = extractChapterFromSegments(href);
    if (match === null || match.number > MAX_PLAUSIBLE_CHAPTER) continue;
    const key = chapterKey(match.number, match.volume);
    if (byKey.has(key)) continue; // first occurrence wins
    anchorsToGetChpContainer.push(a);
    byKey.set(key, {
      number: match.number,
      label: formatChapterLabel(match.number, match.volume, match.unit),
      url: resolveUrl(href, url),
      read: false
    });
  }

  return { anchors: anchorsToGetChpContainer, chapters: Array.from(byKey.values()) };
}

// Fallback strategy: chapter number isn't in the URL at all (opaque
// IDs), so read it from the anchor's visible text instead. Requires
// the text to START with "Chapter" to avoid picking up unrelated
// links elsewhere on the page.
function extractFromText(doc: Document, url: string): ChapterScraperItem {
  const pattern = /^(?:vol\.?\s*(\d+)\s*)?(?:(chapter|ch\.?)|(episode|ep\.?))\s*(\d+(?:\.\d+)?)/i;
  const byKey = new Map<string, ScrapedChapter>();
  const anchorsToGetChpContainer = [];

  for (const a of doc.querySelectorAll("a[href]")) {
    const text = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const match = text.match(pattern);
    if (!match) continue;

    const volume = match[1];
    const isEpisode = match[3] !== undefined;
    const number = parseFloat(match[4]);
    if (number > MAX_PLAUSIBLE_CHAPTER) continue;
    const key = chapterKey(number, volume);
    if (byKey.has(key)) continue; // first occurrence wins
    anchorsToGetChpContainer.push(a);
    const href = a.getAttribute("href") ?? "";
    byKey.set(key, {
      number,
      label: formatChapterLabel(number, volume, isEpisode ? "Ep." : "Ch."),
      url: resolveUrl(href, url),
      read: false
    });
  }
  return { anchors: anchorsToGetChpContainer, chapters: Array.from(byKey.values()) };
}

// Runs BOTH strategies and merges by composite (volume, number) key, rather
// than treating them as exclusive alternatives — a single site can mix URL
// conventions across its history, and the visible link text is a reliable
// safety net for whatever hrefs couldn't parse.
export function extractChapters(doc: Document, url: string): ChapterScraperItem {
  const hrefResult = extractFromHrefs(doc, url);
  const textResult = extractFromText(doc, url);

  const volOf = (c: ScrapedChapter) => c.label.match(/^Vol\.\s*(\d+(?:\.\d+)?)/i)?.[1];
  const byKey = new Map<string, ScrapedChapter>();
  const anchors: Element[] = [];

  for (const ch of hrefResult.chapters) byKey.set(chapterKey(ch.number, volOf(ch)), ch);
  for (const a of hrefResult.anchors) anchors.push(a);

  for (let i = 0; i < textResult.chapters.length; i++) {
    const ch = textResult.chapters[i];
    const key = chapterKey(ch.number, volOf(ch));
    if (!byKey.has(key)) {
      byKey.set(key, ch);
      anchors.push(textResult.anchors[i]);
    }
  }

  return { anchors, chapters: sortChapters(Array.from(byKey.values())) };
}