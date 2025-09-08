import { Filter, Search } from 'lucide-react';
import React from 'react';

type Filters = { 
  q: string; 
  sort: "recent" | "title"; 
  from?: Date | null; 
  to?: Date | null; 
  showPinnedFirst?: boolean; 
};

interface FiltersProps {
  value: Filters;
  onChange: (filters: Filters) => void;
  onSoundPlay?: (soundType: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  value,
  onChange,
  onSoundPlay,
}) => {
  const handleSearchChange = (query: string) => {
    onChange({ ...value, q: query });
  };

  const handleSortChange = (sort: "recent" | "title") => {
    onChange({ ...value, sort });
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handlePinnedFirstChange = (showPinnedFirst: boolean) => {
    onChange({ ...value, showPinnedFirst });
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={value.q}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Sort By */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Filter className="w-4 h-4 inline mr-1" />
            Sort By
          </label>
          <select
            value={value.sort}
            onChange={(e) => handleSortChange(e.target.value as "recent" | "title")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="title">Title</option>
          </select>
        </div>

        {/* Show Pinned First */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pinned First
          </label>
          <select
            value={value.showPinnedFirst ? 'true' : 'false'}
            onChange={(e) => handlePinnedFirstChange(e.target.value === 'true')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      {value.q && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Active filters:</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
            Search: "{value.q}"
          </span>
        </div>
      )}
    </div>
  );
};

export default Filters;
