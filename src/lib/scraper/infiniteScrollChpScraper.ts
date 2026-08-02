import type { ChapterScraperItem } from "@/types";
import { extractChapters } from "./chapterScraper";


// if a series has more than this many chapters, we assume it doesn't nned lazy-load scrolling to get all of them. 
const ChpCountThreshold = 60;
// number of cycles where the chapter count must remain stable before we assume we've reached the end of the list 
const REQUIRED_STABLE_CYCLES = 2;
const MAX_CYCLES = 100; // safety limit to avoid infinite loops

const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;
const SAMPLE_SIZE = 25; // number of anchors to sample when determining scrollable ancestor

function isScrollableElement(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return SCROLLABLE_OVERFLOW.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2;
}

function findScrollableAncestorForOne(anchor: Element): HTMLElement | Window | null {
  let el = anchor.parentElement as HTMLElement | null;
  while (el && el !== document.body) {
    if (isScrollableElement(el)) return el;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      if (isScrollableElement(child)) return child;
    }
    el = el.parentElement;
  }
  const pageScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight + 20;
  return pageScrollable ? window : null;
}

// Checks multiple anchors rather than trusting anchors[0] — a stray
// anchor elsewhere on the page (e.g. a "Start Reading" button outside
// the chapter list) would otherwise skew the result. The real chapter
// list dominates by sheer count, so majority vote finds it reliably.
function findScrollableAncestor(anchors: Element[]): HTMLElement | Window | null {
  if (anchors.length === 0) return null;

  const sample = anchors.slice(0, Math.min(anchors.length, SAMPLE_SIZE));
  const counts = new Map<HTMLElement | Window, number>();

  for (const anchor of sample) {
    const target = findScrollableAncestorForOne(anchor);
    if (target === null) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  let best: HTMLElement | Window | null = null;
  let bestCount = 0;
  for (const [target, count] of counts) {
    if (count > bestCount) {
      best = target;
      bestCount = count;
    }
  }
  return best;
}


function needsLazyLoadScrolling(anchor_chps: ChapterScraperItem): boolean {

    const {anchors, chapters} = anchor_chps;
    // const mostCommonParent = getMostCommonParent(anchors);
    const scrollTarget = findScrollableAncestor(anchors);
    if (!scrollTarget) return false;

    const hasLittleChapters = chapters.length <= ChpCountThreshold;
    // Scrolling necessary when scrollable with not large chapter count
    // chapters.length > 50 ===> no scrolling needed, even if scrollable, because all chapters are already loaded
    return hasLittleChapters;
}

export function waitForDomToSettle(maxWaitMs: number, quietMs = 300): Promise<void> {
  return new Promise((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout>;
    const finish = () => { observer.disconnect(); resolve(); };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    quietTimer = setTimeout(finish, maxWaitMs);
  });
}

// Smoothly animates scroll position over a set duration and resolves when finished.
function animatedScrollTo(
  target: HTMLElement | Window,
  to: number,
  durationMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const isWin = target instanceof Window;
    const start = isWin ? window.scrollY : (target as HTMLElement).scrollTop;
    const change = to - start;
    const startTime = performance.now();

    function animateScroll(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // EaseInOutQuad easing function for a natural, non-linear feel
      const easeProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentPos = start + change * easeProgress;

      if (isWin) {
        window.scrollTo(0, currentPos);
      } else {
        (target as HTMLElement).scrollTop = currentPos;
      }

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        // Force the scroll event at the very end to guarantee lazy-loaders notice
        target.dispatchEvent(new Event("scroll"));
        resolve();
      }
    }

    requestAnimationFrame(animateScroll);
  });
}

export async function scrapeInfiniteScrollChapters(doc: Document, url: string): Promise<ChapterScraperItem> {
    const anchor_chps = extractChapters(doc, url);
    if (!needsLazyLoadScrolling(anchor_chps)) {
        console.log("No lazy-load scrolling needed, returning extracted chapters.");
        console.log(`Extracted ${anchor_chps.chapters.length} chapters.`);
        return anchor_chps;
    }
    const scrollTarget = findScrollableAncestor(anchor_chps.anchors);
    if (!scrollTarget) {
        return anchor_chps;
    }
    const isWindow = scrollTarget instanceof Window;
    const originalPos = isWindow ? window.scrollY : scrollTarget.scrollTop;

    const initialCount = anchor_chps.chapters.length;
    let previousCount = anchor_chps.chapters.length;
    let stableCycles = 0;
    console.log('Scrolltage is window?: ', scrollTarget === window);
    console.log("ScrollTarget: ", scrollTarget);
    for (let cycle = 0; cycle < MAX_CYCLES && stableCycles < REQUIRED_STABLE_CYCLES; cycle++) {

        const targetScrollHeight = isWindow ? document.body.scrollHeight : scrollTarget.scrollHeight;
        await animatedScrollTo(scrollTarget, targetScrollHeight, 600);
        console.log(`Cycle ${cycle + 1}: Scrolled to bottom, waiting for content to load...`);
        await waitForDomToSettle(1000); // wait for 1 second to allow content to load

        const newAnchorChps = extractChapters(doc, url);
        const newCount = newAnchorChps.chapters.length;
        stableCycles = newCount === previousCount ? stableCycles + 1 : 0;
        previousCount = newCount;

        if (newCount === initialCount && cycle === 0) break; // no new chapters loaded on first cycle, exit early      
    }

    await animatedScrollTo(scrollTarget, originalPos, 250);

    return extractChapters(doc, url);
}