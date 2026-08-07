function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(str: string): string[] {
  const s = str.replace(/\s+/g, ""); // bigrams across the whole string, ignoring spaces
  const pairs: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    pairs.push(s.slice(i, i + 2));
  }
  return pairs;
}

// Sørensen–Dice coefficient: 2 * |shared bigrams| / (|bigrams1| + |bigrams2|)
// Good at catching shared substrings/word-level rearrangement.
// Weak on character-level typos in short strings (a single transposition
// can wipe out all bigram overlap).
function diceCoefficient(normA: string, normB: string): number {
  const bigramsA = bigrams(normA);
  const bigramsB = bigrams(normB);

  const bagB = new Map<string, number>();
  for (const bg of bigramsB) bagB.set(bg, (bagB.get(bg) ?? 0) + 1);

  let shared = 0;
  for (const bg of bigramsA) {
    const count = bagB.get(bg) ?? 0;
    if (count > 0) {
      shared++;
      bagB.set(bg, count - 1); // consume it so duplicate bigrams don't double-count
    }
  }

  return (2 * shared) / (bigramsA.length + bigramsB.length);
}

// Levenshtein edit distance: minimum single-character insertions,
// deletions, and substitutions to turn `a` into `b`.
// Good at catching typos/transpositions (e.g. "mnago" vs "manga") that
// Dice bigrams miss entirely. Weak on word-level reordering.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[n];
}

// Normalizes edit distance into a 0–1 similarity score, scaled by the
// longer of the two strings so short and long titles are comparable.
function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const DICE_WEIGHT = 0.6;
const LEV_WEIGHT = 0.4;
// Combined similarity: 0 (no similarity) to 1 (identical).
// Takes the weighted average of Dice and Levenshtein so each metric's blind spot is
// covered by the other, rather than picking one algorithm to trust.
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);

  if (normA === normB) return 1;
  if (normA.length < 2 || normB.length < 2) return 0;

  const diceScore = diceCoefficient(normA, normB);
  const levScore = levenshteinSimilarity(normA, normB);

  return diceScore * DICE_WEIGHT + levScore * LEV_WEIGHT;
}

export function findBestTitleMatch(
  target: string,
  candidates: { titles: string[]; data: unknown }[],
  threshold = 0.6
): unknown | null {
  let best: { data: unknown; score: number } | null = null;

  for (const candidate of candidates) {
    for (const title of candidate.titles) {
      const score = stringSimilarity(target, title);
      if (score >= threshold && (!best || score > best.score)) {
        best = { data: candidate.data, score };
      }
    }
  }

  return best?.data ?? null;
}

interface SearchMatch {
  rank: 0 | 1 | 2 | 3; // 0 = best (starts with), 3 = worst (fuzzy)
  score: number; // only meaningful for comparing rank-3 matches against each other
}

const FUZZY_THRESHOLD = 0.45;
const SUBSTRING_MIN_QUERY_LEN = 3;
// search bar gets its own weights so it doesn't mess with
// findBestTitleMatch when searching mangadex api, use separate fuzzy search weights
// for more lenient search bar results, since it is more important to find a match than to be accurate
const DICE_WEIGHT_SEARCH = 0.5;
const LEV_WEIGHT_SEARCH = 0.5;
function splitWords(str: string): string[] {
  return str.split(/[^a-z0-9]+/i).filter(Boolean);
}

// Treats transpositions as a single edit, so "mnago" vs "manga" is only 1 edit away instead of 2.
function damLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let twoBack = new Array(n + 1); // row i-2, needed for transposition check
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );

      // transposition: a[i-2..i-1] is the reverse of b[j-2..j-1]
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        currRow[j] = Math.min(currRow[j], twoBack[j - 2] + 1);
      }
    }
    [twoBack, prevRow, currRow] = [prevRow, currRow, twoBack];
  }

  return prevRow[n];
}

// Computes the minimum edit distance to align ALL of `q` against SOME
// prefix of `c`, treating anything after that prefix as free.
// This is what lets a typo'd partial title match a candidate that's much
// longer than what's been typed — a normal edit distance would charge for
// every untyped trailing character as if it were "missing"; this doesn't.
function prefixEditDistance(q: string, c: string): number {
  const m = q.length;
  const n = c.length;
  if (m === 0) return 0;
  if (n === 0) return m;

  let twoBack = new Array(n + 1).fill(0);
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j; // standard init — skipping j leading chars costs j, not 0

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = q[i - 1] === c[j - 1] ? 0 : 1;
      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
      if (i > 1 && j > 1 && q[i - 1] === c[j - 2] && q[i - 2] === c[j - 1]) {
        currRow[j] = Math.min(currRow[j], twoBack[j - 2] + 1);
      }
    }
    [twoBack, prevRow, currRow] = [prevRow, currRow, twoBack];
  }

  // Free END only (candidate can have untyped trailing content) —
  // the START is anchored, so skipping leading characters isn't free.
  return Math.min(...prevRow);
}
// Elasticsearch-style fuzziness budget: how many raw edits to tolerate,
// scaled to the shorter string's length. Prevents short words from
// looking "close" purely by coincidental letter overlap.
function maxTypoBudget(len: number): number {
  if (len <= 3) return 1;
  if (len <= 5) return 2;
  if (len <= 8) return 3;
  return Math.floor(len / 2.8); // up to ~35% different and still be considered a match
}

/**
 * Ranks a single query against a single candidate string.
 *   0 = candidate starts with query
 *   1 = some word within candidate starts with query
 *   2 = query appears anywhere in candidate (only for queries 3+ chars)
 *   3 = fuzzy match via stringSimilarity (typo-tolerant, catches things
 *       tiers 0-2 miss entirely, e.g. "mnago" vs "manga")
 * Returns null if nothing matches at all.
 */
function searchRank(query: string, candidate: string): SearchMatch | null {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();

  if (c.startsWith(q)) return { rank: 0, score: 1 };
  const words = splitWords(c);
  if (words.some((word) => word.startsWith(q))) return { rank: 1, score: 1 };
  if (q.length >= SUBSTRING_MIN_QUERY_LEN && c.includes(q)) return { rank: 2, score: 1 };

  if (q.length >= 2) {
    let bestScore = 0;
    for (const cand of [c, ...words]) {
      const budget = maxTypoBudget(Math.min(q.length, cand.length));
      const edits = damLevenshtein(q, cand);
      if (edits > budget) continue; // too different for words this short — skip, don't even score it

      // reuse `edits` instead of recomputing it inside stringSimilarity
      const maxLen = Math.max(q.length, cand.length);
      const levScore = maxLen === 0 ? 1 : 1 - edits / maxLen;
      const diceScore = diceCoefficient(normalizeTitle(q), normalizeTitle(cand));
      const score = diceScore * DICE_WEIGHT_SEARCH + levScore * LEV_WEIGHT_SEARCH;
      if (score > bestScore) bestScore = score;
    }

    // Fuzzy PREFIX match: typo'd partial query against the start of the
    // full title, OR the start of any individual word in it.
    for (const target of [c, ...words]) {
      if (q.length >= target.length) continue;
      const prefixBudget = maxTypoBudget(q.length);
      const prefixEdits = prefixEditDistance(q, target);
      if (prefixEdits <= prefixBudget) {
        const prefixScore = 1 - prefixEdits / q.length;
        if (prefixScore > bestScore) bestScore = prefixScore;
      }
    }

    if (bestScore >= FUZZY_THRESHOLD) return { rank: 3, score: bestScore };
  }

  return null;
}

/**
 * Ranks a query against several candidate strings for the same item
 * (e.g. a title plus its individual words, or a title plus its tags)
 * and returns the single best match found, or null if none matched.
 */
export function bestSearchRank(query: string, candidates: string[]): SearchMatch | null {
  let best: SearchMatch | null = null;
  for (const candidate of candidates) {
    const match = searchRank(query, candidate);
    if (!match) continue;
    if (!best || match.rank < best.rank || (match.rank === best.rank && match.score > best.score)) {
      best = match;
    }
  }
  return best;
}

/** Simple boolean drop-in for filter predicates — matches if any candidate hits. */
export function matchesSearch(query: string, candidates: string | string[]): boolean {
  if (!query.trim()) return true; // empty query = show everything
  const list = Array.isArray(candidates) ? candidates : [candidates];
  return bestSearchRank(query, list) !== null;
}

/**
 * Comparator for sorting already-filtered results by relevance:
 * lower rank first, then higher fuzzy score first (only differentiates
 * within rank 3, since ranks 0-2 all carry score: 1).
 */
export function compareSearchRank(a: SearchMatch, b: SearchMatch): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return b.score - a.score;
}
