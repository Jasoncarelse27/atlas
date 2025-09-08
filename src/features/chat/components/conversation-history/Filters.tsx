import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';

interface FiltersProps {
  searchQuery: string;
  dateFilter: 'all' | 'today' | 'week' | 'month';
  sortBy: 'date' | 'title' | 'messages';
  sortOrder: 'asc' | 'desc';
  onSearchChange: (query: string) => void;
  onDateFilterChange: (filter: 'all' | 'today' | 'week' | 'month') => void;
  onSortChange: (sortBy: 'date' | 'title' | 'messages') => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onSoundPlay?: (soundType: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  searchQuery,
  dateFilter,
  sortBy,
  sortOrder,
  onSearchChange,
  onDateFilterChange,
  onSortChange,
  onSortOrderChange,
  onSoundPlay,
}) => {
  const dateFilterOptions = [
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
  ];

  const sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'title', label: 'Title' },
    { value: 'messages', label: 'Messages' },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="w-4 h-4 inline mr-1" />
            Date Range
          </label>
          <select
            value={dateFilter}
            onChange={(e) => {
              onDateFilterChange(e.target.value as 'all' | 'today' | 'week' | 'month');
              if (onSoundPlay) {
                onSoundPlay('click');
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {dateFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Filter className="w-4 h-4 inline mr-1" />
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => {
              onSortChange(e.target.value as 'date' | 'title' | 'messages');
              if (onSoundPlay) {
                onSoundPlay('click');
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <select
            value={sortOrder}
            onChange={(e) => {
              onSortOrderChange(e.target.value as 'asc' | 'desc');
              if (onSoundPlay) {
                onSoundPlay('click');
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(searchQuery || dateFilter !== 'all') && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Active filters:</span>
          {searchQuery && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
              Search: "{searchQuery}"
            </span>
          )}
          {dateFilter !== 'all' && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
              {dateFilterOptions.find(opt => opt.value === dateFilter)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Filters;
