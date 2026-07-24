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
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: SEARCH_MANGA_TAGS_QUERY,
      variables: { search: title }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.statusText}`);
  }

  const json: AniListResponse = await response.json();
  return json.data.Media;
}
