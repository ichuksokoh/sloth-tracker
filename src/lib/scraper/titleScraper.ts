import { getMeta, getSpacedText } from "@/lib/scraper/genericScraper";
import type { TitleCandidate } from "@/types";

/**
 * Normalizes a raw title string by stripping SEO spam, chapter numbers, and site names.
 */
function normalizeTitle(title: string, domainName: string = ""): string {
  let t = title.replace(/\s+/g, " ").trim();

  // 1. Remove SEO prefixes (e.g., "Read", "Free", "Watch")
  t = t.replace(/^(read|free|watch)\s+/i, "");

  // 2. Remove Chapter suffixes (e.g., " - Chapter 123", " Chapter 14")
  t = t.replace(/\s*[-|~]?\s*chapter\s+\d+.*$/i, "");

  // 3. Remove common site suffixes after a hyphen or pipe (e.g., " - Lua Comics", " - Asura Scans")
  // Requires REAL whitespace around the separator, so a hyphen inside the
  // title itself (e.g. "Star-Embracing Swordmaster") isn't mistaken for a
  // " - Site Name" suffix and doesn't swallow the whole title.
  t = t.replace(/\s+[-|]\s+.*?(scans?|comics?|scanlations?|manga|manhwa|manhua|webtoons?|toons?)\s*$/i, "");

  // 4. Remove generic trailing media types and any SEO filler that follows
  // them (e.g., " Title Manga Online", " Title Manga Online for Free").
  // Anything after "manga/manhwa/manhua/webtoon" as a trailing word is junk.
  t = t.replace(/\s+(manga|manhwa|manhua|webtoon)s?\b.*$/i, "");

  // 5. Dynamically strip the host domain name if it appears after a separator
  if (domainName) {
    // e.g., strips " - luacomics" or " ~ drake"
    const domainRegex = new RegExp(`\\s+[-|~]\\s+.*?${domainName}.*$`, "i");
    t = t.replace(domainRegex, "");
  }

  // 6. Catch-all: Pipes (|) are almost exclusively used for SEO/Site names. Remove anything after it.
  t = t.replace(/\s*\|.*$/, "");

  return t.trim();
}

function addCandidate(
  map: Map<string, TitleCandidate>,
  raw: string | null | undefined,
  source: string,
  domainName: string
) {
  if (!raw) return;

  const title = normalizeTitle(raw, domainName);

  if (!title || title.length < 2) return;

  // Reject obvious junk that isn't a title
  if (/^(chapter|comments|bookmark|follow|share)$/i.test(title)) return;

  if (!map.has(title)) {
    map.set(title, {
      title,
      sources: new Set([source])
    });
  } else {
    map.get(title)!.sources.add(source);
  }
}

/**
 * Extracts the most likely series title from the document.
 * Optionally pass the current URL to strip the domain name from the title string.
 */
export function extractTitleRobust(doc: Document, url: string = window.location.href): string {
  const candidates = new Map<string, TitleCandidate>();

  // Extract the raw domain name (e.g., "luacomics.org" -> "luacomics")
  let domainName = "";
  try {
    domainName = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
  } catch {}

  //---------------------------------
  // document.title
  //---------------------------------
  addCandidate(candidates, doc.title, "document.title", domainName);

  //---------------------------------
  // meta
  //---------------------------------
  addCandidate(candidates, getMeta(doc, "og:title"), "og:title", domainName);

  //---------------------------------
  // headings
  //---------------------------------
  // Use getSpacedText instead of textContent — nested spans/elements inside
  // headings (e.g. alt-title lists glued right up against the main title)
  // otherwise get concatenated with no space, e.g. "VagabondAvare; ...".
  doc.querySelectorAll("h1,h2,h3").forEach((el) => {
    addCandidate(candidates, getSpacedText(el), el.tagName.toLowerCase(), domainName);
  });

  //---------------------------------
  // schema.org
  //---------------------------------
  doc.querySelectorAll('[itemprop="name"]').forEach((el) => {
    addCandidate(candidates, getSpacedText(el), "itemprop=name", domainName);
  });

  //---------------------------------
  // JSON-LD
  //---------------------------------
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const json = JSON.parse(script.textContent || "");
      const objects = Array.isArray(json) ? json : [json];

      for (const obj of objects) {
        if (typeof obj.name === "string") {
          addCandidate(candidates, obj.name, "jsonld", domainName);
        }
      }
    } catch {}
  });

  //---------------------------------
  // Pick best candidate
  //---------------------------------
  const ranked = [...candidates.values()].sort((a, b) => {
    // first compare how many sources agree
    if (b.sources.size !== a.sources.size) return b.sources.size - a.sources.size;

    // then prefer shorter names (shorter names usually have less SEO spam attached)
    return a.title.length - b.title.length;
  });

  if (ranked.length === 0) return "";

  console.log(
    "Title candidates:",
    ranked.map((c) => ({
      title: c.title,
      sources: [...c.sources]
    }))
  );

  return ranked[0].title;
}