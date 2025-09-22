import React from 'react';
import { useFeatureAccess } from '../hooks/useTierAccess';
import { logFeatureAttempt } from '../services/featureService';
import toast from 'react-hot-toast';

interface ImageButtonProps {
  onImageUpload: (file: File) => void;
}

export function ImageButton({ onImageUpload }: ImageButtonProps) {
  const { canUse, attemptFeature } = useFeatureAccess('image');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Check if user has access to image features
    const hasAccess = await attemptFeature();
    if (!hasAccess) {
      // Log the blocked attempt
      await logFeatureAttempt('image', false, true);
      return; // attemptFeature already shows upgrade modal
    }

    // Log successful access
    await logFeatureAttempt('image', true, false);

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Image file is too large. Please select an image under 10MB');
      return;
    }

    try {
      onImageUpload(file);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }

    // Reset the input
    e.target.value = '';
  };

  return (
    <label className={`p-2 rounded-full cursor-pointer transition-all duration-200 ${
      canUse 
        ? 'bg-[#B2BDA3] text-white hover:bg-[#9BA892]' 
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }`}>
      📷
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={!canUse}
      />
    </label>
  );
}
