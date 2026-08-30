import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// Videasy (player.videasy.net -> videasy.to) — VidLink-style player.
// Emits MEDIA_DATA (JSON-string payload, keyed "movie-<id>" / "tv-<id>-<s>-<e>").
// Resumes via ?progress=<seconds>. One dismissible ad on first play.
export class VideasyProvider implements ProviderAdapter {
  name = 'Videasy';
  id = 'videasy';
  enabled = false; // has ads / pop-ups — opt-in via Settings
  timeoutMs = 9000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://player.videasy.net/movie/${tmdbId}?color=e50914`,
        referer: 'https://player.videasy.net',
        title: `${metadata.title} — Videasy (auto-resume)`,
        healthScore: 94,
        resumeParam: 'progress',
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}?color=e50914&nextEpisode=true&episodeSelector=true`,
        referer: 'https://player.videasy.net',
        title: `S${season}E${episode} — Videasy (auto-resume)`,
        healthScore: 94,
        resumeParam: 'progress',
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }
}
