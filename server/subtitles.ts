import { SubtitleTrack } from '../src/types/media.js';

export interface SubtitleSearchQuery {
  imdbId?: string;
  tmdbId?: number;
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
}

export async function fetchSubtitles(query: SubtitleSearchQuery): Promise<SubtitleTrack[]> {
  const tracks: SubtitleTrack[] = [];

  // Default common languages track list (vtt/srt)
  try {
    if (query.imdbId || query.tmdbId) {
      // Query OpenSubtitles / SubDL public endpoints
      const targetId = query.imdbId ? query.imdbId.replace('tt', '') : query.tmdbId;
      
      tracks.push({
        language: 'en',
        label: 'English [Default]',
        url: `/api/proxy/subtitles?id=${targetId}&lang=en&type=${query.season ? 'tv' : 'movie'}&s=${query.season || ''}&e=${query.episode || ''}`,
        provider: 'OpenSubtitles',
        default: true
      });

      tracks.push({
        language: 'es',
        label: 'Spanish (Español)',
        url: `/api/proxy/subtitles?id=${targetId}&lang=es&type=${query.season ? 'tv' : 'movie'}&s=${query.season || ''}&e=${query.episode || ''}`,
        provider: 'OpenSubtitles'
      });

      tracks.push({
        language: 'fr',
        label: 'French (Français)',
        url: `/api/proxy/subtitles?id=${targetId}&lang=fr&type=${query.season ? 'tv' : 'movie'}&s=${query.season || ''}&e=${query.episode || ''}`,
        provider: 'OpenSubtitles'
      });

      tracks.push({
        language: 'de',
        label: 'German (Deutsch)',
        url: `/api/proxy/subtitles?id=${targetId}&lang=de&type=${query.season ? 'tv' : 'movie'}&s=${query.season || ''}&e=${query.episode || ''}`,
        provider: 'OpenSubtitles'
      });

      tracks.push({
        language: 'ar',
        label: 'Arabic (العربية)',
        url: `/api/proxy/subtitles?id=${targetId}&lang=ar&type=${query.season ? 'tv' : 'movie'}&s=${query.season || ''}&e=${query.episode || ''}`,
        provider: 'SubDL'
      });
    }
  } catch (e) {
    console.warn(`[Subtitles] Fetch error:`, e);
  }

  return tracks;
}
