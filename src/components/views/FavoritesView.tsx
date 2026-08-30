import React, { useState, useEffect } from 'react';
import { Heart, Film, Tv, Play } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { storage } from '../../services/storage';
import { MediaCard } from '../common/MediaCard';

interface FavoritesViewProps {
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  onSelectItem,
  onQuickPlay
}) => {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);

  useEffect(() => {
    setFavorites(storage.getFavorites());
  }, []);

  return (
    <div id="favorites-view" className="p-8 pb-16 animate-fadeIn font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          <span>Watchlist</span>
        </h1>
        <p className="text-xs text-[#808799] font-medium mt-1">Your saved movies and TV shows</p>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {favorites.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={onSelectItem}
              onQuickPlay={onQuickPlay}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-slate-400 bg-[#12141c] rounded-3xl border border-[#222736] max-w-lg mx-auto p-6 shadow-xl">
          <Heart className="w-12 h-12 text-[#2b3040] mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-200">Your Watchlist is Empty</p>
          <p className="text-xs text-[#787f92] mt-1 font-medium">Click the heart icon on any title details to save it to your watchlist.</p>
        </div>
      )}
    </div>
  );
};
