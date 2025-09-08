import React from 'react';

interface LayoutTabProps {
  selectedHeaderStyle: 'minimal' | 'standard' | 'expanded';
  selectedWidgetLayout: 'grid' | 'list' | 'masonry';
  compactMode: boolean;
  showAnimations: boolean;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  onHeaderStyleChange: (style: 'minimal' | 'standard' | 'expanded') => void;
  onWidgetLayoutChange: (layout: 'grid' | 'list' | 'masonry') => void;
  onCompactModeToggle: () => void;
  onShowAnimationsToggle: () => void;
  onHighContrastToggle: () => void;
  onLargeTextToggle: () => void;
  onReduceMotionToggle: () => void;
}

const LayoutTab: React.FC<LayoutTabProps> = ({
  selectedHeaderStyle,
  selectedWidgetLayout,
  compactMode,
  showAnimations,
  highContrast,
  largeText,
  reduceMotion,
  onHeaderStyleChange,
  onWidgetLayoutChange,
  onCompactModeToggle,
  onShowAnimationsToggle,
  onHighContrastToggle,
  onLargeTextToggle,
  onReduceMotionToggle,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Style */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Header Style
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onHeaderStyleChange("minimal")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === "minimal"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-6 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-8 h-3 bg-gray-400 rounded-full" />
              </div>
              <span className="font-medium">Minimal</span>
            </div>
          </button>

          <button
            onClick={() => onHeaderStyleChange("standard")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === "standard"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-8 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-8 h-3 bg-gray-400 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                </div>
              </div>
              <span className="font-medium">Standard</span>
            </div>
          </button>

          <button
            onClick={() => onHeaderStyleChange("expanded")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedHeaderStyle === "expanded"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-10 bg-gray-200 rounded-lg flex items-center px-2">
                <div className="w-10 h-4 bg-gray-400 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                  <div className="w-6 h-6 bg-gray-400 rounded-full" />
                </div>
              </div>
              <span className="font-medium">Expanded</span>
            </div>
          </button>
        </div>
      </div>

      {/* Widget Layout */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Widget Layout
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onWidgetLayoutChange("grid")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === "grid"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-2 gap-1 h-full">
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                  <div className="bg-gray-400 rounded" />
                </div>
              </div>
              <span className="font-medium">Grid</span>
            </div>
          </button>

          <button
            onClick={() => onWidgetLayoutChange("list")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === "list"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1 flex flex-col gap-1">
                <div className="bg-gray-400 rounded h-1/3" />
                <div className="bg-gray-400 rounded h-1/3" />
                <div className="bg-gray-400 rounded h-1/3" />
              </div>
              <span className="font-medium">List</span>
            </div>
          </button>

          <button
            onClick={() => onWidgetLayoutChange("masonry")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedWidgetLayout === "masonry"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-16 bg-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-3 gap-1 h-full">
                  <div className="bg-gray-400 rounded col-span-2 row-span-1" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-2" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-1" />
                  <div className="bg-gray-400 rounded col-span-1 row-span-1" />
                </div>
              </div>
              <span className="font-medium">Masonry</span>
            </div>
          </button>
        </div>
      </div>

      {/* Layout Options */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Layout Options
        </h3>

        <div className="space-y-4">
          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Compact Mode</h4>
              <p className="text-sm text-gray-600">
                Reduce spacing for a denser layout
              </p>
            </div>
            <button
              onClick={onCompactModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                compactMode ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={compactMode}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  compactMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Show Animations */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Show Animations</h4>
              <p className="text-sm text-gray-600">
                Enable UI animations and transitions
              </p>
            </div>
            <button
              onClick={onShowAnimationsToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showAnimations ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={showAnimations}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAnimations ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Accessibility */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Accessibility
        </h3>

        <div className="space-y-4">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">High Contrast</h4>
              <p className="text-sm text-gray-600">
                Increase contrast for better visibility
              </p>
            </div>
            <button
              onClick={onHighContrastToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                highContrast ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={highContrast}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  highContrast ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Large Text */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Large Text</h4>
              <p className="text-sm text-gray-600">
                Increase text size throughout the app
              </p>
            </div>
            <button
              onClick={onLargeTextToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                largeText ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={largeText}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  largeText ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Reduce Motion</h4>
              <p className="text-sm text-gray-600">
                Minimize animations and motion effects
              </p>
            </div>
            <button
              onClick={onReduceMotionToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                reduceMotion ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={reduceMotion}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  reduceMotion ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutTab;
