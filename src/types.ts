export type ReadStatus = 'Reading' | 'Plan To Read' | 'Completed' | 'Dropped'

export interface ScrapedChapter {
  number: number
  label: string   // e.g. "Chapter 244", "Chp. 2.5"
  url: string
  read: boolean
}

export interface ScrapedManhwa {
  title: string
  coverUrl: string | null
  description: string | null
  totalChapters: number | null
  chapters: ScrapedChapter[]
  sourceUrl: string
}

export interface Manhwa {
  id: string           // crypto.randomUUID() at creation time
  title: string
  description?: string 
  descriptionOpen?: boolean
  sourceUrl: string     // link back to where you read it
  coverUrl?: string      // optional — you may not always capture one
  status: ReadStatus
  favorite?: boolean // optional — if you want to mark it as a favorite
  hidden?: boolean // optional — if you want to hide it from the library view
  currentChapter: number
  totalChapters?: number // optional — often unknown/ongoing
  chapters: ScrapedChapter[]
  tags: string[]
  rating?: number       // optional — 1-10 allows decimal ratings like 7.5
  notes?: string
  createdAt: number      // Date.now()
  updatedAt: number
}


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

// Sorting Field and Direction Types
export type SortField = "Title" | "Recently Added" | "Recently Updated" | "Rating" | "Progress";
export type SortDirection = "asc" | "desc";