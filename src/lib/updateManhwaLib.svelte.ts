import { manhwaStore } from "@/lib/manhwaStore.svelte";
import type { ScrapedManhwa } from "@/types";

export async function updateExistingManhwa(scraped: ScrapedManhwa, url: string) {
  if (!scraped.title) return;
  let existingManhwa = manhwaStore.getManhwaByTitleOnHost(scraped.title, url);
  if (!existingManhwa) {
    existingManhwa = manhwaStore.getManhwaBySourceUrl(url);
  }
  if (!existingManhwa) return;

  const updatedChps = [];

  for (const scrapedChp of scraped.chapters) {
    const existingChp = existingManhwa.chapters.find((ch) => ch.url === scrapedChp.url);
    if (!existingChp) {
      updatedChps.push(scrapedChp);
    }
  }
  
  const newChapters = [...$state.snapshot(existingManhwa.chapters), ...updatedChps];
  const newTotalChapters = Math.max(...newChapters.map((ch) => ch.number));

  await manhwaStore.update(existingManhwa.id, {
    sourceUrl: scraped.sourceUrl ?? existingManhwa.sourceUrl,
    totalChapters: newTotalChapters ?? existingManhwa.totalChapters,
    chapters: newChapters
  });
}
