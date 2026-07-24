import { cacheCover } from "@/lib/coverCache.svelte";
import { fetchMangadexCover } from "@/background/services/mangadex";
import { fetchMangaTags } from "@/background/services/anilist";
import * as manhwaDB from "@/lib/manhwaDataAccess";

export const messageHandlers: Record<
  string,
  (msg: any, sender: chrome.runtime.MessageSender) => Promise<any>
> = {
  "cache-cover": async (msg) => {
    // Keeps its own try/catch because of the specific fallback logic
    try {
      const res = await fetch(msg.url);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      await cacheCover(msg.id, blob);
      return { ok: true, source: "direct" };
    } catch {
      const fallbackBlob = await fetchMangadexCover(msg.title);
      if (fallbackBlob) {
        await cacheCover(msg.id, fallbackBlob);
        return { ok: true, source: "mangadex" };
      }
      return { ok: false };
    }
  },

  "set-selected-manhwa": async (msg) => {
    console.log("[background] setting selected manhwa to", msg.id);
    await chrome.storage.session.set({ selectedManhwaId: msg.id });
    return { ok: true };
  },

  "open-sidepanel": async (msg, sender) => {
    const windowId = sender.tab?.windowId;
    if (windowId === undefined) return { ok: false };
    await chrome.sidePanel.open({ windowId });
    console.log("[background] side panel opened in window", windowId);
    return { ok: true, status: "opened" };
  },

  "is-sidepanel-open": async (msg, sender) => {
    const windowId = sender.tab?.windowId;
    if (windowId === undefined) return { ok: false };
    const res = await chrome.storage.session.get(`sidePanelOpen:${windowId}`);
    return res[`sidePanelOpen:${windowId}`]
      ? { ok: true, status: "already-open" }
      : { ok: false, status: "not-open" };
  },

  "get-selected-manhwa": async () => {
    const res = await chrome.storage.session.get("selectedManhwaId");
    return { ok: true, id: res.selectedManhwaId ?? null };
  },

  "fetch-anilist-tags": async (msg) => {
    const media = await fetchMangaTags(msg.title);
    console.log("[background] fetched AniList tags for", msg.title, media);
    return { ok: true, tags: media?.genres };
  },

  // Notice how clean these DB operations become as one-liners
  "manhwa:add": async (msg) => {
    await manhwaDB.addManhwa(msg.manhwa);
    return { ok: true };
  },

  "manhwa:update": async (msg) => {
    await manhwaDB.updateManhwa(msg.id, msg.manhwa);
    return { ok: true };
  },

  "manhwa:remove": async (msg) => {
    await manhwaDB.removeManhwa(msg.id);
    return { ok: true };
  },

  "manhwa:clear": async () => {
    await manhwaDB.clearManhwa();
    return { ok: true };
  }
};
