import { Camera, Eye, FileImage, Image as ImageIcon, Sparkles, StopCircle, Upload, X } from 'lucide-react';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import DismissibleExplainer from '../components/DismissibleExplainer';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import Tooltip from '../components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';

interface ImageInputAreaProps {
  onImageSelect: (file: File) => void;
  isProcessing: boolean;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ImageInputArea = forwardRef<HTMLDivElement, ImageInputAreaProps>(({ 
  onImageSelect, 
  isProcessing,
  onSoundPlay
}, ref) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragIntensity, setDragIntensity] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-scroll into view when component mounts
  useEffect(() => {
    if (ref && 'current' in ref && ref.current && !isProcessing) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Focus the file input button if available
      if (fileInputRef.current && !selectedImage && !cameraActive) {
        // We can't directly focus the hidden file input, so we'll focus the upload button
        const uploadButton = dropZoneRef.current?.querySelector('button');
        if (uploadButton) {
          uploadButton.focus();
        }
      }
    }
  }, [ref, isProcessing, selectedImage, cameraActive]);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      if (onSoundPlay) onSoundPlay('error');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('File size must be less than 10MB');
      if (onSoundPlay) onSoundPlay('error');
      return;
    }

    setUploadError(null);
    setSelectedImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // Play success sound
    if (onSoundPlay) onSoundPlay('success');
    
    // Process the image
    onImageSelect(file);
  }, [onImageSelect, onSoundPlay]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    
    // Calculate drag intensity based on drag position
    if (dropZoneRef.current) {
      const rect = dropZoneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distanceX = (e.clientX - centerX) / (rect.width / 2);
      const distanceY = (e.clientY - centerY) / (rect.height / 2);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      setDragIntensity(Math.min(1, Math.max(0, 1 - distance)));
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragIntensity(0);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragIntensity(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveImage = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    setSelectedImage(null);
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    if (cameraActive) return; // Don't allow upload while camera is active
    fileInputRef.current?.click();
  };

  const handleLiveScanStart = async () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    if (selectedImage || isProcessing) return; // Don't allow camera while image is selected or processing
    
    try {
      setCameraActive(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraActive(false);
      setUploadError('Failed to access camera. Please check your camera permissions.');
      if (onSoundPlay) onSoundPlay('error');
    }
  };

  const handleLiveScanStop = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureImage = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFileSelect(file);
        handleLiveScanStop(); // Stop camera after capture
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="w-full max-w-2xl mx-auto z-10 image-input-area" ref={ref}>
      <div>
        {/* Error Messages */}
        {uploadError && (
          <ErrorMessage
            message={uploadError}
            type="error"
            dismissible
            onDismiss={() => setUploadError(null)}
            className="mb-6"
            onSoundPlay={onSoundPlay}
          />
        )}

        {!selectedImage && !cameraActive ? (
          <>
            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isProcessing || cameraActive}
            />
            
            {/* Enhanced Upload Zone with dynamic effects - Updated with more rounded corners */}
            <div 
               ref={dropZoneRef}
               className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 mb-6
                 ${isDragOver 
                   ? 'dark:border-blue-400 border-blue-500 dark:bg-blue-900/30 bg-blue-50 scale-105 shadow-lg dark:shadow-blue-500/20 shadow-blue-500/10' 
                   : 'dark:border-gray-600 border-gray-300 dark:hover:border-blue-500 hover:border-blue-400 dark:hover:bg-blue-900/20 hover:bg-blue-50/30'
                 }`}
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               onDrop={handleDrop}
               style={{
                 transform: isDragOver ? `scale(${1 + dragIntensity * 0.05})` : 'scale(1)',
                 boxShadow: isDragOver ? `0 0 ${20 + dragIntensity * 20}px rgba(59, 130, 246, ${0.1 + dragIntensity * 0.1})` : 'none'
               }}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`neumorphic-button p-4 rounded-full transition-all duration-300 ${
                  isDragOver 
                    ? 'dark:bg-blue-800 bg-blue-100 dark:text-blue-300 text-blue-500 scale-110' 
                    : 'dark:bg-gray-800 bg-gray-100 dark:text-gray-300 text-gray-500 hover:scale-110'
                }`}>
                  <Upload className={`w-8 h-8 ${
                    isDragOver ? 'animate-pulse' : ''
                  }`} />
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-xl font-semibold ${
                    isDragOver ? 'dark:text-blue-300 text-blue-700' : 'dark:text-gray-200 text-gray-800'
                  } transition-colors duration-300`}>
                    {isDragOver ? 'Drop your image here' : 'Drag & Drop Image'}
                  </h3>
                  <p className={`${
                    isDragOver ? 'dark:text-blue-400 text-blue-600' : 'dark:text-gray-400 text-gray-600'
                  } transition-colors duration-300`}>
                    Or use the buttons below to upload or scan
                  </p>
                  <p className="text-sm dark:text-gray-500 text-gray-600">
                    Supports JPEG, PNG, GIF, WebP • Max 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons with enhanced hover effects - Updated with more rounded corners */}
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isProcessing || cameraActive}
                className="oval-button oval-button-lg px-5 py-3 dark:bg-gradient-to-r dark:from-gray-700 dark:to-gray-800 dark:hover:from-gray-600 dark:hover:to-gray-700 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 dark:text-white text-gray-800 rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-lg transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-lg relative overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full dark:bg-gradient-to-r dark:from-gray-600 dark:to-gray-700 bg-gradient-to-r from-gray-300 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <Upload className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Upload Image</span>
              </button>
              
              <button
                type="button"
                onClick={handleLiveScanStart}
                disabled={isProcessing || selectedImage !== null}
                className="oval-button oval-button-lg px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-medium transition-all duration-200 flex items-center gap-2 shadow-lg transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-lg relative overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <Camera className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Use Camera</span>
              </button>
            </div>

            {/* Features List */}
            <DismissibleExplainer 
              id="image-analysis-features" 
              title="Image Analysis Features" 
              variant="info" 
              className="mt-8"
              onSoundPlay={onSoundPlay}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 text-sm mb-1">Image Analysis</h5>
                    <p className="text-xs text-gray-600">Identify objects, scenes, and content in your images</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <FileImage className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 text-sm mb-1">Text Extraction</h5>
                    <p className="text-xs text-gray-600">Extract and process text from images and documents</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 text-sm mb-1">Visual Search</h5>
                    <p className="text-xs text-gray-600">Find similar images or products based on visual content</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 text-sm mb-1">AI Enhancement</h5>
                    <p className="text-xs text-gray-600">Improve image quality or generate variations</p>
                  </div>
                </div>
              </div>
            </DismissibleExplainer>
          </>
        ) : cameraActive ? (
          /* Camera View with enhanced UI - Updated with more rounded corners */
          <div className="space-y-6">
            <div className="relative neumorphic-card rounded-3xl overflow-hidden bg-black border border-gray-300 shadow-inner">
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto max-h-96 object-cover rounded-xl"
              />
              
              {/* Status indicator with animation */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                <div className="w-2 h-2 bg-white rounded-full absolute"></div>
                <span>Live Camera</span>
              </div>
            </div>

            {/* Hidden canvas for image capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Controls with enhanced buttons - Updated with more rounded corners */}
            <div className="flex items-center justify-center gap-4">
              <Tooltip content="Capture current frame for analysis" position="top">
                <button
                  onClick={captureImage}
                  disabled={isProcessing}
                  className="neumorphic-button oval-button oval-button-lg px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-medium transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg relative overflow-hidden group"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <Eye className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">Capture & Analyze</span>
                </button>
              </Tooltip>
              
              <Tooltip content="Stop camera and return to upload options" position="top">
                <button
                  onClick={handleLiveScanStop}
                  className="neumorphic-button oval-button oval-button-lg px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-full font-medium transition-all duration-300 flex items-center gap-2 shadow-lg transform hover:scale-105 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-red-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                  <StopCircle className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">Stop Camera</span>
                </button>
              </Tooltip>
            </div>

            {/* Camera Instructions */}
            <DismissibleExplainer 
              id="camera-instructions" 
              title="Live Camera Analysis" 
              variant="tip"
              onSoundPlay={onSoundPlay}
            >
              <ul className="space-y-1">
                <li>• Position your camera to frame the subject you want to analyze</li>
                <li>• Ensure good lighting for best results</li>
                <li>• Click "Capture & Analyze" when ready</li>
              </ul>
            </DismissibleExplainer>
          </div>
        ) : (
          /* Selected Image View with enhanced UI - Updated with more rounded corners */
          <div className="space-y-6">
            {/* Image Preview with hover effects */}
            <div className="relative">
              <div className="relative neumorphic-card rounded-3xl overflow-hidden bg-white border border-gray-300 shadow-inner group">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Selected image"
                    className="w-full max-h-96 object-contain transition-all duration-300 group-hover:scale-[1.02]"
                  />
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300"></div>
                
                {/* Remove button with enhanced hover effect */}
                <Tooltip content="Remove image and select another" position="left">
                  <button
                    onClick={handleRemoveImage}
                    className="neumorphic-button absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all duration-300 shadow-lg transform hover:scale-110 hover:rotate-12"
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
              
              {/* Image info with enhanced styling */}
              <div className="mt-4 p-4 neumorphic-card bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-blue-500" />
                    <strong>File:</strong> {selectedImage?.name}
                  </span>
                  <span className="text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <strong>Size:</strong> {selectedImage ? (selectedImage.size / 1024 / 1024).toFixed(2) : '0'}MB
                  </span>
                </div>
              </div>
            </div>

            {/* Analysis Status with enhanced animation */}
            <div className="p-6 neumorphic-card bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl border border-blue-200 shadow-sm transition-all duration-300 hover:shadow-md">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <div className="p-3 bg-blue-100 rounded-full relative">
                    {isProcessing ? (
                      <>
                        <LoadingSpinner size="md" color="primary" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping opacity-75"></div>
                      </>
                    ) : (
                      <>
                        <Eye className="w-6 h-6 text-blue-600" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-300/50 animate-pulse"></div>
                      </>
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-800">
                  {isProcessing ? 'Analyzing Image...' : 'Image Ready for Analysis'}
                </h3>
                
                <p className="text-gray-600 leading-relaxed">
                  {isProcessing 
                    ? 'Please wait while Atlas analyzes your image...'
                    : 'Your image has been uploaded successfully! Atlas will analyze it for content, objects, text, and provide detailed insights.'
                  }
                </p>
                
                {isProcessing && (
                  <div className="w-full max-w-md mx-auto">
                    <div className="neumorphic-progress-container">
                      <div className="neumorphic-progress-fill" style={{ 
                        width: '60%',
                        animation: 'progress-bar 2s ease-in-out infinite'
                      }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Another Button with enhanced hover effect - Updated with more rounded corners */}
            {!isProcessing && (
              <button
                onClick={handleRemoveImage}
                className="neumorphic-button oval-button oval-button-xl w-full px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-full font-medium transition-all duration-300 border border-gray-300 shadow-sm hover:shadow-md transform hover:scale-[1.02] group"
              >
                <span className="flex items-center justify-center gap-2">
                  <Upload className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  <span>Upload Another Image</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add animation keyframe for progress bar */}
      <style jsx>{`
        @keyframes progress-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
});

ImageInputArea.displayName = 'ImageInputArea';

export default ImageInputArea;