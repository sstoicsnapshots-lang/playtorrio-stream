import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Settings,
  Subtitles,
  Layers,
  SkipForward,
  ChevronLeft,
  Loader2,
  PictureInPicture,
  Tv,
  Check,
  Film
} from 'lucide-react';
import { MediaItem, StreamSource, SubtitleTrack, WatchProgress, Season, Episode } from '../../types/media';
import { storage } from '../../services/storage';
import { api } from '../../services/api';

// Webtor.io embed SDK — streams a magnet by fetching + transcoding it server-side
// (webtor.io), so the viewer's device never joins the torrent swarm.
const WEBTOR_SDK = 'https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js';
let webtorSdkPromise: Promise<void> | null = null;
function ensureWebtorSdk(): Promise<void> {
  if ((window as any).webtor && typeof (window as any).webtor.push === 'function') {
    return Promise.resolve();
  }
  if (!webtorSdkPromise) {
    (window as any).webtor = (window as any).webtor || [];
    webtorSdkPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = WEBTOR_SDK;
      s.async = true;
      s.charset = 'utf-8';
      s.onload = () => resolve();
      s.onerror = () => { webtorSdkPromise = null; reject(new Error('Webtor SDK failed to load')); };
      document.head.appendChild(s);
    });
  }
  return webtorSdkPromise;
}

interface MediaPlayerProps {
  item: MediaItem;
  initialSource: StreamSource;
  availableSources: StreamSource[];
  season?: number;
  episode?: number;
  onClose: () => void;
  onNextEpisode?: () => void;
  onChangeEpisode?: (season: number, episode: number) => void;
  hasNextEpisode?: boolean;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  item,
  initialSource,
  availableSources = [],
  season,
  episode,
  onClose,
  onNextEpisode,
  onChangeEpisode,
  hasNextEpisode = false
}) => {
  const isTv = item.mediaType === 'tv' && !!season && !!episode && !!onChangeEpisode;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const webtorRef = useRef<HTMLDivElement>(null);
  const [webtorError, setWebtorError] = useState<string | null>(null);

  const [currentSource, setCurrentSource] = useState<StreamSource>(initialSource);
  const isMagnetSource = currentSource.type === 'magnet' || currentSource.type === 'torrent';
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<'16/9' | '4/3' | 'fill' | 'contain'>('contain');

  // Menus
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState(false);

  // Episode picker (TV only)
  const [epSeasons, setEpSeasons] = useState<Season[]>(item.seasons || []);
  const [epSeasonNum, setEpSeasonNum] = useState<number>(season || 1);
  const [epSeasonData, setEpSeasonData] = useState<Season | null>(null);
  const [epLoading, setEpLoading] = useState(false);

  // Embed stream health (iframes can't be inspected, so we watch for a load event)
  const [embedStatus, setEmbedStatus] = useState<'loading' | 'ready' | 'stalled'>('loading');

  // Subtitles & Audio Tracks
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('off');
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<number>(0);

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Where to resume from, in seconds. Computed synchronously during render so
  // both the HLS start position and the embed URL param can use it immediately.
  const resumeTime = useMemo(() => {
    const saved = storage.getProgress(item.tmdbId || item.id, season, episode);
    return saved && saved.currentTime > 5 && !saved.completed ? saved.currentTime : 0;
  }, [item, season, episode]);

  useEffect(() => {
    let isMounted = true;
    async function loadSubs() {
      try {
        const subs = await api.getSubtitles({
          imdbId: item.imdbId,
          tmdbId: item.tmdbId || item.id,
          season,
          episode,
          title: item.title
        });
        if (isMounted && subs.length > 0) {
          setSubtitleTracks(subs);
        }
      } catch (e) {
        console.warn('Subtitle fetch error:', e);
      }
    }
    loadSubs();
    return () => { isMounted = false; };
  }, [item, season, episode]);

  // The actual seek happens once the media is ready (from HLS MANIFEST_PARSED
  // and the <video> onLoadedMetadata event).
  // Embed URL with autoplay + provider-specific resume params appended. The param
  // names come from the provider adapter (StreamSource.autoplayQuery / resumeParam
  // / extraQuery) so the player stays provider-agnostic.
  const embedSrc = useMemo(() => {
    let url = currentSource.url;
    if (currentSource.type !== 'embed') return url;
    const add = (q?: string) => {
      if (!q) return;
      url += (url.includes('?') ? '&' : '?') + q;
    };
    add(currentSource.autoplayQuery);
    add(currentSource.extraQuery);
    const secs = Math.floor(resumeTime);
    if (secs >= 5 && currentSource.resumeParam) add(`${currentSource.resumeParam}=${secs}`);
    return url;
  }, [currentSource, resumeTime]);

  const applyResumePosition = () => {
    const video = videoRef.current;
    if (!video) return;
    const target = resumeTime;
    if (target <= 0 || !Number.isFinite(target)) return;
    // Don't fight a user who already scrubbed, and don't seek past the end.
    if (video.duration && target >= video.duration - 5) return;
    if (Math.abs(video.currentTime - target) < 2) return;
    try {
      video.currentTime = target;
    } catch {
      /* not seekable yet; a later ready-event retries */
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentSource.type === 'embed' || currentSource.type === 'magnet' || currentSource.type === 'torrent') {
      setIsBuffering(false);
      return;
    }

    let streamUrl = currentSource.url;
    if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
      if (!streamUrl.startsWith(window.location.origin) && !streamUrl.startsWith('/api/proxy')) {
        streamUrl = `/api/proxy/media?url=${encodeURIComponent(streamUrl)}`;
      }
    }

    setIsBuffering(true);

    if (Hls.isSupported() && (currentSource.type === 'hls' || streamUrl.includes('.m3u8'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // Canonical hls.js way to start playback at a saved offset.
        startPosition: resumeTime > 5 ? resumeTime : -1
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        applyResumePosition();
        video.play().catch(() => {});
        if (data.audioTracks && data.audioTracks.length > 0) {
          setAudioTracks(data.audioTracks.map((t, idx) => ({ id: idx, name: t.name || `Track ${idx + 1}` })));
        }
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else {
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource]);

  // Adopt a new stream when the parent swaps it in (episode change, etc.).
  useEffect(() => {
    setCurrentSource(initialSource);
  }, [initialSource]);

  // The two right-side drawers are mutually exclusive.
  useEffect(() => {
    if (showEpisodeDrawer) setShowSourceDrawer(false);
  }, [showEpisodeDrawer]);
  useEffect(() => {
    if (showSourceDrawer) setShowEpisodeDrawer(false);
  }, [showSourceDrawer]);

  // Embed players run cross-origin, so postMessage is the only way to learn how
  // far the viewer has watched. Handles VidLink, VidFast, Videasy and VixSrc
  // payload shapes (id-keyed maps, composite-keyed maps, JW-player events).
  useEffect(() => {
    if (currentSource.type !== 'embed') return;
    const mediaId = item.tmdbId || item.id;
    let lastSaved = 0;

    const save = (watched: number, total: number) => {
      if (!Number.isFinite(watched) || !Number.isFinite(total) || total <= 0 || watched < 5) return;
      const now = Date.now();
      if (now - lastSaved < 4000) return; // these events fire ~1/sec
      lastSaved = now;
      const percent = Math.min(100, (watched / total) * 100);
      const progressObj: WatchProgress = {
        mediaId,
        mediaType: item.mediaType,
        title: item.title,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        currentTime: watched,
        duration: total,
        progressPercent: Number(percent.toFixed(1)),
        season,
        episode,
        lastUpdated: Date.now(),
        completed: percent >= 92,
        selectedSourceProvider: currentSource.provider
      };
      storage.saveProgress(progressObj);
      storage.addToHistory(progressObj);
      if (percent >= 90 && hasNextEpisode) setNextEpisodePrompt(true);
    };

    const epKey = season && episode ? `s${season}e${episode}` : '';
    // Videasy/VidFast key their store by a composite id instead of the tmdb id.
    const composite = episode
      ? `tv-${mediaId}-${season}-${episode}`
      : `movie-${mediaId}`;

    // Pull a {watched, total} pair out of whatever shape the provider sent.
    const saveFrom = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      // { progress: { watched, duration } }  (VidLink / Videasy nested)
      if (obj.progress && typeof obj.progress === 'object') {
        return saveFrom(obj.progress);
      }
      let watched = Number(
        obj.watched ?? obj.currentTime ?? obj.timestamp ?? obj.time ?? obj.position ?? NaN
      );
      const total = Number(obj.duration ?? obj.totalDuration ?? obj.runtime ?? NaN);
      // Some players report progress as a 0..1 fraction instead of seconds.
      if (!Number.isFinite(watched) && Number.isFinite(Number(obj.progress))) {
        const frac = Number(obj.progress);
        if (frac > 0 && frac <= 1 && Number.isFinite(total)) watched = frac * total;
      }
      if (!Number.isFinite(watched) || !Number.isFinite(total)) return false;
      save(watched, total);
      return true;
    };

    const onMessage = (e: MessageEvent) => {
      let data: any = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;

      const type = data.type;
      let payload = data.data ?? data;
      // Videasy / VidFast double-encode: data.data is itself a JSON string.
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { /* leave as-is */ }
      }
      // VixSrc (JW player) nests the real event under `event`.
      if (data.event && typeof data.event === 'object') {
        saveFrom(data.event.data || data.event);
        return;
      }

      // Per-tick playback events (VidLink movies, vidsrc.cc, and others).
      if (type === 'PLAYER_EVENT' || type === 'timeupdate' || type === 'time' || type === 'progress') {
        saveFrom(payload);
        return;
      }

      // Snapshot dumps: the players broadcast their whole watch store on an
      // interval. For TV this is often the only progress signal.
      if (type === 'MEDIA_DATA' || type === 'PLAYER_DATA' || type === 'media_data') {
        if (!payload || typeof payload !== 'object') return;
        // The entry may be keyed by tmdb id, by a composite id, or be the
        // payload itself.
        const entry =
          payload[String(mediaId)] ||
          payload[composite] ||
          (String(payload.id) === String(mediaId) ? payload : null);
        if (!entry) return;
        const epProgress =
          epKey && entry.show_progress && entry.show_progress[epKey]?.progress;
        // For a series, the episode-specific entry is authoritative; the
        // top-level `progress` often lags at 0 or points at another episode.
        if (epKey && entry.show_progress) {
          if (epProgress) saveFrom(epProgress);
        } else {
          saveFrom(entry.progress || entry);
        }
        return;
      }

      // Last resort: a flat object that just happens to carry the numbers.
      saveFrom(payload);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [currentSource, item, season, episode, hasNextEpisode]);

  // Mount the Webtor player for magnet/torrent sources.
  useEffect(() => {
    if (!isMagnetSource) return;
    let cancelled = false;
    setWebtorError(null);
    setIsBuffering(true);
    const container = webtorRef.current;
    if (container) container.innerHTML = '';

    ensureWebtorSdk()
      .then(() => {
        if (cancelled || !webtorRef.current) return;
        (window as any).webtor.push({
          id: 'webtor-player-surface',
          magnet: currentSource.url,
          poster: item.backdropPath || item.posterPath || undefined,
          title: item.title,
          width: '100%',
          height: '100%',
          lang: storage.getSettings().subtitleLanguage || 'en',
          features: { subtitles: true, settings: true, embed: false }
        });
        setIsBuffering(false);
      })
      .catch(() => {
        if (!cancelled) {
          setWebtorError('Torrent player failed to load. Try another source.');
          setIsBuffering(false);
        }
      });

    return () => { cancelled = true; };
  }, [isMagnetSource, currentSource, item]);

  // Cross-origin embeds swallow mousemove, so a container-level listener never
  // fires while the cursor is over the video. Start an idle countdown whenever
  // the embed (re)loads instead of waiting for a move that never comes.
  useEffect(() => {
    if (currentSource.type !== 'embed') return;
    setShowControls(true);
    const t = setTimeout(() => setShowControls(false), 4500);
    return () => clearTimeout(t);
  }, [currentSource]);

  // Watch embed sources: if the iframe never fires `load`, surface a fallback.
  useEffect(() => {
    if (currentSource.type !== 'embed') return;
    setEmbedStatus('loading');
    const stallTimer = setTimeout(() => {
      setEmbedStatus((s) => (s === 'ready' ? s : 'stalled'));
    }, 14000);
    return () => clearTimeout(stallTimer);
  }, [currentSource]);

  // Keep the in-player episode picker in sync with the playing episode.
  useEffect(() => {
    if (season) setEpSeasonNum(season);
  }, [season]);

  // Lazy-load the season list if we only have a shallow item (e.g. quick play).
  useEffect(() => {
    if (!showEpisodeDrawer || !isTv || epSeasons.length > 0) return;
    let alive = true;
    api
      .getDetails(item.tmdbId || item.id, 'tv')
      .then((full) => {
        if (alive && full.seasons) setEpSeasons(full.seasons);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showEpisodeDrawer, isTv, epSeasons.length, item.tmdbId, item.id]);

  // Fetch episodes for the season being browsed in the picker.
  useEffect(() => {
    if (!showEpisodeDrawer || !isTv) return;
    let alive = true;
    setEpLoading(true);
    api
      .getSeason(item.tmdbId || item.id, epSeasonNum)
      .then((data) => {
        if (alive) setEpSeasonData(data);
      })
      .catch(() => {
        if (alive) setEpSeasonData(null);
      })
      .finally(() => {
        if (alive) setEpLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [showEpisodeDrawer, isTv, epSeasonNum, item.tmdbId, item.id]);

  // Persist playback progress. Reads straight off the <video> element (not the
  // `duration` state) so a slow state update can't skip a save.
  const persistProgress = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration;
    const cTime = video.currentTime;
    if (!dur || !Number.isFinite(dur) || dur <= 0 || cTime <= 0) return;
    const percent = (cTime / dur) * 100;
    const progressObj: WatchProgress = {
      mediaId: item.tmdbId || item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      currentTime: cTime,
      duration: dur,
      progressPercent: Number(percent.toFixed(1)),
      season,
      episode,
      lastUpdated: Date.now(),
      completed: percent >= 92,
      selectedSourceProvider: currentSource.provider
    };
    storage.saveProgress(progressObj);
    storage.addToHistory(progressObj);
    if (percent >= 90 && hasNextEpisode) setNextEpisodePrompt(true);
  }, [item, season, episode, currentSource, hasNextEpisode]);

  useEffect(() => {
    const interval = setInterval(persistProgress, 5000);
    window.addEventListener('beforeunload', persistProgress);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', persistProgress);
      persistProgress(); // capture position on unmount / episode swap / close
    };
  }, [persistProgress]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Handled regardless of player type (embed has no <video>).
      if (e.code === 'Escape') {
        if (showSourceDrawer || showEpisodeDrawer) {
          setShowSourceDrawer(false);
          setShowEpisodeDrawer(false);
        } else if (isFullscreen) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose();
        }
        return;
      }
      if (e.code === 'KeyE' && isTv) {
        e.preventDefault();
        setShowEpisodeDrawer(prev => !prev);
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => {
            const next = Math.min(1, v + 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => {
            const next = Math.max(0, v - 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'KeyM':
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyS':
          e.preventDefault();
          setShowSourceDrawer(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose, showSourceDrawer, showEpisodeDrawer, isTv]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (showSettingsMenu || showSubtitleMenu || showSourceDrawer || showEpisodeDrawer) return;
      // Embeds have no play-state we can read, so always hide them on idle.
      if (currentSource.type === 'embed' || isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      id="media-player-container"
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden font-sans"
    >
      {/* Video Surface or Embed Player */}
      {currentSource.type === 'embed' ? (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
          {/* Hover zone to reveal the bar again (the iframe eats mousemove events) */}
          <div
            className="absolute top-0 left-0 right-0 h-24 z-20"
            onMouseEnter={handleMouseMove}
            onMouseMove={handleMouseMove}
          />

          {/* Top Floating Controls Bar */}
          <div
            onMouseEnter={handleMouseMove}
            onMouseMove={handleMouseMove}
            className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/95 via-black/60 to-transparent z-30 flex items-center justify-between transition-opacity duration-300 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-[#141722]/90 hover:bg-[#e50914] text-slate-200 hover:text-white flex items-center gap-2 text-xs font-bold backdrop-blur-md border border-[#2b3145] shadow-xl cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Exit Player</span>
              </button>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-white leading-tight truncate max-w-xs">{item.title}</span>
                {season && episode && (
                  <span className="text-[10px] text-amber-400 font-mono">
                    Season {season} • Episode {episode}
                  </span>
                )}
              </div>
            </div>

            {/* Middle: Quick Server Switcher Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1.5 px-2.5 bg-[#10121a]/90 rounded-2xl border border-[#252a3a] backdrop-blur-md">
              <span className="text-[10px] font-black text-[#858c9e] uppercase tracking-wider pl-1 pr-1 hidden md:inline">Relay:</span>
              {availableSources.slice(0, 5).map((s, idx) => (
                <button
                  key={s.id || idx}
                  onClick={() => setCurrentSource(s)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    currentSource.id === s.id
                      ? 'bg-[#e50914] text-white shadow-md shadow-red-950/60'
                      : 'bg-[#181a24] text-slate-400 hover:text-white hover:bg-[#222534]'
                  }`}
                >
                  {s.provider}
                </button>
              ))}
              {availableSources.length > 5 && (
                <button
                  onClick={() => setShowSourceDrawer(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#181a24] text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  +{availableSources.length - 5} More
                </button>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {isTv && (
                <button
                  onClick={() => setShowEpisodeDrawer(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#252838] text-slate-200 flex items-center gap-1.5 text-xs font-bold border border-[#2c3244] cursor-pointer shadow-lg"
                  title="Browse episodes"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Episodes</span>
                </button>
              )}
              {hasNextEpisode && onNextEpisode && (
                <button
                  onClick={onNextEpisode}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#252838] text-slate-200 flex items-center gap-1.5 text-xs font-bold border border-[#2c3244] cursor-pointer shadow-lg"
                  title="Next Episode"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Next Ep</span>
                </button>
              )}
              <button
                onClick={() => {
                  const curr = currentSource;
                  setEmbedStatus('loading');
                  setCurrentSource({ ...curr, url: curr.url });
                }}
                className="w-8 h-8 rounded-xl bg-[#141722]/90 hover:bg-[#202434] text-slate-300 hover:text-white flex items-center justify-center border border-[#2b3145] transition-colors cursor-pointer"
                title="Reload Stream"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-xl bg-[#141722]/90 hover:bg-[#202434] text-slate-300 hover:text-white flex items-center justify-center border border-[#2b3145] transition-colors cursor-pointer"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <iframe
            key={embedSrc}
            src={embedSrc}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            onLoad={() => setEmbedStatus('ready')}
            className="w-full h-full border-0 flex-1"
          />

          {/* Embed didn't respond — offer a quick switch */}
          {embedStatus === 'stalled' && availableSources.length > 1 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-30 max-w-[92vw] w-[420px] bg-[#12141c]/95 border border-[#2b3145] rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fadeIn">
              <p className="text-xs font-bold text-slate-200">
                Still loading <span className="text-amber-400">{currentSource.provider}</span>?
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Some servers are geo-blocked or slow. Try another one.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {availableSources
                  .filter((s) => s.id !== currentSource.id)
                  .slice(0, 3)
                  .map((s, idx) => (
                    <button
                      key={s.id || idx}
                      onClick={() => {
                        setEmbedStatus('loading');
                        setCurrentSource(s);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#e50914] hover:bg-[#ff1f2d] text-white text-[11px] font-bold cursor-pointer"
                    >
                      {s.provider}
                    </button>
                  ))}
                <button
                  onClick={() => setShowSourceDrawer(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#1e2230] hover:bg-[#292e40] text-slate-200 text-[11px] font-bold cursor-pointer"
                >
                  All servers
                </button>
                <button
                  onClick={() => setEmbedStatus('ready')}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-[11px] font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isMagnetSource ? (
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Minimal corner controls (Webtor renders its own title + playback UI) */}
          <div className="absolute top-0 left-0 right-0 z-30 p-3 flex items-start justify-between pointer-events-none">
            <div className="flex items-center gap-3 pointer-events-auto">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-[#141722]/90 hover:bg-[#e50914] text-slate-200 hover:text-white flex items-center gap-2 text-xs font-bold backdrop-blur-md border border-[#2b3145] cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Exit</span>
              </button>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {isTv && (
                <button
                  onClick={() => setShowEpisodeDrawer(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#252838] text-slate-200 flex items-center gap-1.5 text-xs font-bold border border-[#2c3244] cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Episodes</span>
                </button>
              )}
              <button
                onClick={() => setShowSourceDrawer(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#181a24] hover:bg-[#252838] text-slate-200 flex items-center gap-1.5 text-xs font-bold border border-[#2c3244] cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sources</span>
              </button>
            </div>
          </div>

          <div
            key={currentSource.url}
            ref={webtorRef}
            id="webtor-player-surface"
            className="webtor w-full flex-1"
          />

          {isBuffering && !webtorError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none">
              <Loader2 className="w-12 h-12 text-[#e50914] animate-spin" />
              <p className="text-xs text-slate-300 mt-3 font-semibold">Preparing torrent stream…</p>
            </div>
          )}
          {webtorError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
              <p className="text-sm font-bold text-slate-200">{webtorError}</p>
              <button
                onClick={() => setShowSourceDrawer(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#e50914] hover:bg-[#ff1f2d] text-white text-xs font-bold cursor-pointer"
              >
                Pick another source
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            id="main-video-element"
            playsInline
            className={`w-full h-full ${
              aspectRatio === 'fill' ? 'object-fill' : aspectRatio === 'contain' ? 'object-contain' : 'object-cover'
            }`}
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) videoRef.current.play();
                else videoRef.current.pause();
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              setDuration(videoRef.current?.duration || 0);
              applyResumePosition();
            }}
            onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
              <Loader2 className="w-12 h-12 text-[#e50914] animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Overlay Custom Controls (native <video> only) */}
      {currentSource.type !== 'embed' && !isMagnetSource && (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/75 flex flex-col justify-between p-6 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top Bar Header */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-4">
              <button
                id="player-back-btn"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[#151822]/90 hover:bg-[#e50914] text-white flex items-center justify-center backdrop-blur-md border border-[#2b3145] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>{item.title}</span>
                  {season && episode && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-[#e50914]/20 text-[#ff525c] border border-[#e50914]/40 font-mono font-bold">
                      S{season} E{episode}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="text-amber-400 font-bold">{currentSource.provider}</span>
                  <span>•</span>
                  <span>{currentSource.quality}</span>
                  <span>•</span>
                  <span className="uppercase">{currentSource.type}</span>
                </div>
              </div>
            </div>

            {/* Top Right Quick Actions */}
            <div className="flex items-center gap-2">
              {isTv && (
                <button
                  id="player-episodes-toggle"
                  onClick={() => setShowEpisodeDrawer(prev => !prev)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#151822]/90 hover:bg-[#202536] text-slate-200 text-xs font-semibold border border-[#2c3244] flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer"
                  title="Browse episodes"
                >
                  <Tv className="w-4 h-4 text-slate-300" />
                  <span>Episodes</span>
                </button>
              )}
              <button
                id="player-sources-toggle"
                onClick={() => setShowSourceDrawer(prev => !prev)}
                className="px-3.5 py-1.5 rounded-xl bg-[#151822]/90 hover:bg-[#202536] text-slate-200 text-xs font-semibold border border-[#2c3244] flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer"
                title="Switch Stream Source"
              >
                <Layers className="w-4 h-4 text-slate-300" />
                <span>Sources</span>
              </button>
            </div>
          </div>

          {/* Center Play/Pause Large Action */}
          <div className="flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => {
                if (videoRef.current) {
                  if (isPlaying) videoRef.current.pause();
                  else videoRef.current.play();
                }
              }}
              className="w-16 h-16 rounded-full bg-[#e50914]/90 hover:bg-[#ff1f2d] text-white flex items-center justify-center shadow-2xl shadow-red-950/80 backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-white" />
              ) : (
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              )}
            </button>
          </div>

          {/* Bottom Bar: Timeline + Controls */}
          <div className="space-y-3 pointer-events-auto">
            {/* Timeline Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-300 w-12 text-right font-bold">
                {formatTime(currentTime)}
              </span>

              <div
                className="relative flex-1 h-2 bg-[#1b1f2b] rounded-full cursor-pointer group"
                onClick={(e) => {
                  if (!videoRef.current || duration === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  videoRef.current.currentTime = pos * duration;
                }}
              >
                {/* Buffered bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#2b3144] rounded-full"
                  style={{ width: `${(buffered / (duration || 1)) * 100}%` }}
                />
                {/* Current progress bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-[#e50914] rounded-full shadow-[0_0_10px_rgba(229,9,20,0.8)]"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
                {/* Hover indicator pin */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)` }}
                />
              </div>

              <span className="text-xs font-mono text-[#787f90] w-12 font-bold">
                {formatTime(duration)}
              </span>
            </div>

            {/* Bottom Buttons Bar */}
            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                    }
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-[#1c202e] text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-slate-200" />}
                </button>

                {/* 10s Back / Forward */}
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime -= 10;
                  }}
                  className="w-8 h-8 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                  title="10s Back (Left Arrow)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime += 10;
                  }}
                  className="w-8 h-8 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                  title="10s Forward (Right Arrow)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="w-8 h-8 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                    title="Mute (M)"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      if (videoRef.current) {
                        videoRef.current.volume = v;
                        videoRef.current.muted = false;
                        setIsMuted(false);
                      }
                    }}
                    className="w-20 accent-[#e50914] h-1.5 bg-[#202534] rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 relative">
                {/* Next Episode Button */}
                {hasNextEpisode && onNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="px-3 py-1.5 rounded-xl bg-[#e50914] hover:bg-[#ff1f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                    title="Next Episode"
                  >
                    <span>Next Ep</span>
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Subtitles Button */}
                <button
                  onClick={() => setShowSubtitleMenu(prev => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    selectedSubtitle !== 'off'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-[#151822]/90 hover:bg-[#202536] text-slate-300 border-[#2c3244]'
                  }`}
                  title="Subtitles"
                >
                  <Subtitles className="w-4 h-4" />
                  <span>Subtitles</span>
                </button>

                {/* Speed & Aspect Settings */}
                <button
                  onClick={() => setShowSettingsMenu(prev => !prev)}
                  className="w-9 h-9 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                  title="Player Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* PiP */}
                <button
                  onClick={togglePiP}
                  className="w-9 h-9 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                  title="Picture in Picture"
                >
                  <PictureInPicture className="w-4 h-4" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="w-9 h-9 rounded-xl hover:bg-[#1c202e] text-slate-300 flex items-center justify-center cursor-pointer"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Subtitles Menu Dropdown */}
                {showSubtitleMenu && (
                  <div className="absolute bottom-12 right-12 w-60 bg-[#10121a] border border-[#2b3145] rounded-2xl shadow-2xl p-2.5 z-40 space-y-1">
                    <div className="px-2 py-1 text-[11px] font-black text-slate-400 uppercase tracking-wider">Subtitles</div>
                    <button
                      onClick={() => {
                        setSelectedSubtitle('off');
                        setShowSubtitleMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        selectedSubtitle === 'off' ? 'bg-[#e50914] text-white' : 'text-slate-300 hover:bg-[#191d2a]'
                      }`}
                    >
                      <span>Off</span>
                      {selectedSubtitle === 'off' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {subtitleTracks.map((sub, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSubtitle(sub.language);
                          setShowSubtitleMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                          selectedSubtitle === sub.language ? 'bg-[#e50914] text-white' : 'text-slate-300 hover:bg-[#191d2a]'
                        }`}
                      >
                        <span className="truncate">{sub.label}</span>
                        {selectedSubtitle === sub.language && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Settings Menu Dropdown */}
                {showSettingsMenu && (
                  <div className="absolute bottom-12 right-0 w-64 bg-[#10121a] border border-[#2b3145] rounded-2xl shadow-2xl p-3.5 z-40 space-y-3">
                    {/* Playback Speed */}
                    <div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Speed</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0.75, 1, 1.25, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => {
                              setPlaybackSpeed(speed);
                              if (videoRef.current) videoRef.current.playbackRate = speed;
                            }}
                            className={`py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              playbackSpeed === speed ? 'bg-[#e50914] text-white' : 'bg-[#181b26] text-slate-300 hover:bg-[#202534]'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Aspect Ratio</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['contain', 'cover', 'fill'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setAspectRatio(mode)}
                            className={`py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                              aspectRatio === mode ? 'bg-[#e50914] text-white' : 'bg-[#181b26] text-slate-300 hover:bg-[#202534]'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-Player Source Switcher Drawer */}
      {showSourceDrawer && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-[#0e1017]/95 backdrop-blur-xl border-l border-[#282e3f] z-50 flex flex-col p-4 shadow-2xl animate-slideLeft">
          <div className="flex items-center justify-between pb-3 border-b border-[#222736]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-300" />
              <span>Available Sources</span>
            </h3>
            <button
              onClick={() => setShowSourceDrawer(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer font-bold"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-thin">
            {availableSources.map((s, idx) => {
              const isSelected = currentSource.id === s.id;
              return (
                <button
                  key={s.id || idx}
                  onClick={() => {
                    setCurrentSource(s);
                    setShowSourceDrawer(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#e50914]/15 border-[#e50914] text-white shadow-md'
                      : 'bg-[#141722] hover:bg-[#1c202e] border-[#252a3a] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs">{s.provider}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/60 font-mono font-bold text-amber-400 border border-white/10">
                      {s.quality}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-1">{s.title || s.url}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* In-Player Episode Picker Drawer */}
      {showEpisodeDrawer && isTv && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-[#0e1017]/95 backdrop-blur-xl border-l border-[#282e3f] z-50 flex flex-col p-4 shadow-2xl animate-slideLeft">
          <div className="flex items-center justify-between pb-3 border-b border-[#222736]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-slate-300" />
              <span>Episodes</span>
            </h3>
            <button
              onClick={() => setShowEpisodeDrawer(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer font-bold"
            >
              Close
            </button>
          </div>

          {/* Season pills */}
          {epSeasons.filter(s => s.seasonNumber > 0).length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none shrink-0">
              {epSeasons
                .filter(s => s.seasonNumber > 0)
                .map(s => (
                  <button
                    key={s.id || s.seasonNumber}
                    onClick={() => setEpSeasonNum(s.seasonNumber)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      epSeasonNum === s.seasonNumber
                        ? 'bg-[#e50914] text-white'
                        : 'bg-[#141722] text-slate-400 hover:text-white border border-[#252a3a]'
                    }`}
                  >
                    S{s.seasonNumber}
                  </button>
                ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2 space-y-2 scrollbar-thin">
            {epLoading ? (
              [1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 rounded-xl bg-[#141722]/70 border border-[#20242f] animate-pulse" />
              ))
            ) : epSeasonData?.episodes && epSeasonData.episodes.length > 0 ? (
              epSeasonData.episodes.map((ep: Episode) => {
                const isCurrent = epSeasonNum === season && ep.episodeNumber === episode;
                const prog = storage.getProgress(item.tmdbId || item.id, epSeasonNum, ep.episodeNumber);
                return (
                  <button
                    key={ep.id}
                    onClick={() => {
                      if (!isCurrent) onChangeEpisode?.(epSeasonNum, ep.episodeNumber);
                      setShowEpisodeDrawer(false);
                    }}
                    className={`w-full text-left flex gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#e50914]/15 border-[#e50914]'
                        : 'bg-[#141722] hover:bg-[#1c202e] border-[#252a3a]'
                    }`}
                  >
                    <div className="relative w-24 aspect-video shrink-0 rounded-lg overflow-hidden bg-[#0c0e14] border border-[#20242f]">
                      {ep.stillPath ? (
                        <img
                          src={ep.stillPath}
                          alt={ep.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-4 h-4" />
                        </div>
                      )}
                      <span className="absolute top-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded bg-black/80 text-slate-200">
                        E{ep.episodeNumber}
                      </span>
                      {prog && prog.progressPercent > 0 && (
                        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-black/60">
                          <div className="h-full bg-[#e50914]" style={{ width: `${prog.progressPercent}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                        {ep.episodeNumber}. {ep.name}
                      </p>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                        {ep.overview || 'No overview available.'}
                      </p>
                      {isCurrent && (
                        <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wide text-[#ff525c]">
                          Now Playing
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-[#141722]/60 rounded-xl border border-[#20242f]">
                No episodes found for this season.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-Next Episode Prompt Overlay */}
      {nextEpisodePrompt && hasNextEpisode && onNextEpisode && (
        <div className="absolute bottom-24 right-8 bg-[#12141c]/95 border border-[#e50914]/50 rounded-2xl p-4 shadow-2xl z-40 max-w-sm backdrop-blur-md animate-bounce">
          <p className="text-xs font-bold text-slate-200">Episode ending soon!</p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={() => {
                setNextEpisodePrompt(false);
                onNextEpisode();
              }}
              className="px-4 py-2 bg-[#e50914] hover:bg-[#ff1f2d] text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
            >
              Play Next Episode
            </button>
            <button
              onClick={() => setNextEpisodePrompt(false)}
              className="px-3 py-2 bg-[#1e2230] hover:bg-[#292e40] text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
