import { manhwaStore } from "@/lib/manhwaStore.svelte";
import type { ScrapedChapter, ScrapedManhwa } from "@/types";

export async function updateExistingManhwa(scraped: ScrapedManhwa, url: string) {
  if (!scraped.title) return;
  let existingManhwa = await manhwaStore.getManhwaByTitleOnHost(scraped.title, url);
  if (!existingManhwa) {
    existingManhwa = await manhwaStore.getManhwaBySourceUrl(url);
  }
  if (!existingManhwa) return;
  if (existingManhwa.chapters.length >= scraped.chapters.length) return;

  const chpCompare = (a: ScrapedChapter, b: ScrapedChapter) =>
    a.number === b.number && a.url === b.url && a.label === b.label;

  if (existingManhwa.chapters.some((ch, i) => !chpCompare(ch, scraped.chapters[i]))) return;

  let onlyNewChps = true;
  for (let i = existingManhwa.chapters.length; i < scraped.chapters.length; i++) {
    if (existingManhwa.chapters.find((ch) => chpCompare(ch, scraped.chapters[i]))) {
      onlyNewChps = false;
      break;
    }
  }

  if (onlyNewChps) {
    await manhwaStore.update(existingManhwa.id, {
      sourceUrl: scraped.sourceUrl ?? existingManhwa.sourceUrl,
      totalChapters: scraped.totalChapters ?? existingManhwa.totalChapters,
      chapters: scraped.chapters
    });
  }
}
