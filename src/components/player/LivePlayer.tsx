import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Loader2,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
  Check,
  Server
} from 'lucide-react';
import { LiveEvent } from '../../types/media';
import { cleanEventTitle, cleanFeedName } from '../../services/text';

interface LivePlayerProps {
  event: LiveEvent;
  onClose: () => void;
}

export const LivePlayer: React.FC<LivePlayerProps> = ({ event, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const serverMenuRef = useRef<HTMLDivElement>(null);

  const [activeChannelIdx, setActiveChannelIdx] = useState(0);
  const activeChannel = event.channels[activeChannelIdx] || event.channels[0];

  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [bufferingTimeout, setBufferingTimeout] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const servers = useMemo(
    () =>
      event.channels.map((ch, idx) => {
        const { label, tag } = cleanFeedName(ch.name, idx);
        return {
          idx,
          label,
          tag: ch.quality || tag,
          provider: ch.provider,
          isEmbed: ch.type === 'embed'
        };
      }),
    [event.channels]
  );

  const activeServer = servers[activeChannelIdx] || servers[0];
  const title = useMemo(() => cleanEventTitle(event.title), [event.title]);

  const tryPlayStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;

    setStreamError(null);
    setBufferingTimeout(false);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (activeChannel.type === 'embed') {
      setIsBuffering(false);
      return;
    }

    let rawUrl = activeChannel.url;
    let streamUrl = rawUrl;

    if (useProxy && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
      streamUrl = `/api/proxy/media?url=${encodeURIComponent(rawUrl)}`;
    }

    const isHls = activeChannel.type === 'hls' || rawUrl.includes('.m3u8') || streamUrl.includes('.m3u8');

    if (Hls.isSupported() && isHls) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 10000,
        maxBufferLength: 30
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        setStreamError(null);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // If failed without proxy, switch to proxy
              if (!useProxy && !streamUrl.startsWith('/api/proxy')) {
                setUseProxy(true);
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setStreamError('Feed temporarily unavailable. Please try another server or reload.');
              break;
          }
        }
      });
    } else {
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    }
  }, [activeChannel, useProxy]);

  useEffect(() => {
    tryPlayStream();

    // Set a safety timeout for buffering: if stuck for > 8s, offer reload/switch
    const bufferTimer = setTimeout(() => {
      if (isBuffering) {
        setBufferingTimeout(true);
      }
    }, 8000);

    return () => {
      clearTimeout(bufferTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannelIdx, useProxy, tryPlayStream]);

  // Close the server menu on outside click / Escape
  useEffect(() => {
    if (!serverMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setServerMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setServerMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [serverMenuOpen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-hide the header/footer chrome after a few idle seconds. Cross-origin
  // embeds swallow mousemove, so we also (re)arm the timer whenever the feed
  // changes rather than relying on a move event that never arrives over an iframe.
  const serverMenuOpenRef = useRef(serverMenuOpen);
  serverMenuOpenRef.current = serverMenuOpen;
  const pointerOverChromeRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = null;
    }
  }, []);

  const armHideTimer = useCallback(() => {
    clearHideTimer();
    hideControlsTimer.current = setTimeout(() => {
      if (serverMenuOpenRef.current || pointerOverChromeRef.current) return;
      setShowControls(false);
    }, 4000);
  }, [clearHideTimer]);

  // Cursor moved over the video / hover zone: show chrome and start the countdown.
  const revealControls = useCallback(() => {
    setShowControls(true);
    armHideTimer();
  }, [armHideTimer]);

  // Cursor is over the header/footer itself: keep it up until the cursor leaves.
  const holdControls = useCallback(() => {
    pointerOverChromeRef.current = true;
    setShowControls(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const releaseControls = useCallback(() => {
    pointerOverChromeRef.current = false;
    armHideTimer();
  }, [armHideTimer]);

  useEffect(() => {
    revealControls();
    return () => clearHideTimer();
  }, [activeChannelIdx, revealControls, clearHideTimer]);

  useEffect(() => {
    if (serverMenuOpen) {
      setShowControls(true);
      clearHideTimer();
    } else {
      armHideTimer();
    }
  }, [serverMenuOpen, clearHideTimer, armHideTimer]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const selectServer = (idx: number) => {
    setUseProxy(false);
    setActiveChannelIdx(idx);
    setServerMenuOpen(false);
  };

  const handleNextFeed = () => {
    setUseProxy(false);
    setActiveChannelIdx((prev) => (prev + 1) % event.channels.length);
  };

  const handleReloadCurrentFeed = () => {
    setUseProxy((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      id="live-player-container"
      onMouseMove={revealControls}
      className="fixed inset-0 z-50 bg-black select-none font-sans"
    >
      {/* Edge hold-zones: while the cursor is in these bands the chrome stays put
          (mouseenter on the bars themselves can't fire once they're pointer-events-none,
          and cross-origin iframes swallow mousemove entirely). */}
      <div
        className="absolute top-0 left-0 right-0 h-28 z-10"
        onMouseEnter={holdControls}
        onMouseMove={holdControls}
        onMouseLeave={releaseControls}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-28 z-10"
        onMouseEnter={holdControls}
        onMouseMove={holdControls}
        onMouseLeave={releaseControls}
      />

      {/* Top Header Bar */}
      <div
        onMouseEnter={holdControls}
        onMouseMove={holdControls}
        onMouseLeave={releaseControls}
        className={`absolute top-0 left-0 right-0 h-16 px-4 md:px-6 bg-gradient-to-b from-black/95 to-black/70 border-b border-white/[0.06] flex items-center justify-between z-30 backdrop-blur-md gap-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-colors cursor-pointer"
            title="Back to Live Grid"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/25 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-red-400">Live</span>
              </span>
              <h2 className="text-[15px] font-bold text-white truncate tracking-tight">{title}</h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-medium truncate">
              <span className="text-[#38bdf8] font-semibold">{event.category}</span>
              <span className="text-slate-600">•</span>
              <span>{event.provider}</span>
              {event.league && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{event.league}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Controls: Server Selector & Screen Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {event.channels.length > 1 && (
            <div className="relative" ref={serverMenuRef}>
              <button
                onClick={() => setServerMenuOpen((v) => !v)}
                className={`h-9 pl-2.5 pr-2 rounded-xl flex items-center gap-2 border transition-colors cursor-pointer ${
                  serverMenuOpen
                    ? 'bg-white/[0.12] border-white/[0.18] text-white'
                    : 'bg-white/[0.06] border-white/[0.08] text-slate-200 hover:bg-white/[0.1] hover:text-white'
                }`}
                title="Choose server"
              >
                <Server className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                <span className="text-xs font-semibold max-w-[160px] truncate">{activeServer?.label}</span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden sm:inline">
                  {activeChannelIdx + 1}/{event.channels.length}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${serverMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {serverMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#11131a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-30 animate-fadeIn">
                  <div className="px-3.5 py-2.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Servers</span>
                    <span className="text-[10px] font-mono text-slate-500">{event.channels.length} available</span>
                  </div>
                  <div className="max-h-[52vh] overflow-y-auto scrollbar-thin py-1.5">
                    {servers.map((s) => {
                      const active = s.idx === activeChannelIdx;
                      return (
                        <button
                          key={s.idx}
                          onClick={() => selectServer(s.idx)}
                          className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                            active ? 'bg-[#38bdf8]/10' : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono ${
                              active
                                ? 'bg-[#38bdf8] text-black'
                                : 'bg-white/[0.06] text-slate-400 border border-white/[0.08]'
                            }`}
                          >
                            {s.idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-[13px] font-semibold truncate ${active ? 'text-white' : 'text-slate-200'}`}
                            >
                              {s.label}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {s.provider}
                              {s.isEmbed ? ' • Embed' : ''}
                            </div>
                          </div>
                          {s.tag && (
                            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400 uppercase shrink-0">
                              {s.tag}
                            </span>
                          )}
                          {active && <Check className="w-4 h-4 text-[#38bdf8] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleReloadCurrentFeed}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-colors cursor-pointer"
            title="Reload stream"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-colors cursor-pointer"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
        {activeChannel && activeChannel.type === 'embed' ? (
          <iframe
            src={activeChannel.url}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative bg-black">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted={isMuted}
              className="w-full h-full object-contain"
              onPlay={() => {
                setIsPlaying(true);
                setIsBuffering(false);
              }}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => {
                setIsBuffering(false);
                setBufferingTimeout(false);
              }}
            />

            {/* Buffering Indicator */}
            {isBuffering && !streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs z-10">
                <Loader2 className="w-9 h-9 text-[#38bdf8] animate-spin mb-3" />
                <p className="text-xs font-semibold text-white tracking-wide">Connecting to live feed…</p>
                {bufferingTimeout && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={handleReloadCurrentFeed}
                      className="px-3.5 py-1.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                    >
                      Retry stream
                    </button>
                    {event.channels.length > 1 && (
                      <button
                        onClick={handleNextFeed}
                        className="px-3.5 py-1.5 rounded-lg bg-white/[0.1] text-white font-bold text-xs hover:bg-white/[0.16] transition cursor-pointer"
                      >
                        Try next server
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stream Error Notice */}
            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-6 text-center">
                <AlertTriangle className="w-9 h-9 text-amber-400 mb-2.5" />
                <h3 className="text-base font-bold text-white mb-1">Stream notice</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">{streamError}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReloadCurrentFeed}
                    className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    Reload stream
                  </button>
                  {event.channels.length > 1 && (
                    <button
                      onClick={handleNextFeed}
                      className="px-4 py-2 rounded-lg bg-white/[0.1] text-white font-bold text-xs hover:bg-white/[0.16] transition cursor-pointer"
                    >
                      Switch server
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Quick Controls (for direct video) */}
      {(!activeChannel || activeChannel.type !== 'embed') && (
        <div
          onMouseEnter={holdControls}
          onMouseMove={holdControls}
          onMouseLeave={releaseControls}
          className={`absolute bottom-0 left-0 right-0 h-14 px-4 md:px-6 bg-gradient-to-t from-black/95 to-black/70 border-t border-white/[0.06] flex items-center justify-between z-30 backdrop-blur-md transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  if (video.paused) {
                    video.play();
                    setIsPlaying(true);
                  } else {
                    video.pause();
                    setIsPlaying(false);
                  }
                }
              }}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white flex items-center justify-center transition cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white flex items-center justify-center transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-400 truncate">
              {activeServer?.label}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.06] text-slate-400 uppercase shrink-0">
              {activeServer?.tag || 'HD'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
