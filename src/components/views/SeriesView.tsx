import React from 'react';
import { Tv } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { BrowseView } from './BrowseView';

interface SeriesViewProps {
  onSelectItem: (item: MediaItem) => void;
  onQuickPlay: (item: MediaItem) => void;
}

export const SeriesView: React.FC<SeriesViewProps> = ({ onSelectItem, onQuickPlay }) => (
  <BrowseView
    containerId="series-view-container"
    icon={Tv}
    heading="TV Shows"
    subheading="Discover trending series, seasons, and episodes"
    mediaType="tv"
    tabs={[
      { id: 'popular', label: 'Popular' },
      { id: 'trending', label: 'Trending' },
      { id: 'top_rated', label: 'Top Rated' },
      { id: 'on_air', label: 'On The Air' }
    ]}
    emptyLabel="No TV series found for this filter."
    onSelectItem={onSelectItem}
    onQuickPlay={onQuickPlay}
  />
);
