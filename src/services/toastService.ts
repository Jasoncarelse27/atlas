import toast from 'react-hot-toast';

// Toast service with react-hot-toast integration
export const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  switch (type) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warning':
      toast(message, {
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#1f2937',
        },
      });
      break;
    case 'info':
    default:
      toast(message, {
        icon: 'ℹ️',
        style: {
          background: '#3b82f6',
          color: '#ffffff',
        },
      });
      break;
  }
};

// Legacy exports for backward compatibility
export const showErrorToast = (message: string) => showToast(message, 'error');
export const showSuccessToast = (message: string) => showToast(message, 'success');
export const showInfoToast = (message: string) => showToast(message, 'info');
