import { z } from "zod";

// Only use zod for runtime validation of external data
// (e.g., from the scraper or API responses).
// For internal data structures, use TypeScript types and interfaces.

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

export const ScrapedChapterSchema = z.object({
  number: z.number(), // signifies i + 1 instead of doing i + 1 everywhere
  label: z.string(), // e.g. "Chapter 244", "Chp. 2.5"
  url: z.url(),
  read: z.boolean()
});

export type ScrapedChapter = z.infer<typeof ScrapedChapterSchema>;

export type DraftChapter = Omit<ScrapedChapter, "number" | "read">;

export interface ChapterScraperItem {
  anchors: Element[];
  chapters: ScrapedChapter[];
}

export const ScrapedManhwaSchema = z.object({
  title: z.string(),
  coverUrl: z.string().nullable(),
  description: z.string().nullable(),
  totalChapters: z.number(),
  chapters: z.array(ScrapedChapterSchema),
  sourceUrl: z.url()
});

export type ScrapedManhwa = z.infer<typeof ScrapedManhwaSchema>;

// Types for the main library data structure
export const ReadStatusSchema = z.enum(["Reading", "Plan To Read", "Completed", "Dropped", "On Hold"]);
export type ReadStatus = z.infer<typeof ReadStatusSchema>;

export const TagsSchema = z.object({
  tagName: z.string(),
  isCustom: z.boolean(),
  hidden: z.boolean()
});

export type Tags = z.infer<typeof TagsSchema>;

export const ManhwaSchema = z.object({
  id: z.string(), // crypto.randomUUID() at creation time
  title: z.string(),
  description: z.string().optional(),
  descriptionOpen: z.boolean().optional(),
  sourceUrl: z.url(), // link back to where you read it
  coverUrl: z.string().optional(), // optional — you may not always capture one
  status: ReadStatusSchema,
  favorite: z.boolean(), // if you want to mark it as a favorite
  hidden: z.boolean(), // if you want to hide it from the library view
  currentChapter: z.number(),
  totalChapters: z.number(),
  chapters: z.array(ScrapedChapterSchema),
  tags: z.array(TagsSchema),
  ogTags: z.array(TagsSchema), // original tags from the source, for reference
  rating: z.number().nullable().optional(), // optional — 1-10 allows decimal ratings like 7.5
  notes: z.string().optional(),
  createdAt: z.number(), // Date.now()
  updatedAt: z.number(),
  completedOn: z.number().nullable().optional(), // optional —  can also be null if you want to clear it
  startedOn: z.number().nullable().optional() // optional — can also be null if you want to clear it
});

export type Manhwa = z.infer<typeof ManhwaSchema>;

export const ManhwaExportSchema = ManhwaSchema.extend({
  coverImage: z.string().optional() // base64-encoded webp blob, from the cover cache
});
export type ManhwaExport = z.infer<typeof ManhwaExportSchema>;

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

// Setting config types 
export const SettingsConfigSchema = z.object({
  importOption: z.enum(["skip", "overwrite"]),
  markUnreadOne: z.boolean(),
  includeImages: z.boolean(),
});
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;

// Import/Export types
export const LibraryExportSchema = z.object({
  version: z.number(),
  exportedAt: z.number(),
  manhwas: z.array(ManhwaExportSchema)
});

export type LibraryExport = z.infer<typeof LibraryExportSchema>;

export const ImportResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  errors: z.array(z.string())
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

export type ImportOptions = {
  onConflict: "skip" | "overwrite";
};

export interface ImportProgress {
  current: number;
  total: number;
  title: string;
}

// Toast type
export interface ToastItem {
  id: number;
  message: string;
  duration: number;
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
