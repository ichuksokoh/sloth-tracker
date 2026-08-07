// Types for the Scraper
// For chapter/episode scraping/manhwa data extraction
export type ChapterUnit = "Ch." | "Ep.";

export interface ChapterMatch {
  number: number;
  unit: ChapterUnit;
  volume?: string;
}

export interface TitleCandidate {
  title: string;
  sources: Set<string>;
}

export interface ScrapedChapter {
  number: number; // signifies i + 1 instead of doing i + 1 everywhere
  label: string; // e.g. "Chapter 244", "Chp. 2.5"
  url: string;
  read: boolean;
}

export type DraftChapter = Omit<ScrapedChapter, "number" | "read">;

export interface ChapterScraperItem {
  anchors: Element[];
  chapters: ScrapedChapter[];
}

export interface ScrapedManhwa {
  title: string;
  coverUrl: string | null;
  description: string | null;
  totalChapters: number;
  chapters: ScrapedChapter[];
  sourceUrl: string;
}

// Types for the main library data structure
export type ReadStatus = "Reading" | "Plan To Read" | "Completed" | "Dropped" | "On Hold";
export type Tags = { tagName: string; isCustom: boolean; hidden: boolean };

export interface Manhwa {
  id: string; // crypto.randomUUID() at creation time
  title: string;
  description?: string;
  descriptionOpen?: boolean;
  sourceUrl: string; // link back to where you read it
  coverUrl?: string; // optional — you may not always capture one
  status: ReadStatus;
  favorite: boolean; // optional — if you want to mark it as a favorite
  hidden: boolean; // optional — if you want to hide it from the library view
  currentChapter: number;
  totalChapters: number;
  chapters: ScrapedChapter[];
  tags: Tags[];
  ogTags: Tags[]; // original tags from the source, for reference
  rating?: number | null; // optional — 1-10 allows decimal ratings like 7.5
  notes?: string;
  createdAt: number; // Date.now()
  updatedAt: number;
  completedOn?: number | null; // optional —  can also be null if you want to clear it
  startedOn?: number | null; // optional — can also be null if you want to clear it
}

// Sorting Field and Direction Types
export type SortField =
  | "Title"
  | "Recently Added"
  | "Recently Updated"
  | "Rating"
  | "Progress"
  | "Recently Completed";
export type SortDirection = "asc" | "desc";

// Tag Tracker type
export interface TagTracker {
  // if hiddenCount > 0, this tag is hidden
  // if count > 0, this tag is not hidden
  count: number; // For UI tracking and removal of custom tags
  hiddenCount: number; // For UI tracking hidden tags and removal of custom tags
  active: boolean; // FOr UI filtering
  custom: boolean; //  if true, this tag was added by the user and not scraped from a source
  ogCount: number; // tracks count aside from what user sees
}

// API Types
// Anilist API data types (for the "import from Anilist" feature)// types.ts
export interface MediaTag {
  id: number;
  name: string;
  description: string;
  category: string;
  rank: number;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
  isAdult: boolean;
}

export interface MediaTitle {
  romaji?: string;
  english?: string;
  native?: string;
}

export interface MediaResult {
  id: number;
  title: MediaTitle;
  description: string | null;
  format: string;
  countryOfOrigin: string;
  genres: string[];
  tags: MediaTag[];
}

export interface AniListResponse {
  data: {
    Media: MediaResult | null;
  };
}

// Kitsu API types
export interface KitsuPosterImage {
  tiny: string;
  small: string;
  medium: string;
  large: string;
  original: string;
}

export interface KitsuMangaAttributes {
  canonicalTitle: string;
  titles: Record<string, string>;
  abbreviatedTitles: string[];
  synopsis: string | null;
  startDate: string | null;
  posterImage: KitsuPosterImage | null;
  subtype: string; // "manga" | "manhwa" | "manhua" | "novel" | "oneshot" | "doujin"
}

export interface KitsuMangaRaw {
  id: string;
  type: "manga";
  attributes: KitsuMangaAttributes;
}

// Flattened result shape — this is what getKitsuManga/fetchKitsuByTitle
// actually return, distinct from the raw JSON:API resource (KitsuMangaRaw).
export interface KitsuManga {
  id: string;
  title: string;
  description: string;
  genres: string[];
  imageUrl: string;
  format: string; // "manga" | "manhwa" | "manhua" | "novel" | "oneshot" | "doujin"
  source: "kitsu";
}

export interface KitsuCategoryRaw {
  id: string;
  type: "categories";
  attributes: {
    title: string;
  };
}
export interface KitsuSearchResponse {
  data: KitsuMangaRaw[];
}

export interface KitsuMangaDetailResponse {
  data: KitsuMangaRaw;
  included?: KitsuCategoryRaw[];
}
