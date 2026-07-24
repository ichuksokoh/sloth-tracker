import { stringSimilarity } from "@/lib/titleMatch";

export async function fetchMangadexCover(title: string): Promise<Blob | null> {
  try {
    const searchRes = await fetch(
      `https://api.mangadex.org/manga?${new URLSearchParams({
        title,
        limit: "10",
        "includes[]": "cover_art"
      })}`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData.data ?? [];

    let best: { manga: any; score: number } | null = null;
    for (const manga of results) {
      const titleAttrs = manga.attributes?.title ?? {};
      const altTitles = (manga.attributes?.altTitles ?? []).flatMap((alt: object) =>
        Object.values(alt)
      );
      const candidates = [...Object.values(titleAttrs), ...altTitles].filter(Boolean) as string[];
      for (const candidateTitle of candidates) {
        const score = stringSimilarity(title, candidateTitle);
        if (score >= 0.6 && (!best || score > best.score)) {
          best = { manga, score };
        }
      }
    }

    if (!best) return null;

    const coverRel = best.manga.relationships?.find((r: any) => r.type === "cover_art");
    if (!coverRel) return null;

    const coverInfoRes = await fetch(`https://api.mangadex.org/cover/${coverRel.id}`);
    if (!coverInfoRes.ok) return null;
    const coverInfo = await coverInfoRes.json();
    const fileName = coverInfo.data?.attributes?.fileName;
    if (!fileName) return null;

    const imageUrl = `https://uploads.mangadex.org/covers/${best.manga.id}/${fileName}`;
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return null;
    return await imageRes.blob();
  } catch {
    return null;
  }
}
