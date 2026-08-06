import { getSeriesSlug, extractChapterFromSegments, getSpacedText } from "./genericScraper";
import type { ScrapedChapter, ChapterScraperItem, ChapterUnit, DraftChapter } from "@/types";

const MAX_PLAUSIBLE_CHAPTER = 5000;

// Extremely lightweight draft that only carries what we need to dedupe
// and construct the final object.

function formatChapterLabel(number: number, volume?: string, unit: ChapterUnit = "Ch."): string {
  return volume ? `Vol. ${volume} ${unit} ${number}` : `${unit} ${number}`;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

const TEXT_PATTERN = /^(?:vol\.?\s*(\d+)\s*)?(?:(chapter|ch\.?)|(episode|ep\.?))\s*(\d+(?:\.\d+)?)/i;

// Centralized deduplication logic.
// You mentioned wanting the option to use both label and URL — this combines them safely.
export function chapterDedupeKey(label: string, url: string): string {
  return `${label}|${url}`;
}

export function extractChaptersUnsorted(
  doc: Document,
  url: string
): { anchors: Element[]; drafts: DraftChapter[] } {
  const slug = getSeriesSlug(url).toLowerCase();
  const byKey = new Map<string, DraftChapter>();
  const anchors: Element[] = [];
  const resolvedViaHref = new Set<Element>();

  // STRATEGY 1: Href-based extraction (Fastest & most reliable)
  if (slug) {
    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") ?? "";
      if (!href.toLowerCase().includes(slug)) continue;

      const match = extractChapterFromSegments(href);
      if (match === null || match.number > MAX_PLAUSIBLE_CHAPTER) continue;

      resolvedViaHref.add(a);
      const label = formatChapterLabel(match.number, match.volume, match.unit);
      const draft: DraftChapter = { label, url: resolveUrl(href, url) };
      const key = chapterDedupeKey(draft.label, draft.url);

      if (byKey.has(key)) continue;

      anchors.push(a);
      byKey.set(key, draft);
    }
  }

  // STRATEGY 2: Opaque URL Fallback (Text-based extraction)
  // When we have a usable slug, still require the href to reference this
  // series before trusting a text match. Without this, "Latest Releases" /
  // "Recommended" widgets elsewhere on the page — which also render
  // "Chapter N" text for completely unrelated series — get scraped as if
  // they belonged to the current one. Only skip this check when there's no
  // slug at all (opaque numeric/hash IDs, e.g. FlameComics), since then we
  // have no way to verify the href belongs to this series anyway.
  for (const a of doc.querySelectorAll("a[href]")) {
    if (resolvedViaHref.has(a)) continue;

    const href = a.getAttribute("href") ?? "";
    if (slug && !href.toLowerCase().includes(slug)) continue;

    const text = getSpacedText(a).replace(/\s+/g, " ").trim();
    const match = text.match(TEXT_PATTERN);
    if (!match) continue;

    const volume = match[1];
    const unit: ChapterUnit = match[3] !== undefined ? "Ep." : "Ch.";
    const rawNumber = parseFloat(match[4]);

    if (rawNumber > MAX_PLAUSIBLE_CHAPTER) continue;

    const label = formatChapterLabel(rawNumber, volume, unit);
    const draft: DraftChapter = { label, url: resolveUrl(href, url) };
    const key = chapterDedupeKey(draft.label, draft.url);

    if (byKey.has(key)) continue;

    anchors.push(a);
    byKey.set(key, draft);
  }

  return { anchors, drafts: Array.from(byKey.values()) };
}

// Helper to extract a mathematical weight from the label for sorting
// (e.g., "Vol. 2 Ch. 15" -> 200015, "Ch. 132" -> 132)
function getChapterWeight(label: string): number {
  const match = label.match(/(?:Vol\.?\s*(\d+)\s*)?(?:Ch\.|Ep\.)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return 0;

  const volume = parseFloat(match[1] || "0");
  const chapter = parseFloat(match[2] || "0");

  // Multiplying the volume by a massive number ensures that Vol. 2 Ch. 1
  // always gets sorted AFTER Vol. 1 Ch. 100.
  return volume * 100000 + chapter;
}

// Sorts the chapters chronologically based on their label before assigning
// the final 1..N structural index.
export function finalizeChapters(drafts: DraftChapter[]): ScrapedChapter[] {
  const sortedDrafts = [...drafts].sort((a, b) => {
    return getChapterWeight(a.label) - getChapterWeight(b.label);
  });

  return sortedDrafts.map((d, i) => ({
    number: i + 1, // So that 1/N is not 0 if i == 0
    label: d.label,
    url: d.url,
    read: false
  }));
}
export function extractChapters(doc: Document, url: string): ChapterScraperItem {
  const { anchors, drafts } = extractChaptersUnsorted(doc, url);
  return { anchors, chapters: finalizeChapters(drafts) };
}
