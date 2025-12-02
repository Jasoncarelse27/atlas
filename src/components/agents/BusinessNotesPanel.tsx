// Atlas Business Notes Panel Component
// Displays and creates business notes

import { formatDistanceToNow } from 'date-fns';
import { FileText, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useCreateBusinessNote } from '../../hooks/useAgentsDashboard';
import type { BusinessNote } from '../../services/agentsService';

interface BusinessNotesPanelProps {
  notes: BusinessNote[];
  isLoading: boolean;
}

const BusinessNotesPanel: React.FC<BusinessNotesPanelProps> = ({
  notes,
  isLoading
}) => {
  const [noteContent, setNoteContent] = useState('');
  const createNoteMutation = useCreateBusinessNote();

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;

    try {
      await createNoteMutation.mutateAsync(noteContent.trim());
      setNoteContent('');
    } catch (error) {
      // Error handled by mutation hook (toast)
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Add Note Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Add a note..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] dark:focus:ring-[#B2BDA3] resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSaveNote();
              }
            }}
          />
          <button
            onClick={handleSaveNote}
            disabled={!noteContent.trim() || createNoteMutation.isLoading}
            className="w-full px-4 py-2 bg-[#B2BDA3] hover:bg-[#8FA67E] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {createNoteMutation.isLoading ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="overflow-y-auto max-h-[500px]">
        {notes.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No notes yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Add your first note above
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap mb-2">
                  {note.content}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                  {note.source !== 'manual' && (
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                      {note.source}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessNotesPanel;

