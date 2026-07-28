import type { AniListResponse, MediaResult } from "@/types";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const SEARCH_MANGA_TAGS_QUERY = `
  query ($search: String) {
    Media (search: $search, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      description
      format
      countryOfOrigin
      genres
      tags {
        id
        name
        category
        rank
        isMediaSpoiler
        isAdult
      }
    }
  }
`;

export async function fetchMangaTags(title: string): Promise<MediaResult | null> {
  const fixedTitle = title
    .replace(/\([^)]*\)/g, "") // 1. Remove ()
    .replace(/\[[^\]]*\]/g, "") // 2. Remove []
    .replace(/(\w+)['’`‘]s\b/gi, (match, word) => {
      // 3. Keep 'it's', remove other possessives (e.g. "Swordmaster's" -> "Swordmaster")
      return word.toLowerCase() === "it" ? match : word;
    })
    .replace(/[^\w\s,'’`-]/g, "") // 4. Clean non-alphanumerics, keeping straight/curly apostrophes for contractions, spaces, commas, hyphens
    .replace(/\s+/g, " ") // 5. Normalize spaces
    .trim(); // 6. Trim leading/trailing spaces
  console.log("Fixed title for AniList search:", fixedTitle);
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: SEARCH_MANGA_TAGS_QUERY,
      variables: { search: fixedTitle }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${await response.text()}`);
  }

  const json: AniListResponse = await response.json();
  return json.data.Media;
}
