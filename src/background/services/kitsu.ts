import type {
  KitsuCategoryRaw,
  KitsuManga,
  KitsuMangaDetailResponse,
  KitsuMangaRaw,
  KitsuSearchResponse
} from "@/types";

const KITSU_BASE = "https://kitsu.io/api/edge";

const KITSU_HEADERS = {
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json"
};

/**
 * Flattens every title variant Kitsu has for a candidate — canonical,
 * localized, and synonyms — since a query can match ANY of these,
 * not just canonicalTitle.
 */
function getAllTitleVariants(candidate: KitsuMangaRaw): string[] {
  const { canonicalTitle, titles, abbreviatedTitles } = candidate.attributes;
  return [canonicalTitle, ...Object.values(titles).filter((t): t is string => !!t), ...(abbreviatedTitles ?? [])];
}

/**
 * Given a query and a list of search candidates, picks the candidate whose
 * BEST-matching title variant scores highest — not just canonicalTitle.
 * Swap `stringSimilarity` for your existing Sørensen–Dice util.
 */
function pickBestKitsuMatch(
  query: string,
  candidates: KitsuMangaRaw[],
  stringSimilarity: (a: string, b: string) => number
): KitsuMangaRaw | null {
  let best: { candidate: KitsuMangaRaw; score: number } | null = null;

  for (const candidate of candidates) {
    const variants = getAllTitleVariants(candidate);
    const bestVariantScore = Math.max(...variants.map((variant) => stringSimilarity(query, variant)));

    if (!best || bestVariantScore > best.score) {
      best = { candidate, score: bestVariantScore };
    }
  }

  if (best && best.score < 0.6) {
    // If the best match is below a certain threshold, consider it no match.
    return null;
  }

  return best?.candidate ?? null;
}

/**
 * Step 1: search by title, returns full attributes already (no genres yet).
 * Good enough for a title-confirmation picker UI on its own.
 */
export async function searchKitsu(title: string, limit = 15): Promise<KitsuMangaRaw[]> {
  const url = `${KITSU_BASE}/manga?filter[text]=${encodeURIComponent(title)}&page[limit]=${limit}`;

  const res = await fetch(url, { headers: KITSU_HEADERS });

  if (!res.ok) {
    throw new Error(`Kitsu search failed: ${res.status}`);
  }

  const data: KitsuSearchResponse = await res.json();
  console.log("Kitsu search results:", data.data);
  return data.data;
}

/**
 * Step 2: given an id from a search result, get full detail INCLUDING
 * genres/categories in the same request via ?include=categories.
 */
export async function getKitsuManga(mangaId: string): Promise<KitsuManga> {
  const url = `${KITSU_BASE}/manga/${mangaId}?include=categories`;
  const res = await fetch(url, { headers: KITSU_HEADERS });

  if (!res.ok) {
    throw new Error(`Kitsu manga fetch failed: ${res.status}`);
  }

  const { data, included = [] }: KitsuMangaDetailResponse = await res.json();

  const genres = included
    .filter((item): item is KitsuCategoryRaw => item.type === "categories")
    .map((item) => item.attributes.title);

  return {
    id: data.id,
    title: data.attributes.canonicalTitle,
    description: data.attributes.synopsis ?? "",
    genres,
    imageUrl: data.attributes.posterImage?.original ?? data.attributes.posterImage?.large ?? "",
    format: data.attributes.subtype,
    source: "kitsu"
  };
}

/**
 * Replaces fetchKitsuByTitle's blind top-1 trust: pulls a wider candidate
 * pool, then scores every title variant per candidate rather than assuming
 * Algolia's #1 result is correct.
 */
export async function fetchKitsuByTitleMatched(
  title: string,
  stringSimilarity: (a: string, b: string) => number,
  candidatePoolSize = 15
): Promise<KitsuManga | null> {
  const fixedTitle = title
    .replace(/\([^)]*\)/g, "") // 1. Remove ()
    .replace(/\[[^\]]*\]/g, "") // 2. Remove []
    .replace(/(\w+)['’`‘]s\b/gi, (match, word) => {
      // 3. Keep 'it's', remove other possessives (e.g. "Swordmaster's" -> "Swordmaster")
      return word.toLowerCase() === "it" ? match : word;
    })
    .replace(/[^\w\s,'’`-]/g, "") // 4. Clean non-alphanumerics, keeping straight/curly apostrophes for contractions, spaces, commas, hyphens
    .replace(/\s+/g, " ") // 5. Normalize spaces
    .trim(); // 6. Trim leading/trailing spaces
  const candidates = await searchKitsu(fixedTitle, candidatePoolSize);
  if (candidates.length === 0) return null;

  const bestMatch = pickBestKitsuMatch(fixedTitle, candidates, stringSimilarity);
  if (!bestMatch) return null;

  return getKitsuManga(bestMatch.id);
}
