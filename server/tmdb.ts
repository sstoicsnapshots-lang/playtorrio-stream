import dotenv from 'dotenv';
dotenv.config();

// Standard public TMDB v3 API key used across open-source media clients.
// Override with the TMDB_API_KEY env var or a custom key from the UI.
const DEFAULT_TMDB_KEYS = [
  '8412f7e0274496c35f8183232ff54646'
];

const BASE_URL = 'https://api.themoviedb.org/3';

// Simple in-memory cache with TTL (15 minutes)
interface CacheEntry<T> {
  data: T;
  expiry: number;
}
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttlMs = 15 * 60 * 1000) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

function getAllPossibleKeys(customKey?: string): string[] {
  const keys: string[] = [];
  if (customKey && customKey.trim().length > 5) {
    keys.push(customKey.trim());
  }
  if (process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim().length > 5) {
    keys.push(process.env.TMDB_API_KEY.trim());
  }
  for (const k of DEFAULT_TMDB_KEYS) {
    if (!keys.includes(k)) {
      keys.push(k);
    }
  }
  return keys;
}

export async function fetchTmdb<T = any>(endpoint: string, params: Record<string, string | number | undefined> = {}, customKey?: string): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const keysToTry = getAllPossibleKeys(customKey);
  
  // Clean params
  const queryParams: Record<string, string> = {
    language: 'en-US'
  };
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      queryParams[key] = String(value);
    }
  }

  const cacheKey = `${normalizedEndpoint}?${new URLSearchParams(queryParams).toString()}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  let lastError: any = null;

  for (const apiKey of keysToTry) {
    const url = new URL(`${BASE_URL}${normalizedEndpoint}`);
    url.searchParams.set('api_key', apiKey);
    for (const [k, v] of Object.entries(queryParams)) {
      url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as T;
        setCache(cacheKey, data);
        return data;
      }

      // If unauthorized (401) or forbidden (403), try next key
      if (res.status === 401 || res.status === 403) {
        lastError = new Error(`TMDB error ${res.status}: ${res.statusText}`);
        continue;
      }

      // If 404 or other error, record error and break or retry
      lastError = new Error(`TMDB error ${res.status}: ${res.statusText}`);
      if (res.status === 404) {
        // Break early if 404
        break;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
    }
  }

  throw lastError || new Error('TMDB request failed');
}

export interface TmdbNormalizedItem {
  id: number;
  tmdbId: number;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage: number;
  voteCount: number;
  mediaType: 'movie' | 'tv';
  genreIds?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  cast?: any[];
  trailerKey?: string;
  seasons?: any[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
}

export function normalizeTmdbItem(raw: any, explicitType?: 'movie' | 'tv'): TmdbNormalizedItem {
  const mediaType =
    explicitType === 'movie' || explicitType === 'tv'
      ? explicitType
      : raw.media_type === 'movie' || raw.media_type === 'tv'
        ? raw.media_type
        : raw.title || raw.release_date
          ? 'movie'
          : 'tv';
  const title = raw.title || raw.name || raw.original_title || raw.original_name || 'Untitled';
  
  let trailerKey: string | undefined;
  if (raw.videos?.results) {
    const trailer = raw.videos.results.find((v: any) => 
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    ) || raw.videos.results.find((v: any) => v.site === 'YouTube');
    if (trailer) trailerKey = trailer.key;
  }

  const cast = raw.credits?.cast?.slice(0, 12).map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
  }));

  const seasons = raw.seasons?.map((s: any) => ({
    id: s.id,
    seasonNumber: s.season_number,
    name: s.name,
    overview: s.overview,
    episodeCount: s.episode_count,
    airDate: s.air_date,
    posterPath: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : null
  }));

  return {
    id: raw.id,
    tmdbId: raw.id,
    title,
    originalTitle: raw.original_title || raw.original_name,
    overview: raw.overview || '',
    posterPath: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null,
    backdropPath: raw.backdrop_path ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}` : null,
    releaseDate: raw.release_date,
    firstAirDate: raw.first_air_date,
    voteAverage: Number((raw.vote_average || 0).toFixed(1)),
    voteCount: raw.vote_count || 0,
    mediaType,
    genreIds: raw.genre_ids,
    genres: raw.genres,
    runtime: raw.runtime || (raw.episode_run_time && raw.episode_run_time[0]) || undefined,
    status: raw.status,
    tagline: raw.tagline,
    cast,
    trailerKey,
    seasons,
    numberOfSeasons: raw.number_of_seasons,
    numberOfEpisodes: raw.number_of_episodes
  };
}
