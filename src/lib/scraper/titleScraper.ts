import { getMeta } from "@/lib/scraper/genericScraper";

interface TitleCandidate {
  title: string;
  sources: Set<string>;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/^read\s+/i, "")
    .replace(/\s*\|\s*.+$/, "") // | Asura Scans
    .replace(/\s*-\s*chapter\s+\d+.*$/i, "")
    .replace(/\s*chapter\s+\d+.*$/i, "")
    .replace(/\s*-\s*(manga|manhwa|manhua).*$/i, "")
    .replace(/\s+(manga|manhwa|manhua)\s+online.*$/i, "")
    .replace(/\s+(manga|manhwa|manhua|webtoon)s?\s*$/i, "")
    .trim();
}

function addCandidate(map: Map<string, TitleCandidate>, raw: string | null | undefined, source: string) {
  if (!raw) return;

  const title = normalizeTitle(raw);

  if (!title) return;
  if (title.length < 2) return;

  // Reject obvious junk
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

export function extractTitleRobust(doc: Document): string {
  const candidates = new Map<string, TitleCandidate>();

  //---------------------------------
  // document.title
  //---------------------------------

  addCandidate(candidates, doc.title, "document.title");

  //---------------------------------
  // meta
  //---------------------------------

  addCandidate(candidates, getMeta(doc, "og:title"), "og:title");

  //---------------------------------
  // headings
  //---------------------------------

  doc.querySelectorAll("h1,h2,h3").forEach((el) => {
    addCandidate(candidates, el.textContent, el.tagName.toLowerCase());
  });

  //---------------------------------
  // schema.org
  //---------------------------------

  doc.querySelectorAll('[itemprop="name"]').forEach((el) => {
    addCandidate(candidates, el.textContent, "itemprop=name");
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
          addCandidate(candidates, obj.name, "jsonld");
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

    // then prefer shorter names

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
