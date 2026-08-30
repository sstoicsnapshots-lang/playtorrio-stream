import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// VidFast (vidfast.pro -> vidfast.vc) — fast, low-ad, VidLink-style player.
// Emits MEDIA_DATA postMessages, resumes via ?startAt=<seconds>.
const COMMON = 'theme=E50914&title=false&poster=true';

export class VidFastProvider implements ProviderAdapter {
  name = 'VidFast';
  id = 'vidfast';
  enabled = true;
  timeoutMs = 8000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidfast.pro/movie/${tmdbId}?${COMMON}`,
        referer: 'https://vidfast.pro',
        title: `${metadata.title} — VidFast (fast, auto-resume)`,
        healthScore: 96,
        resumeParam: 'startAt',
        autoplayQuery: 'autoPlay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?${COMMON}&nextButton=true&autoNext=true`,
        referer: 'https://vidfast.pro',
        title: `S${season}E${episode} — VidFast (fast, auto-resume)`,
        healthScore: 96,
        resumeParam: 'startAt',
        autoplayQuery: 'autoPlay=true',
        supportsProgress: true
      })
    ];
  }
}
