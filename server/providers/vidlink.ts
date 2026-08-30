import { ProviderAdapter, ProviderMetadata, embedSource } from './base.js';
import { StreamSource } from '../../src/types/media.js';

// VidLink (vidlink.pro) — ad-free, emits MEDIA_DATA + PLAYER_EVENT postMessages,
// resumes via ?startAt=<seconds>. Primary provider.
const COMMON = 'primaryColor=e50914&secondaryColor=170b0b&iconColor=e50914&title=false&poster=true';

export class VidLinkProvider implements ProviderAdapter {
  name = 'VidLink';
  id = 'vidlink';
  enabled = true;
  timeoutMs = 8000;

  async resolveMovie(tmdbId: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidlink.pro/movie/${tmdbId}?${COMMON}`,
        referer: 'https://vidlink.pro',
        title: `${metadata.title} — VidLink (ad-free, auto-resume)`,
        healthScore: 98,
        resumeParam: 'startAt',
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }

  async resolveEpisode(tmdbId: number, season: number, episode: number, metadata: ProviderMetadata): Promise<StreamSource[]> {
    return [
      embedSource({
        provider: this.name,
        url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?${COMMON}&nextButton=true&autoNext=true`,
        referer: 'https://vidlink.pro',
        title: `S${season}E${episode} — VidLink (ad-free, auto-resume)`,
        healthScore: 98,
        resumeParam: 'startAt',
        autoplayQuery: 'autoplay=true',
        supportsProgress: true
      })
    ];
  }
}
