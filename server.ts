import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fetchTmdb, normalizeTmdbItem } from './server/tmdb.js';
import { SourceAggregator, getProviderHealthList } from './server/aggregator.js';
import { aggregateLiveStreams } from './server/live/aggregator.js';
import { fetchSubtitles } from './server/subtitles.js';
import { fetchStremioManifest } from './server/providers/stremio.js';
import { DebridProvider } from './server/providers/debrid.js';
import { handleMediaProxy } from './server/proxy.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // -------------------------------------------------------------
  // TMDB Metadata Routes
  // -------------------------------------------------------------

  // Trending Movies / Series
  app.get('/api/tmdb/trending', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const page = Number(req.query.page) || 1;
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const data = await fetchTmdb(`/trending/${type}/week`, { page }, apiKey);
      const results = (data.results || []).map((item: any) => normalizeTmdbItem(item, type));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      console.error('[TMDB Trending error]', err);
      res.status(500).json({ error: err.message || 'Failed to fetch trending' });
    }
  });

  // Popular Movies / Series
  app.get('/api/tmdb/popular', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const page = req.query.page || 1;
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const data = await fetchTmdb(`/${type}/popular`, { page: Number(page) }, apiKey);
      const results = (data.results || []).map((item: any) => normalizeTmdbItem(item, type));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      console.error('[TMDB Popular error]', err);
      res.status(500).json({ error: err.message || 'Failed to fetch popular' });
    }
  });

  // Top Rated Movies / Series
  app.get('/api/tmdb/top_rated', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const page = req.query.page || 1;
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const data = await fetchTmdb(`/${type}/top_rated`, { page: Number(page) }, apiKey);
      const results = (data.results || []).map((item: any) => normalizeTmdbItem(item, type));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      console.error('[TMDB Top Rated error]', err);
      res.status(500).json({ error: err.message || 'Failed to fetch top rated' });
    }
  });

  // Upcoming Movies
  app.get('/api/tmdb/upcoming', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const page = Number(req.query.page) || 1;
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const endpoint = type === 'tv' ? '/tv/on_the_air' : '/movie/upcoming';
      const data = await fetchTmdb(endpoint, { page }, apiKey);
      const results = (data.results || []).map((item: any) => normalizeTmdbItem(item, type));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch upcoming' });
    }
  });

  // Genres
  app.get('/api/tmdb/genres', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const data = await fetchTmdb(`/genre/${type}/list`, {}, apiKey);
      res.json({ genres: data.genres || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch genres' });
    }
  });

  // Discover by Genre
  app.get('/api/tmdb/discover', async (req: Request, res: Response) => {
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const genreId = req.query.genreId as string;
    const page = req.query.page || 1;
    const apiKey = req.query.apiKey as string | undefined;
    try {
      const params: Record<string, string | number> = {
        page: Number(page),
        sort_by: 'popularity.desc'
      };
      if (genreId) params.with_genres = genreId;

      const data = await fetchTmdb(`/discover/${type}`, params, apiKey);
      const results = (data.results || []).map((item: any) => normalizeTmdbItem(item, type));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to discover' });
    }
  });

  // Search Multi / Movie / TV
  app.get('/api/tmdb/search', async (req: Request, res: Response) => {
    const query = req.query.query as string;
    const type = (req.query.type as string) || 'multi';
    const apiKey = req.query.apiKey as string | undefined;
    if (!query) {
      res.json({ results: [] });
      return;
    }

    try {
      let endpoint = '/search/multi';
      if (type === 'movie') endpoint = '/search/movie';
      if (type === 'tv') endpoint = '/search/tv';

      // Only movie/tv searches carry a definite type; multi / all must let
      // each result keep its own media_type from TMDB.
      const explicitType = type === 'movie' || type === 'tv' ? (type as 'movie' | 'tv') : undefined;

      const page = Number(req.query.page) || 1;
      const data = await fetchTmdb(endpoint, { query, page }, apiKey);
      const results = (data.results || [])
        .filter((item: any) => item.media_type !== 'person')
        .map((item: any) => normalizeTmdbItem(item, explicitType));
      res.json({ results, totalPages: data.total_pages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  });

  // Full Details (with Cast, Videos, Seasons, Recommendations)
  app.get('/api/tmdb/details', async (req: Request, res: Response) => {
    const id = req.query.id as string;
    const type = (req.query.type as string) === 'tv' ? 'tv' : 'movie';
    const apiKey = req.query.apiKey as string | undefined;

    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' });
      return;
    }

    try {
      const data = await fetchTmdb(`/${type}/${id}`, {
        append_to_response: 'credits,videos,recommendations,similar,external_ids'
      }, apiKey);

      const normalized = normalizeTmdbItem(data, type);
      
      // Attach IMDB id if available
      const imdbId = data.external_ids?.imdb_id || data.imdb_id;
      
      // Attach recommendations
      const recommendations = (data.recommendations?.results || data.similar?.results || [])
        .slice(0, 10)
        .map((item: any) => normalizeTmdbItem(item, type));

      res.json({
        item: {
          ...normalized,
          imdbId,
          recommendations
        }
      });
    } catch (err: any) {
      console.error('[TMDB Details error]', err);
      res.status(500).json({ error: err.message || 'Failed to fetch details' });
    }
  });

  // TV Season & Episodes
  app.get('/api/tmdb/season', async (req: Request, res: Response) => {
    const tvId = req.query.tvId as string;
    const seasonNumber = req.query.seasonNumber || '1';
    const apiKey = req.query.apiKey as string | undefined;

    if (!tvId) {
      res.status(400).json({ error: 'Missing tvId parameter' });
      return;
    }

    try {
      const data = await fetchTmdb(`/tv/${tvId}/season/${seasonNumber}`, {}, apiKey);
      const episodes = (data.episodes || []).map((ep: any) => ({
        id: ep.id,
        episodeNumber: ep.episode_number,
        seasonNumber: ep.season_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || '',
        stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
        airDate: ep.air_date,
        runtime: ep.runtime,
        voteAverage: Number((ep.vote_average || 0).toFixed(1))
      }));

      res.json({
        season: {
          id: data.id,
          seasonNumber: data.season_number,
          name: data.name,
          overview: data.overview,
          episodes
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch season episodes' });
    }
  });

  // -------------------------------------------------------------
  // Source Resolution & Aggregation
  // -------------------------------------------------------------
  // Short-lived cache so re-clicking the same title/episode is instant.
  const resolveCache = new Map<string, { data: any; expiry: number }>();
  const RESOLVE_TTL_MS = 4 * 60 * 1000;

  const handleResolveSources = async (req: Request, res: Response) => {
    const params = req.method === 'GET' ? req.query : req.body;
    const {
      tmdbId,
      type = 'movie',
      season = 1,
      episode = 1,
      title = 'Unknown Title',
      year,
      imdbId,
      options = {}
    } = params;

    if (!tmdbId) {
      res.status(400).json({ error: 'Missing tmdbId parameter' });
      return;
    }

    const optObj = typeof options === 'string' ? JSON.parse(options) : options;
    const cacheKey = JSON.stringify({
      tmdbId, type, season, episode,
      pe: optObj?.providersEnabled,
      db: !!optObj?.debridConfig && optObj.debridConfig.service !== 'none',
      addons: (optObj?.stremioAddons || []).map((a: any) => a.enabled && a.manifestUrl)
    });
    const hit = resolveCache.get(cacheKey);
    if (hit && hit.expiry > Date.now()) {
      res.json(hit.data);
      return;
    }

    try {
      // Torrentio and other Stremio addons are IMDb-only. If the client didn't
      // supply an IMDb id, resolve it from TMDB (capped so a slow TMDB can't
      // stall the whole resolve — torrent providers just miss out that once).
      let resolvedImdb = imdbId as string | undefined;
      if (!resolvedImdb) {
        resolvedImdb = await Promise.race([
          fetchTmdb<any>(`/${type === 'tv' ? 'tv' : 'movie'}/${Number(tmdbId)}/external_ids`)
            .then((ext) => ext?.imdb_id || undefined)
            .catch(() => undefined),
          new Promise<undefined>((r) => setTimeout(() => r(undefined), 2500))
        ]);
      }

      const aggregator = new SourceAggregator(optObj);
      const result = await aggregator.resolveAll({
        tmdbId: Number(tmdbId),
        type: type as any,
        season: Number(season),
        episode: Number(episode),
        title: title as string,
        year: year ? Number(year) : undefined,
        imdbId: resolvedImdb
      });

      if (result.sources && result.sources.length > 0) {
        resolveCache.set(cacheKey, { data: result, expiry: Date.now() + RESOLVE_TTL_MS });
        if (resolveCache.size > 300) {
          for (const [k, v] of resolveCache) if (v.expiry < Date.now()) resolveCache.delete(k);
        }
      }
      res.json(result);
    } catch (err: any) {
      console.error('[Source Aggregator error]', err);
      res.status(500).json({
        error: err.message || 'Failed to resolve sources',
        sources: [],
        results: []
      });
    }
  };

  app.post('/api/resolve/sources', handleResolveSources);
  app.get('/api/resolve/sources', handleResolveSources);

  // Provider Health
  app.get('/api/provider/health', (req: Request, res: Response) => {
    res.json({ health: getProviderHealthList() });
  });

  // -------------------------------------------------------------
  // Live Streams Aggregator
  // -------------------------------------------------------------
  app.get('/api/live/streams', async (req: Request, res: Response) => {
    const { dami, ppv, cdnLive, dlstreams, m3uUrl } = req.query;
    try {
      const events = await aggregateLiveStreams({
        damiEnabled: dami !== 'false',
        ppvEnabled: ppv !== 'false',
        cdnLiveEnabled: cdnLive !== 'false',
        dlStreamsEnabled: dlstreams !== 'false',
        customM3uUrl: m3uUrl as string | undefined
      });
      res.json({ events });
    } catch (err: any) {
      console.error('[Live Streams error]', err);
      res.status(500).json({ error: err.message || 'Failed to fetch live streams', events: [] });
    }
  });

  // -------------------------------------------------------------
  // Subtitles API
  // -------------------------------------------------------------
  app.get('/api/subtitles', async (req: Request, res: Response) => {
    const { imdbId, tmdbId, season, episode, title, year } = req.query;
    try {
      const tracks = await fetchSubtitles({
        imdbId: imdbId as string | undefined,
        tmdbId: tmdbId ? Number(tmdbId) : undefined,
        season: season ? Number(season) : undefined,
        episode: episode ? Number(episode) : undefined,
        title: title as string | undefined,
        year: year ? Number(year) : undefined
      });
      res.json({ tracks });
    } catch (err: any) {
      res.status(500).json({ tracks: [] });
    }
  });

  // -------------------------------------------------------------
  // Stremio Addon Test / Manifest
  // -------------------------------------------------------------
  app.post('/api/stremio/manifest', async (req: Request, res: Response) => {
    const { manifestUrl } = req.body;
    if (!manifestUrl) {
      res.status(400).json({ error: 'Missing manifestUrl' });
      return;
    }
    const addon = await fetchStremioManifest(manifestUrl);
    if (!addon) {
      res.status(404).json({ error: 'Could not fetch or parse Stremio manifest' });
      return;
    }
    res.json({ addon });
  });

  // -------------------------------------------------------------
  // Debrid Unrestrict API
  // -------------------------------------------------------------
  app.post('/api/debrid/unrestrict', async (req: Request, res: Response) => {
    const { service, apiKey, link } = req.body;
    if (!service || !apiKey || !link) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const debrid = new DebridProvider({ service, apiKey });
    const source = await debrid.unrestrict(link);
    if (!source) {
      res.status(404).json({ error: 'Failed to unrestrict link' });
      return;
    }
    res.json({ source });
  });

  // -------------------------------------------------------------
  // Media & Stream Proxy (Range + CORS + Headers)
  // -------------------------------------------------------------
  app.get('/api/proxy/media', handleMediaProxy);

  // -------------------------------------------------------------
  // Vite Integration (SPA Fallback)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    // Dev only — imported dynamically so the production bundle doesn't need vite.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // In a packaged build the assets sit next to the server bundle.
    const distPath = process.env.DIST_PATH || path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[PlayTorrio Stream] Server running on http://localhost:${PORT}`);
  });
}

startServer();
