import { mount, unmount } from "svelte";
import App from "./views/App.svelte";
import { looksLikeSeriesPage, scrapeCurrentPage } from "@/lib/scraper/index";
import { manhwaStore } from "@/lib/manhwaStore.svelte";
import { updateExistingManhwa } from "@/lib/updateManhwaLib.svelte";

let currentApp: ReturnType<typeof mount> | null = null;
let mountedForUrl: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function evaluateAndMount() {
  const url = window.location.href;
  if (url === mountedForUrl) return;
  console.log("window:", url, "mountedForUrl:", mountedForUrl);

  const container = document.getElementById("crxjs-app");
  if (currentApp) {
    unmount(currentApp);
    currentApp = null;
  }
  container?.remove();

  if (!looksLikeSeriesPage()) {
    mountedForUrl = null;
    return;
  }

  const scraped = scrapeCurrentPage();
  console.log("Scraped manhwa:", scraped);
  // await updateExistingManhwa(scraped, url)
  // let existing = await manhwaStore.getManhwaByTitleOnHost(scraped.title, url)
  // existing = await manhwaStore.getManhwaBySourceUrl(url)

  const newContainer = document.createElement("div");
  newContainer.id = "crxjs-app";
  document.body.appendChild(newContainer);
  currentApp = mount(App, {
    target: newContainer
    // props: { scraped, existingManhwaId: existing?.id ?? null },
  });
  mountedForUrl = url;
}

function scheduleEvaluate() {
  console.log("Content script started");
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(evaluateAndMount, 600);
}

function start() {
  scheduleEvaluate();

  // 1. Listen for standard history and popstate navigation events
  window.addEventListener("popstate", scheduleEvaluate);
  window.addEventListener("hashchange", scheduleEvaluate);

  // 2. Narrow the observer scope to the main content container only
  const mainContent =
    document.querySelector("#app") || document.querySelector("main") || document.body;

  if (mainContent !== document.body) {
    const observer = new MutationObserver(() => scheduleEvaluate());
    observer.observe(mainContent, { childList: true, subtree: false }); // Drop subtree if possible
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
