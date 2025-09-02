import {
    AlertTriangle,
    Download,
    Trash,
    Upload
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { SoundType } from '../hooks/useSoundEffects';
import type { Conversation } from '../types/chat';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';

interface ConversationFooterProps {
  conversations: Conversation[];
  onClearAll: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ConversationFooter: React.FC<ConversationFooterProps> = ({
  conversations,
  onClearAll,
  onSoundPlay
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportConversations = () => {
    setIsExporting(true);
    if (onSoundPlay) onSoundPlay('click');
    
    try {
      const dataStr = JSON.stringify(conversations, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileName = `atlas-conversations-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
      
      if (onSoundPlay) onSoundPlay('success');
    } catch (error) {
      console.error('Failed to export conversations:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (onSoundPlay) onSoundPlay('click');
    fileInputRef.current?.click();
  };

  const handleImportConversations = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedConversations = JSON.parse(content) as Conversation[];
        
        // Validate the imported data
        if (!Array.isArray(importedConversations)) {
          throw new Error('Invalid format: Expected an array of conversations');
        }
        
        // TODO: Add more validation and actually import the conversations
        console.log('Would import conversations:', importedConversations);
        
        if (onSoundPlay) onSoundPlay('success');
      } catch (error) {
        console.error('Failed to import conversations:', error);
        if (onSoundPlay) onSoundPlay('error');
      } finally {
        setIsImporting(false);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.onerror = () => {
      console.error('Failed to read file');
      setIsImporting(false);
      if (onSoundPlay) onSoundPlay('error');
    };
    
    reader.readAsText(file);
  };

  const handleConfirmClearAll = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowClearConfirm(true);
  };

  const handleClearAllConversations = () => {
    if (onSoundPlay) onSoundPlay('error');
    onClearAll();
    setShowClearConfirm(false);
  };

  const handleCancelClearAll = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowClearConfirm(false);
  };

  return (
    <div className="p-3 border-t border-gray-200 bg-gray-50">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Tooltip content="Export conversations">
            <button
              onClick={handleExportConversations}
              disabled={isExporting || conversations.length === 0}
              className="neumorphic-button p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          
          <Tooltip content="Import conversations">
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="neumorphic-button p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </button>
          </Tooltip>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportConversations}
            className="hidden"
          />
        </div>
        
        <Tooltip content="Clear all conversations">
          <button
            onClick={handleConfirmClearAll}
            disabled={conversations.length === 0}
            className="neumorphic-button p-2 text-red-600 hover:text-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      
      {/* Clear All Confirmation */}
      {showClearConfirm && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete all conversations? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCancelClearAll}
              className="neumorphic-button flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllConversations}
              className="neumorphic-button flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Delete All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationFooter;
