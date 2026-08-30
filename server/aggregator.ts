import { ProviderAdapter, ProviderMetadata } from './providers/base.js';
import { VidLinkProvider } from './providers/vidlink.js';
import { VidFastProvider } from './providers/vidfast.js';
import { VideasyProvider } from './providers/videasy.js';
import { VidsrcProvider } from './providers/vidsrc.js';
import { VixSrcProvider } from './providers/vixsrc.js';
import { VidRockProvider } from './providers/vidrock.js';
import { VidJoyProvider } from './providers/vidjoy.js';
import { WebStreamrProvider, WebStreamrConfig } from './providers/webstreamr.js';
import { StremioProvider } from './providers/stremio.js';
import { TorrentScraperProvider } from './providers/torrents.js';
import { DebridProvider, DebridConfig } from './providers/debrid.js';
import { StreamSource, ProviderHealth, ProviderResolutionResult, StremioAddon } from '../src/types/media.js';

// In-memory provider health tracker
const providerHealthMap = new Map<string, ProviderHealth>();

export function getProviderHealthList(): ProviderHealth[] {
  return Array.from(providerHealthMap.values());
}

export function updateProviderHealth(providerId: string, name: string, success: boolean, responseTimeMs?: number) {
  let record = providerHealthMap.get(providerId);
  if (!record) {
    record = {
      providerId,
      name,
      status: 'working',
      lastChecked: Date.now(),
      enabled: true,
      successCount: 0,
      failureCount: 0,
      responseTimeMs
    };
  }

  record.lastChecked = Date.now();
  if (responseTimeMs) record.responseTimeMs = responseTimeMs;

  if (success) {
    record.successCount++;
    record.status = (record.responseTimeMs && record.responseTimeMs > 4000) ? 'slow' : 'working';
  } else {
    record.failureCount++;
    if (record.failureCount >= 3) {
      record.status = 'failed';
    }
  }

  providerHealthMap.set(providerId, record);
}

// -------------------------------------------------------------
// Embed-domain liveness cache
// -------------------------------------------------------------
// Embed URLs for a given domain are structurally identical, so we probe the
// domain (not each title URL) and cache the verdict. This keeps dead/slow hosts
// out of the results without adding latency on the common (cached) path.
type Liveness = 'ok' | 'dead' | 'unknown';
interface DomainHealth { state: Liveness; ms: number; checkedAt: number }
const domainHealth = new Map<string, DomainHealth>();
const inFlightProbes = new Set<string>();
const DOMAIN_TTL_MS = 10 * 60 * 1000;
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function domainOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

// Non-blocking: return the cached verdict immediately ('unknown' if we've never
// probed this host), and kick off a background refresh when the cache is missing
// or stale. Resolve requests never wait on a probe — the worst case for a brand
// new / dead host is that it shows once before the next request drops it.
function getHealth(url: string, referer: string): DomainHealth {
  const host = domainOf(url);
  const cached = domainHealth.get(host);
  if (!cached || Date.now() - cached.checkedAt > DOMAIN_TTL_MS) {
    void refreshHealth(host, url, referer);
  }
  return cached || { state: 'unknown', ms: 0, checkedAt: 0 };
}

async function refreshHealth(host: string, url: string, referer: string): Promise<void> {
  if (inFlightProbes.has(host)) return;
  inFlightProbes.add(host);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, Referer: referer, Accept: 'text/html' },
      signal: AbortSignal.timeout(3000)
    });
    const ms = Date.now() - start;
    // Definitive negatives only. Cloudflare 403/429 and timeouts stay 'unknown'
    // (kept in results) since those hosts work in a real browser.
    const state: Liveness = res.status === 404 || res.status >= 500 ? 'dead' : 'ok';
    domainHealth.set(host, { state, ms, checkedAt: Date.now() });
  } catch (err: any) {
    const name = err?.name || '';
    const state: Liveness =
      name === 'TimeoutError' || name === 'AbortError' ? 'unknown' : 'dead';
    domainHealth.set(host, { state, ms: Date.now() - start, checkedAt: Date.now() });
  } finally {
    inFlightProbes.delete(host);
  }
}

export interface AggregatorOptions {
  providersEnabled?: Record<string, boolean>;
  stremioAddons?: StremioAddon[];
  debridConfig?: DebridConfig;
  webstreamrConfig?: WebStreamrConfig;
}

export class SourceAggregator {
  providers: ProviderAdapter[] = [];
  debridProvider: DebridProvider;

  constructor(options: AggregatorOptions = {}) {
    this.debridProvider = new DebridProvider(options.debridConfig);

    const defaultAddons: StremioAddon[] = options.stremioAddons || [
      {
        id: 'torrentio',
        name: 'Torrentio (Default)',
        manifestUrl:
          'https://torrentio.strem.fun/sort=qualitysize|qualityfilter=other,scr,cam/manifest.json',
        enabled: true
      }
    ];

    // Order = default preference. Tier 1 (ad-free / progress postMessage / fast)
    // first, then aggregators, then torrents.
    this.providers = [
      new VidLinkProvider(),
      new VidFastProvider(),
      new VideasyProvider(),
      new VixSrcProvider(),
      new VidsrcProvider(),
      new VidRockProvider(),
      new VidJoyProvider(),
      new WebStreamrProvider(options.webstreamrConfig),
      new StremioProvider(defaultAddons),
      new TorrentScraperProvider(this.debridProvider)
    ];

    // Apply enabled/disabled state
    if (options.providersEnabled) {
      for (const p of this.providers) {
        if (options.providersEnabled[p.id] !== undefined) {
          p.enabled = options.providersEnabled[p.id];
        }
      }
    }

    // Keep individual providers snappy — the network ones are the only slow part.
    for (const p of this.providers) {
      if (p.timeoutMs > 6000) p.timeoutMs = 6000;
    }
  }

  // Calculate rank score
  private scoreSource(s: StreamSource): number {
    let score = 0;

    // 1. Direct debrid cached stream — always best
    if (s.isDebrid) score += 600;

    // 2. Provider tier
    const p = s.provider.toLowerCase();
    if (p.includes('vidlink')) score += 420;
    else if (p.includes('vidfast')) score += 400;
    else if (p.includes('videasy')) score += 370;
    else if (p.includes('vixsrc')) score += 340;
    else if (p.includes('vidsrc')) score += 300;
    else if (p.includes('vidrock')) score += 250;
    else if (p.includes('vidjoy')) score += 230;
    else score += 200;

    // 3. Emits watch progress + supports resume -> better "continue watching"
    if (s.supportsProgress) score += 60;
    if (s.resumeParam) score += 40;

    // 4. Resolution
    switch (s.quality) {
      case '4K': score += 200; break;
      case '1080p': score += 150; break;
      case '720p': score += 100; break;
      case '480p': score += 50; break;
      default: score += 75; break;
    }

    // 5. Health score hint from provider
    if (s.healthScore) score += s.healthScore * 2;

    // 6. Live probe latency: faster host ranks higher (0..120 pts)
    if (typeof s.pingMs === 'number') {
      score += Math.max(0, 120 - Math.round(s.pingMs / 40));
    }

    // 7. Provider health tracker
    const health = providerHealthMap.get(s.provider.toLowerCase());
    if (health?.status === 'working') score += 50;
    else if (health?.status === 'slow') score += 20;

    // Torrent seeds bonus
    if (s.seeds) score += Math.min(80, s.seeds * 2);

    return score;
  }

  async resolveAll(metadata: ProviderMetadata): Promise<{
    sources: StreamSource[];
    results: ProviderResolutionResult[];
    bestSource?: StreamSource;
    hiddenTorrentCount?: number;
    debridConfigured?: boolean;
  }> {
    const activeProviders = this.providers.filter(p => p.enabled);
    const results: ProviderResolutionResult[] = [];

    // Run all providers concurrently with individual timeouts
    const promises = activeProviders.map(async (provider) => {
      const startTime = Date.now();
      try {
        let sourcesPromise: Promise<StreamSource[]>;
        if (metadata.type === 'movie') {
          sourcesPromise = provider.resolveMovie(metadata.tmdbId, metadata);
        } else {
          sourcesPromise = provider.resolveEpisode(
            metadata.tmdbId,
            metadata.season || 1,
            metadata.episode || 1,
            metadata
          );
        }

        const timeoutPromise = new Promise<StreamSource[]>((_, reject) =>
          setTimeout(() => reject(new Error('Provider timeout')), provider.timeoutMs)
        );

        const sources = await Promise.race([sourcesPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        updateProviderHealth(provider.id, provider.name, sources.length > 0, duration);

        return {
          provider: provider.name,
          success: sources.length > 0,
          sources,
          durationMs: duration
        };
      } catch (err: any) {
        const duration = Date.now() - startTime;
        updateProviderHealth(provider.id, provider.name, false, duration);
        return {
          provider: provider.name,
          success: false,
          sources: [],
          error: err?.message || 'Resolution failed',
          durationMs: duration
        };
      }
    });

    // Hard ceiling on the provider phase: whatever has resolved by then is what
    // we return. The embed providers are synchronous, so results appear fast and
    // a slow Torrentio/WebStreamr can't hold the whole request hostage.
    const tracked = promises.map((p) => {
      const box = { done: false, value: null as any };
      p.then((v) => { box.done = true; box.value = v; });
      return box;
    });
    await Promise.race([
      Promise.allSettled(promises),
      new Promise((r) => setTimeout(r, 4000))
    ]);
    const allSources: StreamSource[] = [];
    for (const box of tracked) {
      if (box.done && box.value) {
        results.push(box.value);
        if (box.value.sources) allSources.push(...box.value.sources);
      }
    }

    // Deduplicate URLs
    const seenUrls = new Set<string>();
    const deduplicated: StreamSource[] = [];
    for (const src of allSources) {
      if (!src.url) continue;
      if (!seenUrls.has(src.url)) {
        seenUrls.add(src.url);
        deduplicated.push(src);
      }
    }

    // Apply cached embed-host liveness (instant — probes refresh in the
    // background). Only confirmed-dead hosts are dropped.
    for (const s of deduplicated) {
      if (s.type !== 'embed') continue;
      const health = getHealth(s.url, s.headers?.Referer || domainOf(s.url));
      if (health.ms) s.pingMs = health.ms;
      (s as any).__dead = health.state === 'dead';
    }
    const alive = deduplicated.filter(s => !(s as any).__dead);
    let pool = alive.length > 0 ? alive : deduplicated;
    for (const s of pool) delete (s as any).__dead;

    // Convert magnet links to direct streams via debrid when configured. The
    // client can't play magnets on its own, so without this torrent sources
    // (Torrentio, YTS, EZTV) are dead weight.
    if (this.debridProvider.isConfigured()) {
      const magnets = pool.filter(s => s.type === 'magnet').slice(0, 12);
      const converted = await Promise.allSettled(
        magnets.map(async (m) => {
          const direct = await this.debridProvider.unrestrict(m.url).catch(() => null);
          if (direct) {
            direct.title = m.title || direct.title;
            direct.quality = m.quality;
            direct.seeds = m.seeds;
            direct.provider = `${m.provider} → Debrid`;
          }
          return { magnet: m, direct };
        })
      );
      const replaced = new Map<string, StreamSource>();
      for (const r of converted) {
        if (r.status === 'fulfilled' && r.value.direct) {
          replaced.set(r.value.magnet.url, r.value.direct);
        }
      }
      if (replaced.size > 0) {
        pool = pool.map(s => replaced.get(s.url) || s);
      }
    }

    // Raw magnets (no debrid, or conversion failed) play through the Webtor.io
    // embed on the client — Webtor's servers fetch the torrent and transcode to
    // HLS, so the user's device never joins the swarm. Keep the best-seeded few
    // (the long tail is mostly dead torrents) and drop the rest.
    const qRank: Record<string, number> = { '4K': 4, '1080p': 3, '720p': 2, '480p': 1 };
    const rawMagnets = pool
      .filter(s => s.type === 'magnet' || s.type === 'torrent')
      .sort((a, b) =>
        (b.seeds || 0) - (a.seeds || 0) ||
        (qRank[b.quality] || 0) - (qRank[a.quality] || 0)
      );
    const keptMagnets = new Set(rawMagnets.slice(0, 15));
    const hiddenTorrentCount = Math.max(0, rawMagnets.length - keptMagnets.size);
    pool = pool.filter(s => (s.type !== 'magnet' && s.type !== 'torrent') || keptMagnets.has(s));
    for (const s of pool) {
      if ((s.type === 'magnet' || s.type === 'torrent') && !s.isDebrid) {
        const src = /eztv/i.test(s.provider) ? 'EZTV' : /yts/i.test(s.provider) ? 'YTS' : 'Torrent';
        s.provider = `${src} · Webtor`;
      }
    }

    // Score and rank
    const ranked = pool.sort((a, b) => this.scoreSource(b) - this.scoreSource(a));
    ranked.forEach((s, idx) => { s.rank = idx + 1; });

    return {
      sources: ranked,
      results,
      bestSource: ranked[0],
      hiddenTorrentCount,
      debridConfigured: this.debridProvider.isConfigured()
    };
  }
}
