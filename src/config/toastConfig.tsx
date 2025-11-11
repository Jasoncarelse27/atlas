/**
 * Modern Toast Notification Configuration (2024/2025 Best Practices)
 * 
 * Features:
 * - Glassmorphism design
 * - Dark theme native
 * - Smooth animations
 * - Custom branded icons
 * - Accessible and professional
 */

import { toast, Toaster } from 'sonner';
import type { ExternalToast } from 'sonner';

// Modern toast styles with glassmorphism - ✅ IMPROVED: Dark grey text for better visibility
export const modernToastStyles = {
  error: {
    style: {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.12) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '16px',
      color: '#1f2937', // ✅ Dark grey for better visibility
      padding: '16px 20px',
      boxShadow: '0 8px 32px 0 rgba(239, 68, 68, 0.2)',
    },
  },
  success: {
    style: {
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.12) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '16px',
      color: '#1f2937', // ✅ Dark grey for better visibility
      padding: '16px 20px',
      boxShadow: '0 8px 32px 0 rgba(34, 197, 94, 0.2)',
    },
  },
  warning: {
    style: {
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.12) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '16px',
      color: '#1f2937', // ✅ Dark grey for better visibility
      padding: '16px 20px',
      boxShadow: '0 8px 32px 0 rgba(251, 191, 36, 0.2)',
    },
  },
  info: {
    style: {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.12) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '16px',
      color: '#1f2937', // ✅ Dark grey for better visibility
      padding: '16px 20px',
      boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.2)',
    },
  },
};

// Modern error toast with custom icon
export const showModernError = (message: string, description?: string) => {
  return toast.error(
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{message}</p>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </div>,
    {
      ...modernToastStyles.error,
      duration: 5000,
      icon: false, // Using custom icon
    } as ExternalToast
  );
};

// Modern success toast
export const showModernSuccess = (message: string, description?: string) => {
  return toast.success(
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{message}</p>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </div>,
    {
      ...modernToastStyles.success,
      duration: 3000,
      icon: false,
    } as ExternalToast
  );
};

// Modern warning toast
export const showModernWarning = (message: string, description?: string) => {
  return toast.warning(
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{message}</p>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </div>,
    {
      ...modernToastStyles.warning,
      duration: 4000,
      icon: false,
    } as ExternalToast
  );
};

// Modern info toast
export const showModernInfo = (message: string, description?: string) => {
  return toast.info(
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{message}</p>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>
    </div>,
    {
      ...modernToastStyles.info,
      duration: 3000,
      icon: false,
    } as ExternalToast
  );
};

// Export Toaster component with global config
export const ModernToaster = () => (
  <Toaster
    position="top-right"
    expand={true}
    richColors={false}
    closeButton={true}
    toastOptions={{
      style: {
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(75, 85, 99, 0.2)',
        borderRadius: '16px',
        color: '#1f2937', // ✅ Dark grey for better visibility
      },
      className: 'modern-toast',
    }}
  />
);

// Helper to replace old toast calls
export const modernToast = {
  error: showModernError,
  success: showModernSuccess,
  warning: showModernWarning,
  info: showModernInfo,
};

