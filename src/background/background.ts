import { cacheCover } from "@/lib/coverCache.svelte";
import { fetchMangadexCover } from "@/background/services/mangadex";
import { fetchMangaTags } from "@/background/services/anilist";
import * as manhwaDB from "@/lib/manhwaDataAccess";
import { messageHandlers } from "@/background/services/handlers";

// async function handleMessage(msg: any, sender: chrome.runtime.MessageSender) {
//   switch (msg.type) {
//     case 'cache-cover': {
//       try {
//         const res = await fetch(msg.url);
//         if (!res.ok) throw new Error(`${res.status}`);
//         const blob = await res.blob();
//         await cacheCover(msg.id, blob);
//         return { ok: true, source: 'direct' };
//       } catch {
//         const fallbackBlob = await fetchMangadexCover(msg.title);
//         if (fallbackBlob) {
//           await cacheCover(msg.id, fallbackBlob);
//           return { ok: true, source: 'mangadex' };
//         }
//         return { ok: false };
//       }
//     }

//     case 'set-selected-manhwa': {
//       try {
//         console.log('[background] setting selected manhwa to', msg.id);
//         await chrome.storage.session.set({ selectedManhwaId: msg.id });
//         return { ok: true };
//       } catch (err) {
//         console.error('[background] failed to set selected manhwa', err);
//         return { ok: false };
//       }
//     }

//     case 'open-sidepanel': {
//       const windowId = sender.tab?.windowId;
//       if (windowId === undefined) return { ok: false };
//       await chrome.sidePanel.open({ windowId });
//       console.log('[background] side panel opened in window', windowId);
//       return { ok: true, status: 'opened' };
//     }

//     case 'is-sidepanel-open': {
//       const windowId = sender.tab?.windowId;
//       if (windowId === undefined) return { ok: false };
//       const res = await chrome.storage.session.get(`sidePanelOpen:${windowId}`);
//       const isOpen = res[`sidePanelOpen:${windowId}`]; // boolean value
//       return isOpen ? { ok: true, status: 'already-open' } : { ok: false, status: 'not-open' };
//     }

//     case 'get-selected-manhwa': {
//       const res = await chrome.storage.session.get('selectedManhwaId');
//       return { ok: true, id: res.selectedManhwaId ?? null };
//     }

//     case 'fetch-anilist-tags': {
//       try {
//         const media = await fetchMangaTags(msg.title);
//         console.log('[background] fetched AniList tags for', msg.title, media);
//         const tags = media?.genres;
//         return { ok: true, tags };
//       } catch (err) {
//         console.error('[background] failed to fetch AniList tags', err);
//         return { ok: false };
//       }
//     }

//     case 'manhwa:add': {
//       await manhwaDB.addManhwa(msg.manhwa);
//       return { ok: true };
//     }

//     case 'manhwa:update': {
//       await manhwaDB.updateManhwa(msg.id, msg.manhwa);
//       return { ok: true };
//     }

//     case 'manhwa:remove': {
//       await manhwaDB.removeManhwa(msg.id);
//       return { ok: true };
//     }

//     case 'manhwa:clear': {
//       await manhwaDB.clearManhwa();
//       return { ok: true };
//     }

//     default:
//       return { ok: false, error: 'Unknown message type' };
//   }
// }

async function handleMessage(msg: any, sender: chrome.runtime.MessageSender) {
  const handler = messageHandlers[msg.type];

  // Reject unknown message types early
  if (!handler) {
    console.warn("[background] unknown message type:", msg.type);
    return { ok: false, error: "Unknown message type" };
  }

  try {
    return await handler(msg, sender);
  } catch (err) {
    console.error(`[background] error handling message type ${msg.type}:`, err);
    return { ok: false };
  }
}

// Listen for messages from content scripts or other parts of the extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then((response) => sendResponse(response))
    .catch(() => sendResponse({ ok: false }));

  return true; // Keeps the message channel open
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "sidepanel-heartbeat") return;

  let boundWindowId: number | null = null;

  port.onMessage.addListener((msg) => {
    if (typeof msg.windowId === "number") {
      boundWindowId = msg.windowId;
      chrome.storage.session.set({ [`sidePanelOpen:${msg.windowId}`]: true });
    }
  });

  port.onDisconnect.addListener(() => {
    if (boundWindowId !== null) {
      chrome.storage.session.set({ [`sidePanelOpen:${boundWindowId}`]: false });
    }
  });
});
