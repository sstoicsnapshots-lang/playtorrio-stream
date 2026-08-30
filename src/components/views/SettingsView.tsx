import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Layers,
  Tv,
  Radio,
  HardDrive,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Zap,
  RotateCcw
} from 'lucide-react';
import { AppSettings, StremioAddon } from '../../types/media';
import { storage, DEFAULT_SETTINGS } from '../../services/storage';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [savedAlert, setSavedAlert] = useState(false);
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [newAddonName, setNewAddonName] = useState('');

  const handleSave = (updated?: AppSettings) => {
    const toSave = updated || settings;
    storage.saveSettings(toSave);
    setSettings({ ...toSave });
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 2500);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to default values?')) {
      handleSave(DEFAULT_SETTINGS);
    }
  };

  const handleToggleProvider = (key: string) => {
    const nextProviders = {
      ...settings.providersEnabled,
      [key]: !settings.providersEnabled[key]
    };
    const nextSettings = { ...settings, providersEnabled: nextProviders };
    handleSave(nextSettings);
  };

  const handleToggleLiveProvider = (key: string) => {
    const nextLive = {
      ...settings.liveProvidersEnabled,
      [key]: !settings.liveProvidersEnabled[key]
    };
    const nextSettings = { ...settings, liveProvidersEnabled: nextLive };
    handleSave(nextSettings);
  };

  const handleAddStremioAddon = () => {
    if (!newAddonUrl.trim()) return;
    const newAddon: StremioAddon = {
      id: `custom-${Date.now()}`,
      name: newAddonName.trim() || 'Custom Stremio Add-on',
      manifestUrl: newAddonUrl.trim(),
      enabled: true
    };
    const nextAddons = [...settings.stremioAddons, newAddon];
    const nextSettings = { ...settings, stremioAddons: nextAddons };
    handleSave(nextSettings);
    setNewAddonUrl('');
    setNewAddonName('');
  };

  const handleToggleAddon = (id: string) => {
    const nextAddons = settings.stremioAddons.map(a =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    handleSave({ ...settings, stremioAddons: nextAddons });
  };

  const handleRemoveAddon = (id: string) => {
    const nextAddons = settings.stremioAddons.filter(a => a.id !== id);
    handleSave({ ...settings, stremioAddons: nextAddons });
  };

  return (
    <div id="settings-view-container" className="p-8 pb-24 max-w-4xl animate-fadeIn font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-slate-300" />
            <span>Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure playback preferences, streaming sources, Stremio add-ons, and Debrid accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedAlert && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400" />
              Settings Saved
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-[#11131a] hover:bg-[#171a25] text-slate-400 hover:text-slate-200 border border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: Playback Preferences */}
        <div className="p-6 rounded-2xl bg-[#11131a] border border-white/[0.08]">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Tv className="w-4 h-4 text-slate-300" />
            <span>Playback Preferences</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preferred Quality */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Preferred Video Resolution
              </label>
              <select
                value={settings.preferredQuality}
                onChange={(e) => {
                  const s = { ...settings, preferredQuality: e.target.value as any };
                  handleSave(s);
                }}
                className="w-full bg-[#171a25] text-xs text-slate-200 p-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
              >
                <option value="4K">4K Ultra HD</option>
                <option value="1080p">1080p Full HD (Recommended)</option>
                <option value="720p">720p HD</option>
                <option value="480p">480p SD</option>
              </select>
            </div>

            {/* Subtitle Language */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Default Subtitle Language
              </label>
              <select
                value={settings.subtitleLanguage}
                onChange={(e) => {
                  const s = { ...settings, subtitleLanguage: e.target.value };
                  handleSave(s);
                }}
                className="w-full bg-[#171a25] text-xs text-slate-200 p-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/[0.06]">
            {/* Auto Play Best Source */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#171a25] border border-white/[0.06]">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Auto-Play Best Source</span>
                <span className="text-[11px] text-slate-400">Instantly launch the highest-ranked source without prompting</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPlayBestSource}
                onChange={(e) => {
                  handleSave({ ...settings, autoPlayBestSource: e.target.checked });
                }}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* Auto Next Episode */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#171a25] border border-white/[0.06]">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Auto-Next Episode</span>
                <span className="text-[11px] text-slate-400">Prompt and transition automatically when near end of TV episodes</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoNextEpisode}
                onChange={(e) => {
                  handleSave({ ...settings, autoNextEpisode: e.target.checked });
                }}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Media Providers Swarm */}
        <div className="p-6 rounded-2xl bg-[#11131a] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Media Provider Swarm</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Only ad-free players (✅) are on by default. Enable the others (⚠️) for more sources — expect ads / pop-ups.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: 'vidlink', name: 'VidLink', desc: '✅ Ad-free · auto-resume · fastest' },
              { id: 'vidfast', name: 'VidFast', desc: '✅ Ad-free · auto-resume · fast' },
              { id: 'videasy', name: 'Videasy', desc: '⚠️ 1 ad on first play · episode selector' },
              { id: 'vixsrc', name: 'VixSrc', desc: '⚠️ Ads / pop-ups · native 1080p' },
              { id: 'vidsrc', name: 'Vidsrc CC v3', desc: '⚠️ Ads / pop-ups · huge catalog' },
              { id: 'vidrock', name: 'VidRock', desc: '⚠️ Ads / pop-ups · backup' },
              { id: 'vidjoy', name: 'VidJoy', desc: '⚠️ Ads / pop-ups · backup' },
              { id: 'webstreamr', name: 'WebStreamr', desc: 'Decentralized streams' },
              { id: 'stremio', name: 'Stremio / Torrentio', desc: 'Torrent aggregator (needs Debrid)' },
              { id: 'torrents', name: 'Torrents Scraper', desc: 'Extra YTS/EZTV — slower, off by default' }
            ].map((p) => {
              const isEnabled = !!settings.providersEnabled[p.id];
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggleProvider(p.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                    isEnabled
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                      : 'bg-[#171a25] border-white/[0.06] text-slate-400 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{p.name}</span>
                      {isEnabled && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{p.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {}}
                    className="w-4 h-4 accent-indigo-600 rounded pointer-events-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Stremio Add-on Ecosystem */}
        <div className="p-6 rounded-2xl bg-[#11131a] border border-white/[0.08]">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Stremio Add-on Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Add Stremio stream add-on manifests (Torrentio, MediaFusion, Comet…). Torrent results need a Debrid service configured below to play.
          </p>

          {/* Installed Add-ons */}
          <div className="space-y-2 mb-5">
            {settings.stremioAddons.map((addon) => (
              <div
                key={addon.id}
                className="p-3 rounded-xl bg-[#171a25] border border-white/[0.06] flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{addon.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      addon.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      {addon.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5 font-mono">
                    {addon.manifestUrl}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAddon(addon.id)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-semibold border border-white/[0.08] cursor-pointer"
                  >
                    {addon.enabled ? 'Disable' : 'Enable'}
                  </button>
                  {addon.id.startsWith('custom-') && (
                    <button
                      onClick={() => handleRemoveAddon(addon.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] cursor-pointer"
                      title="Remove add-on"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Stremio Manifest */}
          <div className="p-4 rounded-xl bg-[#171a25] border border-white/[0.06]">
            <span className="text-xs font-bold text-slate-200 block mb-2">Install Custom Add-on</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Add-on Name (e.g. Torrentio Lite)"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                className="bg-[#11131a] text-xs text-slate-200 p-2 rounded-lg border border-white/[0.08] focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="https://example.com/manifest.json"
                value={newAddonUrl}
                onChange={(e) => setNewAddonUrl(e.target.value)}
                className="bg-[#11131a] text-xs text-slate-200 p-2 rounded-lg border border-white/[0.08] focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={handleAddStremioAddon}
                disabled={!newAddonUrl.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Manifest</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: Debrid Integration */}
        <div className="p-6 rounded-2xl bg-[#11131a] border border-white/[0.08]">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>Debrid High-Speed Unrestricted Streamer</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Connect Real-Debrid, TorBox, AllDebrid, or Premiumize to instantly unlock cached 4K torrent streams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Debrid Provider</label>
              <select
                value={settings.debridService}
                onChange={(e) => {
                  const s = { ...settings, debridService: e.target.value as any };
                  handleSave(s);
                }}
                className="w-full bg-[#171a25] text-xs text-slate-200 p-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="none">Disabled (Direct streams only)</option>
                <option value="realdebrid">Real-Debrid</option>
                <option value="torbox">TorBox</option>
                <option value="alldebrid">AllDebrid</option>
                <option value="premiumize">Premiumize</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">API Token / Secret Key</label>
              <input
                type="password"
                placeholder="Enter your Debrid API key..."
                value={settings.debridApiKey || ''}
                onChange={(e) => {
                  setSettings({ ...settings, debridApiKey: e.target.value });
                }}
                onBlur={() => handleSave()}
                className="w-full bg-[#171a25] text-xs text-slate-200 p-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: Live TV & Custom M3U */}
        <div className="p-6 rounded-2xl bg-[#11131a] border border-white/[0.08]">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Live TV & IPTV Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Manage live feed providers and supply custom M3U playlist URLs
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { id: 'dami', name: 'Dami TV', desc: 'Live sports & events' },
              { id: 'ppv', name: 'PPV Feeds', desc: 'Combat sports & matches' },
              { id: 'cdnLive', name: 'CDN-Live', desc: 'Broadcast TV channels' }
            ].map((p) => {
              const isEnabled = !!settings.liveProvidersEnabled[p.id];
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggleLiveProvider(p.id)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between ${
                    isEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                      : 'bg-[#171a25] border-white/[0.06] text-slate-400 opacity-60'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {}}
                    className="w-4 h-4 accent-emerald-600 rounded pointer-events-none"
                  />
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Custom M3U Playlist URL (Optional)
            </label>
            <input
              type="text"
              placeholder="https://example.com/playlist.m3u8"
              value={settings.customM3uUrl || ''}
              onChange={(e) => {
                setSettings({ ...settings, customM3uUrl: e.target.value });
              }}
              onBlur={() => handleSave()}
              className="w-full bg-[#171a25] text-xs text-slate-200 p-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
