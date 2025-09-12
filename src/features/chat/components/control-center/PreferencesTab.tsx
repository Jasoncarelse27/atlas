import { Download, Upload } from 'lucide-react';
import React from 'react';

interface PreferencesTabProps {
  _customization: unknown;
  updateCustomization: (path: string, _value: unknown) => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
  playSound: (type: string) => void;
}

const PreferencesTab: React.FC<PreferencesTabProps> = ({
  customization,
  updateCustomization,
  onExportSettings,
  onImportSettings,
  playSound,
}) => {
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSettings(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Language & Region */}
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
            onClick={onExportSettings}
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
              onChange={handleFileImport}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default PreferencesTab;
