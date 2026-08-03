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
  const skip = new Set(["series", "manga", "manhwa", "comic", "read", "title", "chapter"]);
  const candidates = segments.filter((s) => !skip.has(s.toLowerCase()) && !/^\d+$/.test(s));
  if (candidates.length === 0) return "";
  return candidates.reduce((a, b) => (b.length > a.length ? b : a));
}


// Matches a chapter/episode number when it starts its own clean path segment,
// e.g. "chapter-244", ".../chapter/244", "episode-19", ".../episode/19", or
// "ep-528-white-ghost-9" (trailing episode-title text is ignored).
// Rejects numbers embedded inside longer combined segments where the prefix
// isn't immediately followed by the number (e.g. "chapterhouse-244").
export function extractChapterFromSegments(href: string): ChapterMatch | null {
  let path: string;
  try {
    path = new URL(href, location.origin).pathname;
  } catch {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  let highest: ChapterMatch | null = null;

  const consider = (num: number, unit: ChapterUnit) => {
    if (highest === null || num > highest.number) highest = { number: num, unit };
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const exact = seg.match(/^(chapter|ch|episode|ep)[-_]?(\d+(?:[\.\-]\d+)?)(?:[-_].*)?$/i);
    if (exact) {
      const unit: ChapterUnit = /^ep/i.test(exact[1]) ? "Ep." : "Ch.";
      const num = parseFloat(exact[2].replace("-", "."));
      consider(num, unit);
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

  const images = doc.querySelectorAll("img");
  const title = extractTitleRobust(doc, doc.URL);
  for (const img of images) {
    if (img.alt?.includes(title)) {
      return img.getAttribute("src") || null;
    }
  }

  return null;
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
