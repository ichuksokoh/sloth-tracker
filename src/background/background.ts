import { cacheCover } from "@/lib/coverCache.svelte";
import { fetchMangadexCover } from "@/background/services/mangadex";
import { fetchMangaTags } from "@/background/services/anilist";
import { messageHandlers } from "@/background/services/handlers";

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
