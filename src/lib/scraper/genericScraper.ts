import type { ScrapedManhwa, ChapterUnit, ChapterMatch } from "@/types";
import { extractTitleRobust } from "./titleScraper";

const MAX_PLAUSIBLE_CHAPTER = 5000; // generous — real series rarely get near this

export function getMeta(doc: Document, property: string): string | null {
  const el = doc.querySelector(`meta[property="${property}"]`) ?? doc.querySelector(`meta[name="${property}"]`);
  return el?.getAttribute("content")?.trim() || null;
}

export function getSeriesSlug(input: string | string[]): string {
  const skip = new Set([
    "series",
    "manga",
    "manhwa",
    "comic",
    "read",
    "title",
    "chapter",
    "list",
    "browse",
    "mr",
    "pg"
  ]);

  const isSkippable = (s: string) =>
    s
      .toLowerCase()
      .split("-")
      .every((tok) => skip.has(tok));

  // Helper to parse a single URL for opaque IDs or standard segments
  const parseSingleUrl = (url: string): { opaqueId?: string; candidates: string[] } => {
    try {
      const path = new URL(url).pathname;
      const segments = path.split("/").filter(Boolean);

      // Opaque ID / Numeric ID Detection (e.g., FlameComics /series/153/)
      const keywordIndices = ["series", "manga", "comic", "title"];
      for (let i = 0; i < segments.length - 1; i++) {
        if (keywordIndices.includes(segments[i].toLowerCase())) {
          const nextSeg = segments[i + 1];
          // Matches pure numbers or hex-like hashes (e.g., b0cd61db4a0587af)
          if (/^\d+$/.test(nextSeg) || /^[a-f0-9]{8,}$/i.test(nextSeg)) {
            return { opaqueId: nextSeg, candidates: [] };
          }
        }
      }

      // Standard non-skippable segment extraction
      const candidates = segments.filter((s) => !isSkippable(s) && !/^\d+$/.test(s));
      return { candidates };
    } catch {
      return { candidates: [] };
    }
  };

  // CASE 1: Array of URLs provided -> Frequency Voting Algorithm
  if (Array.isArray(input)) {
    if (input.length === 0) return "";

    const segmentCounts = new Map<string, number>();
    let totalProcessed = 0;

    for (const url of input) {
      const { opaqueId, candidates } = parseSingleUrl(url);

      if (opaqueId) {
        segmentCounts.set(opaqueId, (segmentCounts.get(opaqueId) || 0) + 2);
        totalProcessed++;
        continue;
      }

      const uniqueSegmentsInUrl = new Set(candidates);
      for (const seg of uniqueSegmentsInUrl) {
        segmentCounts.set(seg, (segmentCounts.get(seg) || 0) + 1);
      }
      if (candidates.length > 0) totalProcessed++;
    }

    if (totalProcessed === 0) return "";

    let bestSlug = "";
    let highestScore = -1;

    for (const [seg, count] of segmentCounts.entries()) {
      const frequencyRatio = count / totalProcessed;
      const score = frequencyRatio * 100 + seg.length * 0.1;

      if (score > highestScore) {
        highestScore = score;
        bestSlug = seg;
      }
    }

    return bestSlug;
  }

  // CASE 2: Single URL string provided -> Fallback behavior
  else if (typeof input === "string") {
    const { opaqueId, candidates } = parseSingleUrl(input);
    if (opaqueId) return opaqueId;
    if (candidates.length === 0) return "";

    return candidates.reduce((a, b) => (b.length > a.length ? b : a));
  }

  return "";
}

export function getSpacedText(el: Element): string {
  let text = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      text += ` ${getSpacedText(node as Element)} `;
    }
  });
  return text;
}
// Matches a chapter/episode number when it appears as its own token within
// a path segment, either at the very start or immediately after a "-"/"_"
// separator, e.g. "chapter-244", ".../chapter/244", "episode-19",
// "ep-528-white-ghost-9", or Mangago's prefixed forms like
// "nml_chapter-386" and "mk_v-41-chapter-379".
// Rejects numbers embedded inside longer combined segments where the
// keyword isn't immediately followed by the number (e.g. "chapterhouse-244").
export function extractChapterFromSegments(href: string): ChapterMatch | null {
  let path: string;
  try {
    path = new URL(href, location.origin).pathname;
  } catch {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  let highest: ChapterMatch | null = null;

  const consider = (num: number, unit: ChapterUnit, volume?: string) => {
    if (highest === null || num > highest.number) highest = { number: num, unit, volume };
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Optional "v-N-" / "vol-N-" volume marker directly preceding the chapter
    // keyword, e.g. "m_v-9-chapter-4" or "mk_v-41-chapter-380".
    const exact = seg.match(
      /(?:^|[-_])(?:v(?:ol)?[-_]?(\d+(?:\.\d+)?)[-_])?(chapter|ch|episode|ep)[-_]?(\d+(?:[\.\-]\d+)?)(?:[-_].*)?$/i
    );
    if (exact) {
      const unit: ChapterUnit = /^ep/i.test(exact[2]) ? "Ep." : "Ch.";
      const num = parseFloat(exact[3].replace("-", "."));
      consider(num, unit, exact[1]);
      continue;
    }
    if (/^(chapter|episode)$/i.test(seg) && segments[i + 1] && /^\d+(\.\d+)?$/.test(segments[i + 1])) {
      const unit: ChapterUnit = /^episode$/i.test(seg) ? "Ep." : "Ch.";
      const num = parseFloat(segments[i + 1]);
      consider(num, unit);
    }
  }

  return highest;
}

function extractDescription(doc: Document, title: string): string | null {
  const idealDescription = doc.querySelector('div > [itemprop="description"]')?.textContent?.trim();
  if (idealDescription) return idealDescription;

  const raw = getMeta(doc, "og:description");
  if (!raw) return null;

  const colonIdx = raw.indexOf(":");
  if (colonIdx > -1 && colonIdx < 80) {
    const prefix = raw.slice(0, colonIdx).toLowerCase();
    const firstTitleWord = title.toLowerCase().split(" ")[0];
    if (firstTitleWord && prefix.includes(firstTitleWord)) {
      return raw.slice(colonIdx + 1).trim();
    }
  }

  return raw.trim();
}

function extractImage(doc: Document): string | null {
  const box = doc.querySelector('div > [itemprop="image"]');
  if (box) {
    const img = box.cloneNode(true) as HTMLElement;
    const actualImg = img?.querySelector("img");
    return actualImg?.getAttribute("src") || null;
  }

  const image = getMeta(doc, "og:image");
  if (image) return image;

  const title = extractTitleRobust(doc, doc.URL).toLowerCase();
  const titleWords = title.split(/\s+/).filter((word) => word.length >= 3);

  const isLikelyUiImage = (img: HTMLImageElement) => {
    const src = (img.getAttribute("src") || img.currentSrc || "").toLowerCase();
    const alt = (img.alt || "").toLowerCase();
    const className = (img.className || "").toString().toLowerCase();
    const haystack = `${src} ${alt} ${className}`;

    return [
      "avatar",
      "logo",
      "icon",
      "sprite",
      "banner",
      "thumbnail",
      "thumb",
      "button",
      "badge",
      "emoji",
      "favicon"
    ].some((token) => haystack.includes(token));
  };

  const scoreImage = (img: HTMLImageElement) => {
    if (isLikelyUiImage(img)) return -Infinity;

    const src = (img.getAttribute("src") || img.currentSrc || "").trim();
    if (!src) return -Infinity;

    let score = 0;
    const alt = (img.alt || "").toLowerCase();
    const className = (img.className || "").toString().toLowerCase();
    const srcLower = src.toLowerCase();
    const width = Number(img.getAttribute("width") || img.naturalWidth || 0);
    const height = Number(img.getAttribute("height") || img.naturalHeight || 0);

    if (height > 0 && width > 0) {
      const ratio = height / width;
      if (ratio >= 1.1) score += 8;
      else if (ratio >= 0.9) score += 4;
      else score -= 3;
    }

    if (alt.includes(title) || titleWords.some((word) => alt.includes(word))) score += 5;
    if (className.includes("cover") || className.includes("poster")) score += 4;
    if (srcLower.includes("cover") || srcLower.includes("poster")) score += 4;
    if (srcLower.includes("series") || srcLower.includes("manga") || srcLower.includes("manhwa")) score += 2;

    if (img.loading === "eager") score += 1;
    if (img.getAttribute("decoding") === "async") score += 1;

    return score;
  };

  const images = Array.from(doc.querySelectorAll("img"));
  let bestSrc: string | null = null;
  let bestScore = -Infinity;

  for (const img of images) {
    const score = scoreImage(img);
    if (score > bestScore) {
      bestScore = score;
      bestSrc = img.getAttribute("src") || img.currentSrc || null;
    }
  }

  return bestSrc;
}

export function scrapeGeneric(doc: Document, url: string): Omit<ScrapedManhwa, "totalChapters" | "chapters"> {
  const title = extractTitleRobust(doc, url) ?? "";
  return {
    title,
    coverUrl: extractImage(doc) || null,
    description: extractDescription(doc, title),
    sourceUrl: url
  };
}
