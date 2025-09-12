/** REFACTORED: ControlCenter now uses modular components from control-center feature */

import { LayoutTab, PreferencesTab, ThemeTab } from "@/features/chat/components/control-center";
import type { User } from "@supabase/supabase-js";
import {
    AlertTriangle,
    Download,
    Layout,
    Palette,
    RefreshCw,
    Save,
    Settings,
    Sliders,
    Upload,
    Volume2,
    X
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useCustomization } from "../hooks/useCustomization";
import type { SoundTheme, SoundType } from "../hooks/useSoundEffects";
import { useSoundEffects } from "../hooks/useSoundEffects";
import type { UserProfile } from "../types/subscription";
import LoadingSpinner from "./LoadingSpinner";
import SoundSettings from "./SoundSettings";

import { logger } from '../utils/logger';
interface ControlCenterProps {
  user: User;
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

const ControlCenter: React.FC<ControlCenterProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    "theme" | "layout" | "sound" | "preferences"
  >("theme");
  const [selectedColor, setSelectedColor] = useState<string>("#3B82F6");
  const [selectedAccentColor, setSelectedAccentColor] =
    useState<string>("#10B981");
  const [selectedMode, setSelectedMode] = useState<"light" | "dark" | "auto">(
    "light",
  );
  const [selectedFontSize, setSelectedFontSize] = useState<number>(14);
  const [selectedBorderRadius, setSelectedBorderRadius] = useState<number>(8);
  const [selectedHeaderStyle, setSelectedHeaderStyle] = useState<
    "minimal" | "standard" | "expanded"
  >("standard");
  const [selectedWidgetLayout, setSelectedWidgetLayout] = useState<
    "grid" | "list" | "masonry"
  >("grid");
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [showAnimations, setShowAnimations] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Accessibility settings
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [largeText, setLargeText] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  // Sound settings
  const {
    playSound,
    isEnabled: soundEnabled,
    soundTheme,
    volume: soundVolume,
    setVolume: setSoundVolume,
  } = useSoundEffects();

  const {
    customization,
    updateCustomization,
    updateThemeColors,
    saveCustomization,
    resetToDefaults,
    hasUnsavedChanges,
  } = useCustomization();

  // Initialize state from customization
  useEffect(() => {
    if (customization) {
      setSelectedColor(customization.theme.primaryColor);
      setSelectedAccentColor(customization.theme.accentColor);
      setSelectedMode(customization.theme.mode);
      setSelectedFontSize(customization.theme.fontSize);
      setSelectedBorderRadius(customization.theme.borderRadius);
      setSelectedHeaderStyle(customization.layout.headerStyle);
      setSelectedWidgetLayout(customization.layout.widgetLayout);
      setCompactMode(customization.layout.compactMode);
      setShowAnimations(customization.layout.showAnimations);
      setHighContrast(customization.preferences.accessibility.highContrast);
      setLargeText(customization.preferences.accessibility.largeText);
      setReduceMotion(customization.preferences.accessibility.reduceMotion);
    }
  }, [customization]);

  // Update hasChanges state
  useEffect(() => {
    setHasChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    setIsLoading(true);
    playSound("click");

    try {
      await saveCustomization();
      playSound("success");
    } catch (error) {
      logger.error("Failed to save customization:", error);
      playSound("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
    playSound("notification");
  };

  const confirmReset = () => {
    resetToDefaults();
    setShowResetConfirm(false);
    playSound("success");
  };

  const handleTabChange = (
    tab: "theme" | "layout" | "sound" | "preferences",
  ) => {
    setActiveTab(tab);
    playSound("click");
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    updateThemeColors(color, selectedAccentColor);
    playSound("click");
  };

  const handleAccentColorChange = (color: string) => {
    setSelectedAccentColor(color);
    updateThemeColors(selectedColor, color);
    playSound("click");
  };

  const handleModeChange = (mode: "light" | "dark" | "auto") => {
    setSelectedMode(mode);
    updateCustomization("theme.mode", mode);
    playSound("click");
  };

  const handleFontSizeChange = (size: number) => {
    setSelectedFontSize(size);
    updateCustomization("theme.fontSize", size);
    playSound("click");
  };

  const handleBorderRadiusChange = (radius: number) => {
    setSelectedBorderRadius(radius);
    updateCustomization("theme.borderRadius", radius);
    playSound("click");
  };

  const handleHeaderStyleChange = (
    style: "minimal" | "standard" | "expanded",
  ) => {
    setSelectedHeaderStyle(style);
    updateCustomization("layout.headerStyle", style);
    playSound("click");
  };

  const handleWidgetLayoutChange = (layout: "grid" | "list" | "masonry") => {
    setSelectedWidgetLayout(layout);
    updateCustomization("layout.widgetLayout", layout);
    playSound("click");
  };

  const handleCompactModeToggle = () => {
    setCompactMode(!compactMode);
    updateCustomization("layout.compactMode", !compactMode);
    playSound("toggle");
  };

  const handleShowAnimationsToggle = () => {
    setShowAnimations(!showAnimations);
    updateCustomization("layout.showAnimations", !showAnimations);
    playSound("toggle");
  };

  const handleHighContrastToggle = () => {
    setHighContrast(!highContrast);
    updateCustomization(
      "preferences.accessibility.highContrast",
      !highContrast,
    );
    playSound("toggle");
  };

  const handleLargeTextToggle = () => {
    setLargeText(!largeText);
    updateCustomization("preferences.accessibility.largeText", !largeText);
    playSound("toggle");
  };

  const handleReduceMotionToggle = () => {
    setReduceMotion(!reduceMotion);
    updateCustomization(
      "preferences.accessibility.reduceMotion",
      !reduceMotion,
    );
    playSound("toggle");
  };

  const handleToggleSoundEffects = () => {
    updateCustomization("preferences.soundEffects", !soundEnabled);
    playSound("toggle");
  };

  const handleChangeSoundTheme = (theme: SoundTheme) => {
    updateCustomization("preferences.soundTheme", theme);
    playSound("click");
  };

  const handleSoundVolumeChange = (volume: number) => {
    setSoundVolume(volume);
    updateCustomization("preferences.soundVolume", volume);
  };

  const handlePlayTestSound = (type: SoundType) => {
    playSound(type);
  };

  if (!isOpen) return null;

  // Import/Export handlers
  const handleExportSettings = () => {
    const dataStr = JSON.stringify(customization, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

    const link = document.createElement("a");
    link.setAttribute("href", dataUri);
    link.setAttribute("download", "atlas-settings.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    playSound("success");
  };

  const handleImportSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Apply imported settings
        if (json.theme) {
          setSelectedColor(json.theme.primaryColor || "#3B82F6");
          setSelectedAccentColor(json.theme.accentColor || "#10B981");
          setSelectedMode(json.theme.mode || "light");
          setSelectedFontSize(json.theme.fontSize || 14);
          setSelectedBorderRadius(json.theme.borderRadius || 8);

          updateThemeColors(
            json.theme.primaryColor || "#3B82F6",
            json.theme.accentColor || "#10B981",
          );
          updateCustomization("theme.mode", json.theme.mode || "light");
          updateCustomization("theme.fontSize", json.theme.fontSize || 14);
          updateCustomization("theme.borderRadius", json.theme.borderRadius || 8);
        }

        if (json.layout) {
          setSelectedHeaderStyle(json.layout.headerStyle || "standard");
          setSelectedWidgetLayout(json.layout.widgetLayout || "grid");
          setCompactMode(json.layout.compactMode || false);
          setShowAnimations(json.layout.showAnimations !== false);

          updateCustomization("layout.headerStyle", json.layout.headerStyle || "standard");
          updateCustomization("layout.widgetLayout", json.layout.widgetLayout || "grid");
          updateCustomization("layout.compactMode", json.layout.compactMode || false);
          updateCustomization("layout.showAnimations", json.layout.showAnimations !== false);
        }

        if (json.preferences?.accessibility) {
          setHighContrast(json.preferences.accessibility.highContrast || false);
          setLargeText(json.preferences.accessibility.largeText || false);
          setReduceMotion(json.preferences.accessibility.reduceMotion || false);

          updateCustomization(
            "preferences.accessibility.highContrast",
            json.preferences.accessibility.highContrast || false,
          );
          updateCustomization(
            "preferences.accessibility.largeText",
            json.preferences.accessibility.largeText || false,
          );
          updateCustomization(
            "preferences.accessibility.reduceMotion",
            json.preferences.accessibility.reduceMotion || false,
          );
        }

        playSound("success");
      } catch (error) {
        logger.error("Failed to parse settings file:", error);
        playSound("error");
      }
    };
    reader.readAsText(file);
  };




  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Language & Region
        </h3>

        <div className="space-y-4">
          {/* Language */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Language</h4>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={customization?.preferences?.language || "en"}
              onChange={(e) =>
                updateCustomization("preferences.language", e.target.value)
              }
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
          </div>

          {/* Timezone */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Timezone</h4>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={customization?.preferences?.timezone || "UTC"}
              onChange={(e) =>
                updateCustomization("preferences.timezone", e.target.value)
              }
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Date Format</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
                { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
                { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
              ].map((format) => (
                <button
                  key={format.value}
                  onClick={() =>
                    updateCustomization("preferences.dateFormat", format.value)
                  }
                  className={`p-2 border rounded-lg transition-colors ${
                    customization?.preferences?.dateFormat === format.value
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior</h3>

        <div className="space-y-4">
          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Auto Save</h4>
              <p className="text-sm text-gray-600">
                Automatically save changes
              </p>
            </div>
            <button
              onClick={() =>
                updateCustomization(
                  "preferences.autoSave",
                  !customization?.preferences?.autoSave,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.autoSave
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={customization?.preferences?.autoSave}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.autoSave
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Notifications</h4>
              <p className="text-sm text-gray-600">Show system notifications</p>
            </div>
            <button
              onClick={() =>
                updateCustomization(
                  "preferences.notifications",
                  !customization?.preferences?.notifications,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.notifications
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={customization?.preferences?.notifications}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.notifications
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Keyboard Shortcuts</h4>
              <p className="text-sm text-gray-600">Enable keyboard shortcuts</p>
            </div>
            <button
              onClick={() =>
                updateCustomization(
                  "preferences.keyboardShortcuts",
                  !customization?.preferences?.keyboardShortcuts,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                customization?.preferences?.keyboardShortcuts
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={customization?.preferences?.keyboardShortcuts}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  customization?.preferences?.keyboardShortcuts
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Import/Export */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Import/Export
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              // Export settings as JSON
              const dataStr = JSON.stringify(customization, null, 2);
              const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

              const link = document.createElement("a");
              link.setAttribute("href", dataUri);
              link.setAttribute("download", "atlas-settings.json");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              playSound("success");
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Settings</span>
          </button>

          <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Settings</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const json = JSON.parse(event.target?.result as string);

                    // Apply imported settings
                    if (json.theme) {
                      setSelectedColor(json.theme.primaryColor || "#3B82F6");
                      setSelectedAccentColor(
                        json.theme.accentColor || "#10B981",
                      );
                      setSelectedMode(json.theme.mode || "light");
                      setSelectedFontSize(json.theme.fontSize || 14);
                      setSelectedBorderRadius(json.theme.borderRadius || 8);

                      updateThemeColors(
                        json.theme.primaryColor || "#3B82F6",
                        json.theme.accentColor || "#10B981",
                      );
                      updateCustomization(
                        "theme.mode",
                        json.theme.mode || "light",
                      );
                      updateCustomization(
                        "theme.fontSize",
                        json.theme.fontSize || 14,
                      );
                      updateCustomization(
                        "theme.borderRadius",
                        json.theme.borderRadius || 8,
                      );
                    }

                    if (json.layout) {
                      setSelectedHeaderStyle(
                        json.layout.headerStyle || "standard",
                      );
                      setSelectedWidgetLayout(
                        json.layout.widgetLayout || "grid",
                      );
                      setCompactMode(json.layout.compactMode || false);
                      setShowAnimations(json.layout.showAnimations !== false);

                      updateCustomization(
                        "layout.headerStyle",
                        json.layout.headerStyle || "standard",
                      );
                      updateCustomization(
                        "layout.widgetLayout",
                        json.layout.widgetLayout || "grid",
                      );
                      updateCustomization(
                        "layout.compactMode",
                        json.layout.compactMode || false,
                      );
                      updateCustomization(
                        "layout.showAnimations",
                        json.layout.showAnimations !== false,
                      );
                    }

                    if (json.preferences?.accessibility) {
                      setHighContrast(
                        json.preferences.accessibility.highContrast || false,
                      );
                      setLargeText(
                        json.preferences.accessibility.largeText || false,
                      );
                      setReduceMotion(
                        json.preferences.accessibility.reduceMotion || false,
                      );

                      updateCustomization(
                        "preferences.accessibility.highContrast",
                        json.preferences.accessibility.highContrast || false,
                      );
                      updateCustomization(
                        "preferences.accessibility.largeText",
                        json.preferences.accessibility.largeText || false,
                      );
                      updateCustomization(
                        "preferences.accessibility.reduceMotion",
                        json.preferences.accessibility.reduceMotion || false,
                      );
                    }

                    playSound("success");
                  } catch (error) {
                    logger.error("Failed to parse settings file:", error);
                    playSound("error");
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl border border-gray-300 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        style={{ filter: "none", backdropFilter: "none" }}
      >
        {/* Header for mobile */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sliders className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Control Center
                </h2>
                <p className="text-xs text-gray-600">
                  Customize your Atlas experience
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Horizontal scrollable tabs for mobile */}
          <div className="flex overflow-x-auto mt-4 pb-2 gap-2 scrollbar-thin">
            <button
              onClick={() => setActiveTab("theme")}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "theme"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Theme</span>
            </button>

            <button
              onClick={() => setActiveTab("layout")}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "layout"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>Layout</span>
            </button>

            <button
              onClick={() => setActiveTab("sound")}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "sound"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Sound</span>
            </button>

            <button
              onClick={() => setActiveTab("preferences")}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "preferences"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Preferences</span>
            </button>
          </div>
        </div>

        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden md:block w-64 border-r border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sliders className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Control Center
              </h2>
              <p className="text-gray-600 text-sm">
                Customize your Atlas experience
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => handleTabChange("theme")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "theme"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Palette className="w-5 h-5" />
              <span className="font-medium">Theme</span>
            </button>

            <button
              onClick={() => handleTabChange("layout")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "layout"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Layout className="w-5 h-5" />
              <span className="font-medium">Layout</span>
            </button>

            <button
              onClick={() => handleTabChange("sound")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "sound"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Volume2 className="w-5 h-5" />
              <span className="font-medium">Sound</span>
            </button>

            <button
              onClick={() => handleTabChange("preferences")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "preferences"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Preferences</span>
            </button>
          </nav>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="space-y-4">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? "Saving..." : "Save Changes"}</span>
              </button>

              <button
                onClick={handleReset}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            {hasChanges && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    You have unsaved changes. Click "Save Changes" to apply
                    them.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Close button for desktop */}
          <div className="hidden md:flex justify-end p-4 border-b border-gray-200">
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {activeTab === "theme" && (
              <ThemeTab
                selectedColor={selectedColor}
                selectedAccentColor={selectedAccentColor}
                selectedMode={selectedMode}
                selectedFontSize={selectedFontSize}
                selectedBorderRadius={selectedBorderRadius}
                onColorChange={handleColorChange}
                onAccentColorChange={handleAccentColorChange}
                onModeChange={handleModeChange}
                onFontSizeChange={handleFontSizeChange}
                onBorderRadiusChange={handleBorderRadiusChange}
              />
            )}
            {activeTab === "layout" && (
              <LayoutTab
                selectedHeaderStyle={selectedHeaderStyle}
                selectedWidgetLayout={selectedWidgetLayout}
                compactMode={compactMode}
                showAnimations={showAnimations}
                highContrast={highContrast}
                largeText={largeText}
                reduceMotion={reduceMotion}
                onHeaderStyleChange={handleHeaderStyleChange}
                onWidgetLayoutChange={handleWidgetLayoutChange}
                onCompactModeToggle={handleCompactModeToggle}
                onShowAnimationsToggle={handleShowAnimationsToggle}
                onHighContrastToggle={handleHighContrastToggle}
                onLargeTextToggle={handleLargeTextToggle}
                onReduceMotionToggle={handleReduceMotionToggle}
              />
            )}
            {activeTab === "sound" && (
              <SoundSettings
                isEnabled={soundEnabled}
                onToggleEnabled={handleToggleSoundEffects}
                soundTheme={soundTheme}
                onChangeSoundTheme={handleChangeSoundTheme}
                volume={soundVolume}
                onVolumeChange={handleSoundVolumeChange}
                onPlayTestSound={handlePlayTestSound}
              />
            )}
            {activeTab === "preferences" && (
              <PreferencesTab
                customization={customization}
                updateCustomization={updateCustomization}
                onExportSettings={handleExportSettings}
                onImportSettings={handleImportSettings}
                playSound={playSound}
              />
            )}
          </div>

          {/* Mobile action buttons */}
          <div className="md:hidden p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isLoading ? "Saving..." : "Save"}</span>
              </button>

              <button
                onClick={handleReset}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>

            {hasChanges && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    You have unsaved changes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl border border-gray-300 p-6 max-w-md w-full"
            style={{ filter: "none", backdropFilter: "none" }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Reset to Defaults?
            </h3>
            <p className="text-gray-600 mb-6">
              This will reset all your customizations to the default settings.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  playSound("click");
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlCenter;


