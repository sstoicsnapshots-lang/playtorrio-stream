import React from 'react';
import { Film } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { BrowseView } from './BrowseView';

interface MoviesViewProps {
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

export const MoviesView: React.FC<MoviesViewProps> = ({ onSelectItem, onQuickPlay }) => (
  <BrowseView
    containerId="movies-view-container"
    icon={Film}
    heading="Movies"
    subheading="Browse popular, trending, and top-rated movies"
    mediaType="movie"
    tabs={[
      { id: 'popular', label: 'Popular' },
      { id: 'trending', label: 'Trending' },
      { id: 'top_rated', label: 'Top Rated' },
      { id: 'upcoming', label: 'Upcoming' }
    ]}
    emptyLabel="No movies found for this filter."
    onSelectItem={onSelectItem}
    onQuickPlay={onQuickPlay}
  />
);
