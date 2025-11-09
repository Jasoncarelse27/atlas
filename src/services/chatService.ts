import { supabase } from "../lib/supabaseClient";
// Removed useMessageStore import - using callback pattern instead
import { logger } from "../lib/logger";
import type { Message } from "../types/chat";
import { generateUUID } from "../utils/uuid";
import { enhancedResponseCacheService } from "./enhancedResponseCacheService";
import { subscriptionApi } from "./subscriptionApi";
import { getApiEndpoint } from "../utils/apiClient";
import { getAuthTokenOrThrow } from "../utils/getAuthToken";

// Global abort controller for message streaming
let abortController: AbortController | null = null;

// 🧠 ATLAS GOLDEN STANDARD - Prevent duplicate message calls
const pendingMessages = new Set<string>();

// Simple function for AttachmentMenu to send messages with attachments
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
      const cachedResponse = await enhancedResponseCacheService.getCachedResponse(text, currentTier as any);
      
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
      logger.error('[ChatService] 🔍 API Endpoint:', {
        endpoint: messageEndpoint,
        baseUrl: import.meta.env.VITE_API_URL || 'NOT SET',
        isProd: import.meta.env.PROD,
        fullUrl: messageEndpoint
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
          
          // ✅ CRITICAL FIX: Add timeout to prevent hanging requests
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => {
            timeoutController.abort();
            logger.error(`[ChatService] ⏱️ Fetch timeout after 30s on attempt ${attempt + 1}`);
          }, 30000); // 30 second timeout
          
          // Combine abort signals: timeout OR user abort will cancel the request
          const combinedController = new AbortController();
          if (abortController) {
            abortController.signal.addEventListener('abort', () => combinedController.abort());
          }
          timeoutController.signal.addEventListener('abort', () => combinedController.abort());
          
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
          
          clearTimeout(timeoutId);
          
          // ✅ CRITICAL DEBUG: Log response immediately
          logger.error(`[ChatService] 📡 Response received:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
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
                  const authError = new Error('Session expired. Please sign in again.');
                  (authError as any).isAuthError = true;
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
                  const retryErrorData = await retryResponse.json().catch(() => ({ error: 'Unknown error' }));
                  const authError = new Error(`Authentication failed: ${retryErrorData.error || 'Please sign in again'}`);
                  (authError as any).isAuthError = true;
                  throw authError;
                }
              } catch (refreshError) {
                // Refresh failed or retry still failed - don't retry this
                logger.error('[ChatService] ❌ Token refresh/retry failed:', refreshError);
                const authError = refreshError instanceof Error ? refreshError : new Error('Session expired. Please sign in again.');
                (authError as any).isAuthError = true;
                throw authError;
              }
            } else {
              // Already tried refresh, still 401 - user needs to sign in (don't retry)
              const authError = new Error(`Authentication failed: ${errorData.error || 'Please sign in again'}`);
              (authError as any).isAuthError = true;
              throw authError;
            }
          }
          
          // Handle errors (only if not 401, which was handled above)
          // Parse error data for non-401 errors
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
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
          
          throw new Error(`Backend error: ${errorData.error || response.statusText}`);
        } catch (error) {
          lastError = error as Error;
          
          // ✅ CRITICAL DEBUG: Log ALL errors with full details
          logger.error(`[ChatService] ❌ Fetch error on attempt ${attempt + 1}:`, {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            type: error instanceof TypeError ? 'TypeError' : error instanceof Error ? error.constructor.name : 'Unknown',
            isAuthError: (error as any)?.isAuthError
          });
          
          // ✅ CRITICAL: Don't retry auth errors (401 after refresh attempt)
          if ((error as any)?.isAuthError) {
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
      abortController.abort();
      abortController = null;
    } else {
      logger.warn('[ChatService] ⚠️ No active request to abort');
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
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  // Removed useMessageStore.setIsStreaming - using callback pattern instead
};

// Export the sendMessageWithAttachments function for resendService
export async function sendMessageWithAttachments(
  conversationId: string,
  attachments: Array<{ type: string; url?: string; publicUrl?: string }>,
  addMessage: (msg: Message) => void,
  caption?: string,
  userId?: string
) {

  const tempId = `temp-${generateUUID()}`;

  // ✅ FUTURE-PROOF FIX: Format message to match what EnhancedMessageBubble expects
  const imageUrl = attachments[0]?.url || attachments[0]?.publicUrl;
  
  const newMessage: Message = {
    id: tempId,
    conversationId,
    role: "user",
    type: 'image', // ✅ ADD: Explicitly set type to 'image'
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
      
      // Use the dedicated image analysis endpoint for better reliability
      const imageAttachment = uploadedAttachments.find(att => att.type === 'image');
      if (!imageAttachment) {
        throw new Error('No image attachment found');
      }

      const apiEndpoint = getApiEndpoint('/api/image-analysis');
      logger.debug("[chatService] 📡 Calling image analysis endpoint:", apiEndpoint);
      logger.debug("[chatService] 🔐 Token preview:", token.substring(0, 20) + '...' + token.substring(token.length - 10));

      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: imageAttachment.url,
          userId: userId,
          conversationId: conversationId, // ✅ NEW: Pass conversationId
          prompt: caption || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand."
        }),
      });

      if (!response.ok) {
        // ✅ CRITICAL: Capture full error response for debugging
        let errorData: any = {};
        try {
          const errorText = await response.text();
          errorData = errorText ? JSON.parse(errorText) : {};
        } catch (parseError) {
          logger.error('[chatService] Failed to parse error response:', parseError);
          errorData = { error: `Server error (${response.status})` };
        }
        
        // ✅ Log full error details for debugging
        logger.error('[chatService] Image analysis failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          details: errorData.details,
          requestId: errorData.requestId,
          fullErrorData: errorData
        });
        
        // ✅ PRODUCTION FIX: Handle 401 with retry (token might have expired)
        if (response.status === 401) {
          logger.warn('[chatService] 401 Unauthorized - attempting token refresh and retry...');
          
          // Try refreshing token and retrying once
          try {
            const refreshedToken = await getAuthTokenOrThrow('Your session expired. Please sign in again.');
            
            const retryResponse = await fetch(apiEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${refreshedToken}`
              },
              body: JSON.stringify({
                imageUrl: imageAttachment.url,
                userId: userId,
                conversationId: conversationId,
                prompt: caption || "Please analyze this image and provide detailed, insightful observations about what you see. Focus on key elements, composition, colors, objects, people, text, or any notable details that would be helpful to understand."
              }),
            });
            
            if (retryResponse.ok) {
              logger.debug('[chatService] ✅ Retry successful after token refresh');
              const retryData = await retryResponse.json();
              if (retryData.success && retryData.analysis) {
                return { success: true };
              }
            }
          } catch (retryError) {
            logger.error('[chatService] Retry failed:', retryError);
            throw new Error('Authentication failed. Please sign in and try again.');
          }
        }
        
        // ✅ Handle tier gating response (403 with upgradeRequired)
        if (response.status === 403 && errorData.upgradeRequired) {
          logger.debug('[chatService] Image analysis requires upgrade:', errorData);
          
          // Add upgrade message to chat
          const upgradeMessage: Message = {
            id: generateUUID(),
            conversationId,
            role: "assistant",
            content: errorData.message || 'Image analysis requires Core or Studio tier. Upgrade to unlock this feature!',
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          
          addMessage(upgradeMessage);
          
          // ✅ Backend will handle saving upgrade message if needed
          return;
        }
        
        // ✅ PRODUCTION FIX: User-friendly error messages for paying users
        let userMessage = 'Image analysis failed. Please try again.';
        if (response.status === 500) {
          userMessage = 'Server error. Our team has been notified. Please try again in a moment.';
        } else if (response.status === 503) {
          userMessage = 'Service temporarily unavailable. Please try again in a few moments.';
        } else if (response.status === 429) {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (errorData.details) {
          userMessage = errorData.details;
        } else if (errorData.error) {
          userMessage = errorData.error;
        }
        
        // Throw error so frontend can handle it
        throw new Error(userMessage);
      }

      const data = await response.json();
      
      if (data.success && data.analysis) {
        logger.debug("[chatService] ✅ AI analysis complete:", data.analysis);
        
        // ✅ Backend already saved the analysis to database
        // ✅ Real-time listener will pick it up and add to UI automatically
        // ✅ No need to manually add - this follows the "single writer" pattern
      }
      
      // 🎯 FUTURE-PROOF FIX: Return success to prevent false error toast
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
