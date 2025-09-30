import React, { useCallback, useRef, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { imageService } from '../services/imageService';

interface ImageUploaderProps {
  onImageSelected: (imageUrl: string, metadata: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  isVisible: boolean;
  userId: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  selectedFile: File | null;
  previewUrl: string | null;
}

export function ImageUploader({ 
  onImageSelected, 
  onError, 
  onCancel, 
  isVisible,
  userId
}: ImageUploaderProps) {
  const { isOnline } = useNetworkStatus();
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    selectedFile: null,
    previewUrl: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!imageService.isFormatSupported(file.type)) {
      onError(`Unsupported image format. Supported formats: ${imageService.getSupportedFormats().join(', ')}`);
      return;
    }

    if (file.size > imageService.getMaxFileSize()) {
      onError(`Image too large. Maximum size is ${imageService.getMaxFileSize() / (1024 * 1024)}MB`);
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setUploadState(prev => ({
      ...prev,
      selectedFile: file,
      previewUrl,
    }));
  }, [onError]);

  // Handle camera capture
  const handleCameraCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setUploadState(prev => ({
      ...prev,
      selectedFile: file,
      previewUrl,
    }));
  }, []);

  // Upload image
  const uploadImage = useCallback(async () => {
    if (!uploadState.selectedFile || !isOnline) return;

    try {
      setUploadState(prev => ({ ...prev, isUploading: true, progress: 0 }));

      // Simulate progress (in real implementation, this would come from upload)
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 100);

      // Upload to image service
      const result = await imageService.uploadImage(uploadState.selectedFile, userId);

      clearInterval(progressInterval);
      setUploadState(prev => ({ ...prev, progress: 100 }));

      // Call success callback
      onImageSelected(result.url, result.metadata);

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploadState(prev => ({ ...prev, isUploading: false, progress: 0 }));
    }
  }, [uploadState.selectedFile, isOnline, onImageSelected, onError]);

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Open camera
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      selectedFile: null,
      previewUrl: null,
    });
    
    // Clean up preview URL
    if (uploadState.previewUrl) {
      URL.revokeObjectURL(uploadState.previewUrl);
    }
  }, [uploadState.previewUrl]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    resetState();
    onCancel();
  }, [resetState, onCancel]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Add Image
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Upload Options */}
          {!uploadState.selectedFile && (
            <div className="space-y-3">
              {/* Camera Button */}
              <button
                onClick={openCamera}
                disabled={!isOnline}
                className={`w-full flex items-center justify-center space-x-3 p-4 border-2 border-dashed rounded-lg transition-colors ${
                  isOnline 
                    ? 'border-blue-300 hover:border-blue-400 hover:bg-blue-50' 
                    : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                }`}
              >
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={isOnline ? 'text-blue-600' : 'text-gray-500'}>
                  {isOnline ? 'Take Photo' : 'Camera Unavailable Offline'}
                </span>
              </button>

              {/* Gallery Button */}
              <button
                onClick={openFilePicker}
                disabled={!isOnline}
                className={`w-full flex items-center justify-center space-x-3 p-4 border-2 border-dashed rounded-lg transition-colors ${
                  isOnline 
                    ? 'border-green-300 hover:border-green-400 hover:bg-green-50' 
                    : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                }`}
              >
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className={isOnline ? 'text-green-600' : 'text-gray-500'}>
                  {isOnline ? 'Choose from Gallery' : 'Gallery Unavailable Offline'}
                </span>
              </button>

              {/* Offline Notice */}
              {!isOnline && (
                <div className="text-center text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg">
                  📱 Voice and image features require an internet connection
                </div>
              )}
            </div>
          )}

          {/* Image Preview */}
          {uploadState.selectedFile && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative">
                <img
                  src={uploadState.previewUrl!}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
                
                {/* File Info */}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {uploadState.selectedFile.name} ({(uploadState.selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                </div>
              </div>

              {/* Upload Progress */}
              {uploadState.isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Uploading...</span>
                    <span>{uploadState.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadState.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={uploadImage}
                  disabled={uploadState.isUploading || !isOnline}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    uploadState.isUploading || !isOnline
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {uploadState.isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
                
                <button
                  onClick={resetState}
                  disabled={uploadState.isUploading}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Choose Different
                </button>
              </div>
            </div>
          )}

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
