import { supabase } from "../lib/supabaseClient";
// Removed useMessageStore import - using callback pattern instead
import { logger } from "../lib/logger";
import type { Message } from "../types/chat";
import type { Tier } from "../types/tier";
import { getApiEndpoint, getApiUrl } from "../utils/apiClient";
import { getAuthTokenOrThrow } from "../utils/getAuthToken";
import { generateUUID } from "../utils/uuid";
import { enhancedResponseCacheService } from "./enhancedResponseCacheService";
import { subscriptionApi } from "./subscriptionApi";

// Extended Error type for auth errors
interface AuthError extends Error {
  isAuthError: true;
}

// Type for API error responses
interface ApiErrorResponse {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

// Global abort controller for message streaming
let abortController: AbortController | null = null;

// 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
const pendingMessages = new Set<string>();

// ✅ CRITICAL FIX: Prevent duplicate sends (attachment messages)
let sendingLock = false;

// Simple function to send messages with attachments (legacy function, kept for compatibility)
export async function sendAttachmentMessage(
  _conversationId: string,
  userId: string,
  attachments: Array<{ type: string; url?: string; text?: string }>
) {
  // ✅ BEST PRACTICE: Use centralized auth helper
  const token = await getAuthTokenOrThrow('You must be logged in to send messages. Please sign in and try again.');

  // Get user's tier for the request
  const currentTier = await subscriptionApi.getUserTier(userId, token);
  
  // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
  const messageEndpoint = getApiEndpoint('/api/message?stream=1');
  
  const response = await fetch(messageEndpoint, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ 
      message: "Please analyze these attachments",
      userId: userId,
      tier: currentTier,
      attachments: attachments
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Backend error: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  
  return data;
}

export const chatService = {
  sendMessage: async (text: string, onComplete?: () => void, conversationId?: string, userId?: string) => {
    // 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
    const messageId = `${userId}-${conversationId}-${text.slice(0, 20)}`;
    
    if (pendingMessages.has(messageId)) {
      logger.warn('[ChatService] ⚠️ Duplicate message call prevented:', messageId);
      return;
    }
    pendingMessages.add(messageId);

    // Set up abort controller for cancellation (always create fresh)
    abortController = new AbortController();

    try {
      // ✅ BEST PRACTICE: Use centralized auth helper (forces refresh if needed)
      const token = await getAuthTokenOrThrow('You must be logged in to send messages. Please sign in and try again.');
      
      // ✅ CRITICAL FIX: Get session ONCE after token refresh to avoid race conditions
      // getAuthTokenOrThrow() already refreshed the session, so this gets the fresh one
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.error('[ChatService] ❌ Session error after token refresh:', sessionError);
        throw new Error('Session error. Please sign in again.');
      }
      
      const actualUserId = userId || session?.user?.id;
      
      // ✅ CRITICAL: Log the exact userId being used
      logger.info('[ChatService] 🔍 User ID resolution:', {
        providedUserId: userId,
        sessionUserId: session?.user?.id,
        actualUserId,
        hasSession: !!session,
        tokenLength: token?.length || 0,
        tokenPreview: token?.substring(0, 20) + '...'
      });
      
      // ✅ FIX: Prevent 'anonymous' from reaching Supabase
      if (!actualUserId) {
        logger.error('[ChatService] No user ID available - user not authenticated');
        throw new Error('User not authenticated. Please sign in to send messages.');
      }

      // ✅ PERFORMANCE: Get user's tier for the request
      const currentTier = await subscriptionApi.getUserTier(actualUserId, token);

      // ✅ ENHANCED CACHING: Check cache first for 20-30% cost reduction
      logger.debug('[ChatService] 🔍 Checking enhanced cache for query:', text.substring(0, 50));
      const cachedResponse = await enhancedResponseCacheService.getCachedResponse(text, currentTier as Tier);
      
      if (cachedResponse) {
        logger.debug('[ChatService] ✅ Cache hit! Returning cached response (API cost saved)');
        pendingMessages.delete(messageId);
        
        // Return cached response in the same format as API response
        return {
          success: true,
          response: cachedResponse,
          conversationId: conversationId,
          cached: true,
          costSaved: true
        };
      }
      
      logger.debug('[ChatService] ❌ Cache miss, proceeding to API call');
      
      // Memory extraction is handled by the component layer
      // This keeps the service layer clean and avoids circular dependencies

      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const messageEndpoint = getApiEndpoint('/api/message?stream=1');
      
      // ✅ CRITICAL DEBUG: Log endpoint URL to diagnose missing requests
      const apiUrl = getApiUrl();
      logger.error('[ChatService] 🔍 API Endpoint:', {
        endpoint: messageEndpoint,
        baseUrl: apiUrl || 'RELATIVE (Vite proxy)',
        viteApiUrl: import.meta.env.VITE_API_URL || 'NOT SET',
        isProd: import.meta.env.PROD,
        isDev: import.meta.env.DEV,
        fullUrl: messageEndpoint,
        windowLocation: typeof window !== 'undefined' ? {
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          port: window.location.port
        } : 'N/A'
      });
      
      // ✅ ENHANCED ERROR HANDLING: Retry with exponential backoff + automatic token refresh on 401
      let lastError: Error | null = null;
      let response: Response | null = null;
      let tokenRefreshAttempted = false; // Track if we've already tried refreshing token
      const MAX_RETRIES = 3;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // ✅ CRITICAL FIX: Refresh token on each retry attempt (token might expire during retries)
          const freshToken = attempt > 0 
            ? await getAuthTokenOrThrow('Session expired. Please refresh the page.')
            : token;
          
          logger.error(`[ChatService] 🔍 Attempt ${attempt + 1}: Fetching from ${messageEndpoint}`, {
            tokenRefreshed: freshToken !== token,
            tokenLength: freshToken?.length || 0
          });
          
          // ✅ BEST PRACTICE: Check if already aborted BEFORE creating controllers
          if (abortController?.signal.aborted) {
            throw new DOMException('Request aborted by user', 'AbortError');
          }
          
          // ✅ CRITICAL FIX: Add timeout to prevent hanging requests
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => {
            timeoutController.abort();
            logger.error(`[ChatService] ⏱️ Fetch timeout after 30s on attempt ${attempt + 1}`);
          }, 30000); // 30 second timeout
          
          // Combine abort signals: timeout OR user abort will cancel the request
          const combinedController = new AbortController();
          const cleanup: (() => void)[] = [];
          
          // ✅ BEST PRACTICE: Attach listeners with proper cleanup
          if (abortController && !abortController.signal.aborted) {
            const abortHandler = () => {
              combinedController.abort();
              logger.debug('[ChatService] 🛑 User abort propagated to fetch request');
            };
            abortController.signal.addEventListener('abort', abortHandler);
            cleanup.push(() => {
              abortController?.signal.removeEventListener('abort', abortHandler);
            });
          }
          
          const timeoutHandler = () => combinedController.abort();
          timeoutController.signal.addEventListener('abort', timeoutHandler);
          cleanup.push(() => {
            timeoutController.signal.removeEventListener('abort', timeoutHandler);
          });
          
          try {
            response = await fetch(messageEndpoint, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "Authorization": `Bearer ${freshToken}` // ✅ Use fresh token on each attempt
              },
              body: JSON.stringify({ 
                message: text, // Backend expects "message" field
                conversationId: conversationId || null // ✅ Backend now gets userId from auth token
                // userId removed - backend uses req.user.id from auth middleware
              }),
              signal: combinedController.signal,
            });
          } finally {
            // ✅ BEST PRACTICE: Always clean up event listeners and timeout
            cleanup.forEach(fn => fn());
            clearTimeout(timeoutId);
          }
          
          // ✅ CRITICAL DEBUG: Log response immediately
          const contentType = response.headers.get('content-type') || '';
          logger.error(`[ChatService] 📡 Response received:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            contentType,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          // Break on success
          if (response.ok) {
            logger.error(`[ChatService] ✅ Request successful (${response.status})`);
            break;
          }
          
          // ✅ CRITICAL FIX: Check 401 FIRST before parsing error (token might be expired)
          if (response.status === 401) {
            logger.warn('[ChatService] 🔄 401 Unauthorized detected - handling token refresh...');
            
            // Parse error data ONCE (response body can only be read once)
            const errorData = await response.json().catch(() => ({ error: 'Invalid or expired token' }));
            
            // Only attempt token refresh once per request
            if (!tokenRefreshAttempted) {
              tokenRefreshAttempted = true;
              logger.warn('[ChatService] 🔄 401 Unauthorized - attempting token refresh and retry...');
              
              try {
                // Force refresh the session
                const { data: { session: refreshedSession }, error: refreshError } = 
                  await supabase.auth.refreshSession();
                
                if (refreshError || !refreshedSession?.access_token) {
                  logger.error('[ChatService] ❌ Token refresh failed:', refreshError?.message || 'No token in response');
                  // Create error that won't be retried
                  const authError = new Error('Session expired. Please sign in again.') as AuthError;
                  authError.isAuthError = true;
                  throw authError;
                }
                
                // Retry immediately with fresh token (don't increment attempt counter)
                logger.info('[ChatService] ✅ Token refreshed, retrying request...');
                const refreshedToken = refreshedSession.access_token;
                
                // Retry the request with fresh token
                const retryResponse = await fetch(messageEndpoint, {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                    "Authorization": `Bearer ${refreshedToken}`
                  },
                  body: JSON.stringify({ 
                    message: text,
                    conversationId: conversationId || null
                  }),
                  signal: combinedController.signal,
                });
                
                if (retryResponse.ok) {
                  logger.info('[ChatService] ✅ Retry successful after token refresh');
                  response = retryResponse;
                  break; // Success!
                } else {
                  // Still 401 after refresh - user needs to sign in again
                  const retryErrorData = await retryResponse.json().catch(() => ({ error: 'Unknown error' })) as ApiErrorResponse;
                  const authError = new Error(`Authentication failed: ${retryErrorData.error || 'Please sign in again'}`) as AuthError;
                  authError.isAuthError = true;
                  throw authError;
                }
              } catch (refreshError) {
                // Refresh failed or retry still failed - don't retry this
                logger.error('[ChatService] ❌ Token refresh/retry failed:', refreshError);
                const authError = (refreshError instanceof Error ? refreshError : new Error('Session expired. Please sign in again.')) as AuthError;
                authError.isAuthError = true;
                throw authError;
              }
            } else {
              // Already tried refresh, still 401 - user needs to sign in (don't retry)
              const authError = new Error(`Authentication failed: ${errorData.error || 'Please sign in again'}`) as AuthError;
              authError.isAuthError = true;
              throw authError;
            }
          }
          
          // Handle errors (only if not 401, which was handled above)
          // ✅ BEST PRACTICE: Parse error data - handle both JSON and plain text responses
          // Note: Response body can only be read once, so check content-type first
          let errorData: ApiErrorResponse = { error: 'Unknown error' };
          try {
            if (contentType.includes('application/json')) {
              errorData = await response.json();
            } else {
              // Backend might return plain text for 500 errors (text/plain)
              const textError = await response.text();
              // Try to parse as JSON if it looks like JSON, otherwise use as plain text
              try {
                errorData = JSON.parse(textError);
              } catch {
                errorData = { error: textError || 'Unknown error' };
              }
            }
          } catch (parseError) {
            // If parsing fails, use status text
            logger.error('[ChatService] Error parsing error response:', parseError);
            errorData = { error: response.statusText || 'Unknown error' };
          }
          
          // ✅ CRITICAL FIX: Handle 429 errors - don't retry limit errors
          if (response.status === 429) {
            const errorMessage = errorData.error || errorData.message || response.statusText || '';
            const errorLower = errorMessage.toLowerCase();
            
            // Don't retry if it's a limit error (monthly/daily limit reached)
            if (errorLower.includes('monthly limit') || 
                errorLower.includes('daily limit') || 
                errorLower.includes('limit reached') ||
                errorData.error === 'MONTHLY_LIMIT_REACHED' ||
                errorData.error === 'DAILY_LIMIT_REACHED') {
              logger.warn('[ChatService] ⚠️ Limit reached - not retrying:', errorMessage);
              throw new Error(`Backend error: ${errorMessage}`);
            }
            
            // Transient rate limit (too many requests per second) - could retry, but don't for now
            logger.warn('[ChatService] ⚠️ Rate limit (429) - not retrying:', errorMessage);
            throw new Error(`Backend error: ${errorMessage}`);
          }
          
          // Retry on server errors (500+) or network issues
          if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            logger.warn(`[ChatService] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // ✅ BEST PRACTICE: Extract meaningful error message from backend
          const backendError = errorData.error || errorData.message || response.statusText || 'Unknown error';
          throw new Error(`Backend error: ${backendError}`);
        } catch (error) {
          lastError = error as Error;
          
          // ✅ CRITICAL DEBUG: Log ALL errors with full details (especially network/CORS errors)
          const errorDetails: {
            name: string;
            message: string;
            stack?: string;
            type: string;
            isAuthError?: boolean;
            endpoint: string;
            apiUrl: string;
            networkError?: boolean;
            possibleCauses?: string[];
          } = {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            type: error instanceof TypeError ? 'TypeError' : error instanceof Error ? error.constructor.name : 'Unknown',
            isAuthError: (error as AuthError)?.isAuthError,
            endpoint: messageEndpoint,
            apiUrl: getApiUrl() || 'RELATIVE'
          };
          
          // ✅ MOBILE FIX: Detect common network errors
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            errorDetails.networkError = true;
            errorDetails.possibleCauses = [
              'CORS blocked',
              'SSL certificate invalid (self-signed cert on mobile)',
              'Network unreachable',
              'Backend not running'
            ];
          }
          
          logger.error(`[ChatService] ❌ Fetch error on attempt ${attempt + 1}:`, errorDetails);
          
          // ✅ CRITICAL: Don't retry auth errors (401 after refresh attempt)
          if ((error as AuthError)?.isAuthError) {
            logger.error('[ChatService] ❌ Auth error - not retrying');
            throw error;
          }
          
          // ✅ CRITICAL FIX: Don't retry on abort or limit errors
          if (error instanceof Error && (
            error.name === 'AbortError' || 
            error.message.includes('MONTHLY_LIMIT_REACHED') ||
            error.message.toLowerCase().includes('monthly limit') ||
            error.message.toLowerCase().includes('daily limit') ||
            error.message.toLowerCase().includes('limit reached')
          )) {
            if (error.name === 'AbortError') {
              logger.info('[ChatService] ✅ Request aborted by user');
            } else {
              logger.warn('[ChatService] ⚠️ Limit error - not retrying:', error.message);
            }
            throw error;
          }
          
          // ✅ CRITICAL: Check for network/CORS errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            logger.error(`[ChatService] 🚫 Network/CORS error detected: ${error.message}`);
            // Don't retry network errors - they won't resolve with retries
            throw new Error(`Network error: ${error.message}. Check CORS and backend connectivity.`);
          }
          
          // Retry on other errors
          if (attempt < MAX_RETRIES - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            logger.warn(`[ChatService] Error on attempt ${attempt + 1}, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }
      
      // If we exhausted retries, throw last error
      if (!response || !response.ok) {
        const errorMsg = lastError?.message || `Failed after max retries (status: ${response?.status || 'no response'})`;
        logger.error('[ChatService] ❌ Final error after retries:', errorMsg, {
          status: response?.status,
          statusText: response?.statusText,
          url: messageEndpoint
        });
        throw lastError || new Error(errorMsg);
      }

      // ✅ SUCCESS: Backend saves messages to DB immediately
      // Real-time Supabase listeners will pick up the assistant response
      // No need to read the SSE stream - just return success
      logger.debug('[ChatService] ✅ Message sent successfully, real-time will handle response');
      
      // Call completion callback
      onComplete?.();
      
      // Refresh profile to get updated usage stats
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Trigger a profile refresh by calling the profile endpoint
          // ✅ Use relative path to leverage Vite proxy (avoids mixed content errors)
          await fetch(`/v1/user_profiles/${userId}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }).catch(() => {
            // Silently fail if profile refresh fails (non-critical)
          });
        }
      } catch (refreshError) {
        // Silent fail - profile refresh is non-critical
        logger.debug('[ChatService] Profile refresh skipped:', refreshError);
      }
      
      // Reset streaming state
      abortController = null;
      
      // Return success (real-time will handle message display)
      return {
        response: "Message sent",
        conversationId: conversationId || undefined
      };
    } catch (error) {
      
      // Reset streaming state on error
      // Removed useMessageStore.setIsStreaming - using callback pattern instead
      abortController = null;
      onComplete?.();
      throw error;
    } finally {
      // 🧠 ATLAS GOLDEN STANDARD - Clean up duplicate prevention
      pendingMessages.delete(messageId);
    }
  },
  
  // Stop streaming function
  stopMessageStream: () => {
    logger.info('[ChatService] 🛑 stopMessageStream called');
    if (abortController) {
      logger.info('[ChatService] ✅ Aborting active request');
      try {
        abortController.abort();
      } catch (error) {
        logger.warn('[ChatService] ⚠️ Error aborting request:', error);
      }
      abortController = null;
    } else {
      logger.debug('[ChatService] ℹ️ No active request to abort (request may have already completed or failed)');
    }
    // Removed useMessageStore.setIsStreaming - using callback pattern instead
  },

  handleFileMessage: async (message: Message, onComplete?: () => void) => {
    // Message management is handled by the calling component
    
    // Handle messages with attachments (new multi-attachment support)
    if (message.attachments && message.attachments.length > 0) {
      
      // ✅ BEST PRACTICE: Use centralized auth helper
      const token = await getAuthTokenOrThrow('You must be logged in to analyze images. Please sign in and try again.');
      
      // Get user ID from session
      const { data: { session } } = await supabase.auth.getSession();
      const actualUserId = session?.user?.id || 'anonymous';
      
      // Get user's tier for the request
      const imageTier = await subscriptionApi.getUserTier(actualUserId, token);
      
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(getApiEndpoint('/api/message?stream=1'), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: "Please analyze these attachments",
          tier: imageTier,
          attachments: message.attachments // Send attachments array
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Log response - message management handled by calling component
        }
      } else {
        logger.error('[ChatService] Image analysis request failed:', response.status);
      }
    }
    // Legacy: Handle single image messages
    else if (message.type === 'image') {
      // Get the image URL - check content (string) or metadata.url
      const imageUrl = message.metadata?.url || 
                      (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null);
      
      if (imageUrl) {
        
        // ✅ BEST PRACTICE: Use centralized auth helper
        const token = await getAuthTokenOrThrow('You must be logged in to analyze images. Please sign in and try again.');
        
        // Get user ID from session
        const { data: { session } } = await supabase.auth.getSession();
        const actualUserId = session?.user?.id || 'anonymous';
        
        // Get user's tier for the request
        const imageTier = await subscriptionApi.getUserTier(actualUserId, token);
        
        // Send image analysis request to backend
        const requestBody = { 
          message: "Please analyze this image",
          tier: imageTier,
          imageUrl: imageUrl // Send image URL for analysis
        };
        
        // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
        const response = await fetch(getApiEndpoint('/api/message?stream=1'), {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(requestBody),
        });

        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Log response - message management handled by calling component
          }
        } else {
          // const errorText = await response.text(); // Unused but kept for debugging
          // Log error - message management handled by calling component
        }
      }
    }

    // Call completion callback
    onComplete?.();
  }
};

// Export stopMessageStream function
export const stopMessageStream = () => {
  logger.info('[ChatService] 🛑 stopMessageStream called (exported function)');
  if (abortController) {
    logger.info('[ChatService] ✅ Aborting active request');
    try {
      abortController.abort();
    } catch (error) {
      logger.warn('[ChatService] ⚠️ Error aborting request:', error);
    }
    abortController = null;
  } else {
    logger.debug('[ChatService] ℹ️ No active request to abort (request may have already completed or failed)');
  }
  // Removed useMessageStore.setIsStreaming - using callback pattern instead
};

// Export the sendMessageWithAttachments function for resendService
// ✅ CRITICAL FIX: Type inference for mixed attachments
function inferMessageType(attachments: Array<{ type: string; url?: string; publicUrl?: string }>): 'text' | 'image' | 'audio' | 'mixed' {
  if (!attachments || attachments.length === 0) return 'text';
  
  const types = new Set(attachments.map(att => att.type).filter(Boolean));
  
  // If multiple types, it's mixed
  if (types.size > 1) return 'mixed';
  
  // Single type
  if (types.has('image')) return 'image';
  if (types.has('audio')) return 'audio';
  if (types.has('file')) return 'text'; // Files are treated as text messages
  
  // Default to text if no type detected
  return 'text';
}

export async function sendMessageWithAttachments(
  conversationId: string,
  attachments: Array<{ type: string; url?: string; publicUrl?: string }>,
  addMessage: (msg: Message) => void,
  caption?: string,
  userId?: string
) {

  const tempId = `temp-${generateUUID()}`;

  // ✅ CRITICAL FIX: Infer message type from attachments (supports mixed)
  const messageType = inferMessageType(attachments);
  
  const newMessage: Message = {
    id: tempId,
    conversationId,
    role: "user",
    type: messageType, // ✅ FIX: Use inferred type (supports 'mixed')
    content: caption || "", // ✅ user caption as content
    // ✅ FIX: Don't duplicate image in both url AND attachments - use attachments only
    attachments: attachments.map(att => ({
      type: (att.type || 'image') as 'image' | 'file' | 'audio',
      url: att.url || att.publicUrl,
      caption: caption || ''
    })), // ✅ properly formatted attachments array
    status: "pending",
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as Message;


  // Show optimistically in UI
  addMessage(newMessage);

  // Use already uploaded attachments (from imageService)
  const uploadedAttachments = attachments.map(att => ({
    ...att,
    // Ensure we have the URL from the upload
    url: att.url || att.publicUrl
  }));

  // ✅ Backend will handle saving to Supabase - no direct DB calls needed

  // ✅ NEW: Send to backend for AI analysis
  try {
      // ✅ BEST PRACTICE: Use centralized auth helper with automatic refresh
      logger.debug("[chatService] 🔐 Getting auth token for image analysis...");
      const token = await getAuthTokenOrThrow('You must be logged in to analyze images. Please sign in and try again.');
      
      if (!token) {
        logger.error("[chatService] ❌ No token available after getAuthTokenOrThrow");
        throw new Error('Authentication failed. Please sign in and try again.');
      }
      
      logger.debug("[chatService] ✅ Token obtained, length:", token.length);
      
      // Get user's tier for the request (not needed for image analysis endpoint)
      // const currentTier = await getUserTier();
      
      logger.debug("[chatService] 🧠 Sending attachments to backend for AI analysis...");
      
      // ✅ CRITICAL FIX: Backend saves user message - don't duplicate save here
      // Backend /api/image-analysis endpoint saves the user message with attachments
      // This prevents double-upload and ensures single source of truth
      
      // Handle image, audio, and file attachments separately
      const imageAttachment = uploadedAttachments.find(att => att.type === 'image');
      const audioAttachment = uploadedAttachments.find(att => att.type === 'audio');
      const fileAttachment = uploadedAttachments.find(att => att.type === 'file');
      
      // ✅ CRITICAL FIX: Handle audio-only messages (voice notes)
      // Backend saves user message, but we need to trigger AI response via /api/message endpoint
      if (audioAttachment && !imageAttachment && !fileAttachment) {
        // ✅ CRITICAL FIX: Prevent duplicate sends
        if (sendingLock) {
          logger.warn('[chatService] ⚠️ Send already in progress, skipping duplicate');
          return;
        }
        
        sendingLock = true;
        
        try {
          logger.debug('[chatService] 🎤 Audio-only message - triggering AI response via /api/message');
          
          // Call regular message endpoint to trigger AI response for audio
          const messageEndpoint = getApiEndpoint('/api/message?stream=1');
          const messageResponse = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              conversationId: conversationId,
              message: caption || 'Please respond to my voice note.',
              attachments: uploadedAttachments.map(att => ({
                type: att.type,
                url: att.url || att.publicUrl
              }))
            })
          });
          
          if (!messageResponse.ok) {
            logger.error('[chatService] Failed to trigger AI response for audio:', messageResponse.status);
          } else {
            logger.debug('[chatService] ✅ AI response triggered for audio-only message');
          }
          
          // Return early - AI response will come via real-time
          return;
        } finally {
          sendingLock = false; // ✅ CRITICAL FIX: Always release lock
        }
      }
      
      if (imageAttachment) {
        // ✅ CRITICAL FIX: Prevent duplicate sends
        if (sendingLock) {
          logger.warn('[chatService] ⚠️ Send already in progress, skipping duplicate');
          return;
        }
        
        sendingLock = true;
        
        try {
          // Use the dedicated image analysis endpoint
          const apiEndpoint = getApiEndpoint('/api/image-analysis');
          logger.debug("[chatService] 📡 Calling image analysis endpoint:", apiEndpoint);
          logger.debug("[chatService] 🔐 Token preview:", token.substring(0, 20) + '...' + token.substring(token.length - 10));

          // ✅ CRITICAL FIX: Add timeout to prevent hanging requests (60s for image analysis)
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => {
            timeoutController.abort();
            logger.error('[chatService] ⏱️ Image analysis timeout after 60s');
          }, 60000); // 60 second timeout for image analysis

          try {
            // ✅ FIX: Send ALL image attachments, not just the first one
            const imageAttachments = uploadedAttachments.filter(att => att.type === 'image');
            
            // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
            const response = await fetch(apiEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                imageUrl: imageAttachment.url, // First image for analysis (Claude Vision supports one at a time)
                attachments: imageAttachments.map(att => ({ // ✅ Send ALL attachments for saving
                  type: att.type,
                  url: att.url || att.publicUrl
                })),
                userId: userId,
                conversationId: conversationId, // ✅ NEW: Pass conversationId
                prompt: caption || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand."
              }),
              signal: timeoutController.signal, // ✅ FIX: Add abort signal for timeout
            });
            
            clearTimeout(timeoutId); // ✅ CLEANUP: Clear timeout on success
            
            if (!response.ok) {
              // Handle image analysis error (existing code below)
              let errorData: ApiErrorResponse = {};
              try {
                const errorText = await response.text();
                errorData = errorText ? JSON.parse(errorText) : {};
              } catch (parseError) {
                logger.error('[chatService] Failed to parse error response:', parseError);
                errorData = { error: `Server error (${response.status})` };
              }
              
              logger.error('[chatService] Image analysis failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData.error,
                details: errorData.details,
                requestId: errorData.requestId,
                fullErrorData: errorData
              });
              
              if (response.status === 401) {
                logger.warn('[chatService] 401 Unauthorized - attempting token refresh and retry...');
                // Token refresh logic would go here
              }
              
              // ✅ CRITICAL FIX: Don't throw error - user message is already saved
              // Just log and continue (for mixed attachments, audio is already saved)
              logger.warn('[chatService] Image analysis failed but user message saved');
            } else {
              const analysisResult = await response.json();
              logger.debug("[chatService] ✅ Image analysis complete");
              // Analysis is saved to conversation by backend
            }
          } catch (error) {
            clearTimeout(timeoutId); // ✅ CLEANUP: Clear timeout on error
            if (error instanceof Error && error.name === 'AbortError') {
              logger.error('[chatService] ⏱️ Image analysis request timed out');
              // Don't throw - user message is already saved, just log the timeout
            } else {
              logger.error('[chatService] Image analysis request failed:', error);
              // Don't throw - user message is already saved
            }
          }
        } finally {
          sendingLock = false; // ✅ CRITICAL FIX: Always release lock
        }
      } else if (fileAttachment) {
        // Use the file analysis endpoint
        const apiEndpoint = getApiEndpoint('/api/file-analysis');
        logger.debug("[chatService] 📡 Calling file analysis endpoint:", apiEndpoint);

        // ✅ CRITICAL FIX: Add timeout to prevent hanging requests (60s for file analysis)
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
          logger.error('[chatService] ⏱️ File analysis timeout after 60s');
        }, 60000); // 60 second timeout for file analysis

        try {
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              fileUrl: fileAttachment.url,
              userId: userId,
              conversationId: conversationId,
              prompt: caption || "Please analyze this file and provide detailed insights about its content."
            }),
            signal: timeoutController.signal, // ✅ FIX: Add abort signal for timeout
          });
          
          clearTimeout(timeoutId); // ✅ CLEANUP: Clear timeout on success
          
          if (!response.ok) {
          let errorData: ApiErrorResponse = {};
          try {
            const errorText = await response.text();
            errorData = errorText ? JSON.parse(errorText) : {};
          } catch (parseError) {
            logger.error('[chatService] Failed to parse error response:', parseError);
            errorData = { error: `Server error (${response.status})` };
          }
          
          logger.error('[chatService] File analysis failed:', {
            status: response.status,
            error: errorData.error,
            details: errorData.details
          });
          
          const errorMessage = (errorData.details || errorData.error || `File analysis failed (${response.status})`) as string;
          throw new Error(errorMessage);
        } else {
          const analysisResult = await response.json();
          logger.debug("[chatService] ✅ File analysis complete");
          // Analysis is saved to conversation by backend
        }
        } catch (error) {
          clearTimeout(timeoutId); // ✅ CLEANUP: Clear timeout on error
          if (error instanceof Error && error.name === 'AbortError') {
            logger.error('[chatService] ⏱️ File analysis request timed out');
            // Don't throw - user message is already saved, just log the timeout
          } else {
            logger.error('[chatService] File analysis request failed:', error);
            // Re-throw non-timeout errors
            throw error;
          }
        }
      } else {
        throw new Error('No image or file attachment found');
      }
      
      // Return early - analysis complete
      return { success: true };
      
  } catch (aiError) {
    // ✅ Silent fail for service unavailable - don't spam console
    if (aiError instanceof Error && aiError.message === 'IMAGE_SERVICE_UNAVAILABLE') {
      logger.debug('[chatService] Image service unavailable - silently failing');
      return { success: true }; // Still return success - user message was saved
    }
    
    // Re-throw other errors so frontend can show them
    logger.error('[chatService] Image analysis error:', aiError);
    throw aiError; // Let frontend handle the error display
  }
}// Force Vercel rebuild Sat Sep 27 16:47:24 SAST 2025
