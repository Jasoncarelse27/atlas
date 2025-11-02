/**
 * @deprecated Use getApiUrl() or getApiEndpoint() from '@/utils/apiClient' instead
 * This function is kept for backward compatibility but redirects to the new API client
 */
import { getApiUrl } from './apiClient';

const getBaseUrl = () => {
  // ✅ CRITICAL FIX: Redirect to centralized API client
  return getApiUrl();
};

export default getBaseUrl;


