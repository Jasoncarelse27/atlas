import { Moon, Sun } from 'lucide-react';
import React from 'react';

interface ThemeTabProps {
  selectedColor: string;
  selectedAccentColor: string;
  selectedMode: 'light' | 'dark' | 'auto';
  selectedFontSize: number;
  selectedBorderRadius: number;
  onColorChange: (color: string) => void;
  onAccentColorChange: (color: string) => void;
  onModeChange: (mode: 'light' | 'dark' | 'auto') => void;
  onFontSizeChange: (size: number) => void;
  onBorderRadiusChange: (radius: number) => void;
}

const colorOptions = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Green", value: "#10B981" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Indigo", value: "#6366F1" },
];

const accentColorOptions = [
  { name: "Green", value: "#10B981" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Indigo", value: "#6366F1" },
];

const fontSizeOptions = [
  { name: "Small", value: 12 },
  { name: "Medium", value: 14 },
  { name: "Large", value: 16 },
  { name: "Extra Large", value: 18 },
];

const borderRadiusOptions = [
  { name: "None", value: 0 },
  { name: "Small", value: 4 },
  { name: "Medium", value: 8 },
  { name: "Large", value: 12 },
  { name: "Extra Large", value: 16 },
];

const ThemeTab: React.FC<ThemeTabProps> = ({
  selectedColor,
  selectedAccentColor,
  selectedMode,
  selectedFontSize,
  selectedBorderRadius,
  onColorChange,
  onAccentColorChange,
  onModeChange,
  onFontSizeChange,
  onBorderRadiusChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Color Theme */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Color Theme
        </h3>

        <div className="space-y-4">
          {/* Primary Color */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Primary Color</h4>
            <div className="grid grid-cols-5 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onColorChange(color.value)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedColor === color.value
                      ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`${color.name} primary color`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Accent Color</h4>
            <div className="grid grid-cols-5 gap-2">
              {accentColorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onAccentColorChange(color.value)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    selectedAccentColor === color.value
                      ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`${color.name} accent color`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Color Preview */}
          <div className="p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-700">Preview</h4>
            </div>
            <div className="flex flex-col gap-3">
              <div
                className="h-10 rounded-lg flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedColor }}
              >
                Primary Color
              </div>
              <div
                className="h-10 rounded-lg flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedAccentColor }}
              >
                Accent Color
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium flex-1"
                  style={{ backgroundColor: selectedColor }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium flex-1"
                  style={{ backgroundColor: selectedAccentColor }}
                >
                  Accent Button
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mode</h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onModeChange("light")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === "light"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Sun className="w-6 h-6 text-amber-500" />
              <span className="font-medium">Light</span>
            </div>
          </button>

          <button
            onClick={() => onModeChange("dark")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === "dark"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Moon className="w-6 h-6 text-indigo-600" />
              <span className="font-medium">Dark</span>
            </div>
          </button>

          <button
            onClick={() => onModeChange("auto")}
            className={`p-4 rounded-lg border transition-colors ${
              selectedMode === "auto"
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Sun className="w-6 h-6 text-amber-500 absolute -left-1 -top-1 transform scale-75" />
                <Moon className="w-6 h-6 text-indigo-600 absolute -right-1 -bottom-1 transform scale-75" />
              </div>
              <span className="font-medium">Auto</span>
            </div>
          </button>
        </div>
      </div>

      {/* Typography & Borders */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Typography & Borders
        </h3>

        <div className="space-y-4">
          {/* Font Size */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Font Size</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onFontSizeChange(option.value)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedFontSize === option.value
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-center">
                    <span
                      className="font-medium"
                      style={{ fontSize: `${option.value}px` }}
                    >
                      {option.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Border Radius</h4>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {borderRadiusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onBorderRadiusChange(option.value)}
                  className={`p-3 rounded-lg border transition-colors ${
                    selectedBorderRadius === option.value
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-8 h-8 border-2 border-gray-400"
                      style={{ borderRadius: `${option.value}px` }}
                    />
                    <span className="text-xs font-medium">{option.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeTab;
