import { extractChapters } from "./chapterScraper";
import type { ChapterScraperItem, ScrapedChapter } from "@/types";
import { waitForDomToSettle } from "./infiniteScrollChpScraper";

const MAX_PAGES = 100; 
const REQUIRED_STABLE_CYCLES = 3;

/**
 * Searches the DOM for the most likely "Next Page" element.
 * Prioritizes numeric sequencing first, then falls back to explicit "Next" text/aria-labels.
 */
function findNextElement(doc: Document): HTMLElement | null {
  // Grab all likely clickable targets
  const candidates = Array.from(doc.querySelectorAll('a, button, [role="button"], li')) as HTMLElement[];

  // Helper function to quickly skip disabled elements
  const isDisabled = (el: HTMLElement) => {
    return (el as HTMLButtonElement).disabled || 
      el.getAttribute('aria-disabled') === 'true' || 
      el.classList.contains('disabled') || 
      el.classList.contains('off'); // Webtoons specific disabled class
  };

  // STRATEGY 1: Numeric Sequencing (Highest Priority)
  // Find "1" as active, look for "2". This prevents skipping chunked pagination blocks.
  let activeNum: number | null = null;

  for (const el of candidates) {
    if (isDisabled(el)) continue;
    
    const text = (el.textContent || "").trim();
    if (!/^\d+$/.test(text)) continue;

    const isCurrent =
      el.getAttribute('aria-current') === 'page' ||
      el.getAttribute('aria-current') === 'true' ||
      el.classList.contains('active') ||
      el.classList.contains('is-active') || // Comix.to
      el.classList.contains('current');

    if (isCurrent) {
      activeNum = parseInt(text, 10);
      break; // Found the active page, stop looking
    }
  }

  // If we found an active number, look for the exact element that represents activeNum + 1
  if (activeNum !== null) {
    const targetText = (activeNum + 1).toString();
    for (const el of candidates) {
      if (isDisabled(el)) continue;
      
      if ((el.textContent || "").trim() === targetText) {
        return el.tagName === 'LI' ? (el.querySelector('a, button') as HTMLElement || el) : el;
      }
    }
  }

  // STRATEGY 2: Explicit "Next" Heuristics (Fallback)
  // Used if numbers don't exist, OR if the next number isn't visible 
  // (e.g., we are on page 10, "11" isn't in the DOM, so we click the "Next Page" button)
  for (const el of candidates) {
    if (isDisabled(el)) continue;

    const text = (el.textContent || "").trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || "").toLowerCase();
    const className = (el.getAttribute('class') || "").toLowerCase();

    if (
      text === "next" || text === "next page" ||
      text === "›" || text === "»" || text === ">" ||
      aria.includes("next") || 
      className.includes("next") || 
      className.includes("pg_next")
    ) {
      // If it's an <li>, the actual clickable element is usually inside it
      if (el.tagName === 'LI') {
          return el.querySelector('a, button') as HTMLElement || el;
      }
      return el;
    }
  }

  return null; // Hit the end of the line
}

/**
 * Checks if the element has a standard URL we can fetch in the background.
 */
function getValidHref(el: HTMLElement, currentUrl: string): string | null {
  if (el.tagName.toLowerCase() !== 'a') return null;
  const rawHref = el.getAttribute('href');
  
  // Reject JS routing placeholders
  if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:')) return null;
  
  try {
    return new URL(rawHref, currentUrl).href;
  } catch {
    return null;
  }
}

/**
 * Waits for the DOM to settle after a live JS click.
 */
// function waitForDomToSettle(maxWaitMs: number, quietMs = 300): Promise<void> {
//   return new Promise((resolve) => {
//     let quietTimer: ReturnType<typeof setTimeout>;
//     const finish = () => { observer.disconnect(); resolve(); };
//     const observer = new MutationObserver(() => {
//       clearTimeout(quietTimer);
//       quietTimer = setTimeout(finish, quietMs);
//     });
//     observer.observe(document.body, { childList: true, subtree: true });
//     quietTimer = setTimeout(finish, maxWaitMs);
//   });
// }

/**
 * Scrapes paginated chapters using either background fetches (traditional) 
 * or live DOM clicks (React/JS SPAs).
 */
export async function scrapePaginationChapters(
  doc: Document,
  url: string
): Promise<ChapterScraperItem | null> {
  let currentDoc = doc;
  let currentUrl = url;
  let nextElement = findNextElement(currentDoc);
  
  if (!nextElement) return null; // No pagination found, fallback to infinite scroll

  console.log("[Pagination] Pagination detected. Starting hybrid loop...");

  const uniqueChapters = new Map<number, ScrapedChapter>();
  const initialScrape = extractChapters(currentDoc, currentUrl);
  for (const ch of initialScrape.chapters) uniqueChapters.set(ch.number, ch);

  let stableCycles = 0;
  let previousCount = uniqueChapters.size;
  const visitedUrls = new Set<string>([url]);

  for (let cycle = 0; cycle < MAX_PAGES && stableCycles < REQUIRED_STABLE_CYCLES; cycle++) {
    nextElement = findNextElement(currentDoc);
    if (!nextElement) {
        console.log("[Pagination] Reached end of pagination.");
        break;
    }

    const href = getValidHref(nextElement, currentUrl);

    if (href) {
      // STRATEGY A: Fetch Detached DOM (Fastest, avoids hard reloading the current page)
      if (visitedUrls.has(href)) {
          console.log("[Pagination] Loop detected. Terminating.");
          break;
      }
      visitedUrls.add(href);
      
      console.log(`[Pagination] Background fetching: ${href}`);
      try {
        const response = await fetch(href);
        if (!response.ok) break;
        const html = await response.text();
        currentDoc = new DOMParser().parseFromString(html, "text/html");
        currentUrl = href;
      } catch (err) {
        console.error("[Pagination] Fetch failed", err);
        break;
      }

    } else {
      // STRATEGY B: Live DOM Click (JS/React SPAs like Comix.to and Luacomics)
      // Note: We can only click live if we are currently looking at the live DOM
      if (currentDoc !== document) {
          console.error("[Pagination] Cannot execute JS click on a detached DOM.");
          break;
      }

      console.log("[Pagination] Simulating JS Click...");
      nextElement.click();
      
      // Give the framework time to fetch data and re-render the DOM
      await waitForDomToSettle(500, 100); 
      
      // Update variables to reflect the newly mutated live DOM
      currentDoc = document; 
      currentUrl = window.location.href; 
    }

    const pageScrape = extractChapters(currentDoc, currentUrl);
    for (const ch of pageScrape.chapters) uniqueChapters.set(ch.number, ch);

    const newCount = uniqueChapters.size;
    stableCycles = newCount === previousCount ? stableCycles + 1 : 0;
    previousCount = newCount;
  }

  const finalChapters = Array.from(uniqueChapters.values()).sort((a, b) => a.number - b.number);
  
  // Note: We ignore anchors here because extracting anchors from 10 different pages 
  // (some of which are detached) breaks UI functionality later.
  return { anchors: initialScrape.anchors, chapters: finalChapters };
}