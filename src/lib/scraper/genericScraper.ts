import type { ScrapedManhwa, ChapterUnit, ChapterMatch } from "@/types";
import { extractTitleRobust } from "./titleScraper";

const MAX_PLAUSIBLE_CHAPTER = 5000; // generous — real series rarely get near this

export function getMeta(doc: Document, property: string): string | null {
  const el = doc.querySelector(`meta[property="${property}"]`) ?? doc.querySelector(`meta[name="${property}"]`);
  return el?.getAttribute("content")?.trim() || null;
}

export function getSeriesSlug(url: string): string {
  const path = new URL(url).pathname;
  const segments = path.split("/").filter(Boolean);
  const skip = new Set(["series", "manga", "manhwa", "comic", "read", "title", "chapter", "list", "browse"]);
  // Reject a segment if EVERY hyphen-delimited token in it is a skip word —
  // handles compound path segments like Mangago's "read-manga" (tokens
  // "read" + "manga", both skippable) that a plain whole-segment check misses.
  const isSkippable = (s: string) => s.toLowerCase().split("-").every((tok) => skip.has(tok));
  const candidates = segments.filter((s) => !isSkippable(s) && !/^\d+$/.test(s));
  if (candidates.length === 0) return "";
  return candidates.reduce((a, b) => (b.length > a.length ? b : a));
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
