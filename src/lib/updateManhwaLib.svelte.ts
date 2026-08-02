import { manhwaStore } from "@/lib/manhwaStore.svelte";
import type { ScrapedChapter, ScrapedManhwa } from "@/types";

export async function updateExistingManhwa(scraped: ScrapedManhwa, url: string) {
  if (!scraped.title) return;
  let existingManhwa = await manhwaStore.getManhwaByTitleOnHost(scraped.title, url);
  if (!existingManhwa) {
    existingManhwa = await manhwaStore.getManhwaBySourceUrl(url);
  }
  if (!existingManhwa) return;

  const updatedChps = [];
  let maxChp = Math.max(...existingManhwa.chapters.map((ch) => ch.number));

  for (const scrapedChp of scraped.chapters) {
    const existingChp = existingManhwa.chapters.find((ch) => ch.url === scrapedChp.url);
    if (!existingChp) {
      scrapedChp.number = maxChp + 1;
      updatedChps.push(scrapedChp);
      maxChp++;
    }
  }
  const newChapters = [...existingManhwa.chapters, ...updatedChps];
  const newTotalChapters = Math.max(...newChapters.map((ch) => ch.number));

  await manhwaStore.update(existingManhwa.id, {
    sourceUrl: scraped.sourceUrl ?? existingManhwa.sourceUrl,
    totalChapters: newTotalChapters ?? existingManhwa.totalChapters,
    chapters: newChapters
  });
}
