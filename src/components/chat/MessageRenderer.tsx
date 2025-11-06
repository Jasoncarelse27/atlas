import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { logger } from '../../lib/logger';
import { useMessageStore } from '../../stores/useMessageStore';
import { useThemeMode } from '../../hooks/useThemeMode';
import type { Attachment, Message } from '../../types/chat';
import ImageMessageBubble from '../messages/ImageMessageBubble';
import { AudioMessageBubble } from './AudioMessageBubble';

interface MessageRendererProps {
  message: Message;
  className?: string;
}

// Legacy support for string content
interface LegacyMessageRendererProps {
  content: string;
  className?: string;
}

export function MessageRenderer({ message, className = '' }: MessageRendererProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const updateMessage = useMessageStore((state) => state.updateMessage);

  const handleCopy = async (codeContent: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopiedStates(prev => ({ ...prev, [codeId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeId]: false }));
      }, 2000);
    } catch (err) {
      logger.error('[MessageRenderer] Error copying to clipboard:', err);
    }
  };

  const retryAttachmentUpload = async (messageId: string, attachment: Attachment, idx: number) => {
    try {
      if (!attachment.file) {
        return;
      }

      const safeName = `${Date.now()}-retry-${idx}.${attachment.file.name.split('.').pop()}`;
      
      // Reset attachment state
      const state = useMessageStore.getState();
      const msg = state.messages.find((m) => m.id === messageId);
      if (!msg || !msg.attachments) return;

      const updated = [...msg.attachments];
      updated[idx] = { ...attachment, failed: false, progress: 0 };
      updateMessage(messageId, { attachments: updated, status: 'uploading' });

      // Upload to Supabase
      const supabase = (await import('../../lib/supabaseClient')).default;
      const { data, error } = await supabase.storage
        .from("attachments")
        .upload(`${messageId}/${safeName}`, attachment.file, { upsert: true });

      if (error) throw error;

      const publicUrl = supabase.storage
        .from("attachments")
        .getPublicUrl(data.path).data.publicUrl;

      // Update with success
      const finalUpdated = [...updated];
      finalUpdated[idx] = { ...attachment, url: publicUrl, failed: false, progress: 100 };
      updateMessage(messageId, { attachments: finalUpdated, status: 'sent' });
    } catch (err) {
      // Mark as failed
      const state = useMessageStore.getState();
      const msg = state.messages.find((m) => m.id === messageId);
      if (msg && msg.attachments) {
        const updated = [...msg.attachments];
        updated[idx] = { ...attachment, failed: true, progress: 0 };
        updateMessage(messageId, { attachments: updated, status: 'failed' });
      }
    }
  };

  // Handle messages with multiple attachments
  if (message.attachments && message.attachments.length > 0) {
    const images = message.attachments.filter((a) => a.type === "image");
    const audios = message.attachments.filter((a) => a.type === "audio");
    const files = message.attachments.filter((a) => a.type === "file");

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Gallery for images */}
        {images.length > 0 && (
          <div
            className={`grid gap-2 ${
              images.length === 1
                ? "grid-cols-1"
                : images.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
            }`}
          >
            {images.map((img, idx) => (
              <div key={idx} className="relative border rounded p-1">
                <ImageMessageBubble 
                  message={{ ...message, content: img.url, type: 'image' }}
                />
                
                {/* Progress bar */}
                {message.status === "uploading" && img.progress !== undefined && !img.failed && (
                  <div className="absolute bottom-1 left-1 right-1 bg-gray-200 rounded">
                    <div
                      className="bg-green-500 h-1 rounded"
                      style={{ width: `${img.progress}%` }}
                    />
                  </div>
                )}

                {/* Retry button on failure */}
                {img.failed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-80">
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                      onClick={() => retryAttachmentUpload(message.id, img, idx)}
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Audio attachments */}
        {audios.map((aud, idx) => (
          <div key={idx} className="relative border rounded p-1">
            <AudioMessageBubble 
              message={{ ...message, content: aud.url, type: 'audio' }} 
            />
            
            {/* Progress bar */}
            {message.status === "uploading" && aud.progress !== undefined && !aud.failed && (
              <div className="absolute bottom-1 left-1 right-1 bg-gray-200 rounded">
                <div
                  className="bg-green-500 h-1 rounded"
                  style={{ width: `${aud.progress}%` }}
                />
              </div>
            )}

            {/* Retry button on failure */}
            {aud.failed && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-80">
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                  onClick={() => retryAttachmentUpload(message.id, aud, idx)}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ))}

        {/* File attachments */}
        {files.map((f, idx) => (
          <div key={idx} className="relative border rounded p-1">
            <a href={f.url} target="_blank" rel="noreferrer" className="text-atlas-sage hover:text-atlas-sage/80">
              📄 Download file
            </a>
            
            {/* Progress bar */}
            {message.status === "uploading" && f.progress !== undefined && !f.failed && (
              <div className="absolute bottom-1 left-1 right-1 bg-gray-200 rounded">
                <div
                  className="bg-green-500 h-1 rounded"
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            )}

            {/* Retry button on failure */}
            {f.failed && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-80">
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                  onClick={() => retryAttachmentUpload(message.id, f, idx)}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Legacy: Handle single image messages
  if (message.type === "image") {
    return (
      <div className={className}>
        <ImageMessageBubble 
          message={message} 
        />
      </div>
    );
  }

  // Legacy: Handle single audio messages
  if (message.type === "audio") {
    return (
      <AudioMessageBubble 
        message={message}
        className={className}
      />
    );
  }

  // Handle system messages
  if (message.type === "system") {
    return (
      <div className={`my-2 rounded-xl bg-gray-800 p-3 text-white ${className}`}>
        {Array.isArray(message.content) ? message.content.join(' ') : message.content}
      </div>
    );
  }

  // Handle text content (default)
  const content = Array.isArray(message.content) ? message.content.join(' ') : message.content;
  
  // ✅ Theme-aware prose styling
  const { isDarkMode } = useThemeMode();

  return (
    <div className={`prose ${isDarkMode ? 'prose-invert' : ''} max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // KaTeX Math rendering
          // math component removed - not valid in react-markdown
          // inlineMath component removed - not valid in react-markdown
          code({ node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode; [key: string]: unknown }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');
            const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
            const isCopied = copiedStates[codeId] || false;

            if (!inline && match) {
              return (
                <div className="relative group my-4">
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(codeContent, codeId)}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs px-2 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg text-sm !m-0"
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    }}
                    {...props}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code 
                className={`${isDarkMode ? 'bg-gray-800/50 text-gray-200' : 'bg-gray-100 text-gray-800'} px-1.5 py-0.5 rounded text-sm font-mono`} 
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className={`mb-4 last:mb-0 leading-relaxed ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</p>;
          },
          h1({ children }) {
            return <h1 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={`text-base font-medium mb-2 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h3>;
          },
          ul({ children }) {
            return <ul className={`list-disc ml-5 mb-5 space-y-2.5 ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={`list-decimal ml-5 mb-5 space-y-2.5 ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</ol>;
          },
          li({ children }) {
            return <li className={`${isDarkMode ? 'text-gray-200' : ''} pl-1.5 leading-relaxed`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className={`border-l-4 border-[#B2BDA3] pl-4 py-2 my-3 ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100'} rounded-r`} style={!isDarkMode ? { color: '#000000' } : undefined}>
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#B2BDA3] hover:text-[#A3B295] underline transition-colors"
                style={{ 
                  color: '#B2BDA3',
                  textDecoration: 'underline',
                  WebkitTextDecorationColor: '#B2BDA3',
                  textDecorationColor: '#B2BDA3'
                }}
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className={`font-semibold ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</strong>;
          },
          em({ children }) {
            return <em className={`italic ${isDarkMode ? 'text-gray-300' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</em>;
          },
          // Tables (GitHub Flavored Markdown) - Enhanced with theme-aware styling
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 -mx-2 sm:mx-0">
                <table className={`min-w-full border-collapse border ${isDarkMode ? 'border-gray-600/50' : 'border-gray-300'} rounded-lg overflow-hidden shadow-lg`}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className={`${isDarkMode ? 'bg-gray-700/80 border-gray-600' : 'bg-gray-100 border-gray-300'} border-b-2`}>{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className={`${isDarkMode ? 'bg-gray-800/40 divide-gray-700/50' : 'bg-white divide-gray-200'} divide-y`}>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className={`${isDarkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} transition-colors duration-150`}>{children}</tr>;
          },
          th({ children }) {
            return (
              <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-100 border-gray-600/50' : 'text-gray-900 border-gray-300'} border-r last:border-r-0`}>
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-200 border-gray-600/30' : 'text-gray-800 border-gray-200'} border-r last:border-r-0 leading-relaxed`}>
                {children}
              </td>
            );
          },
          // Images
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || 'Image'}
                className="max-w-full h-auto rounded-lg my-3 shadow-sm"
                loading="lazy"
              />
            );
          },
          // Horizontal rule
          hr() {
            return <hr className="my-4 border-t border-gray-300" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Legacy component for backward compatibility
export function LegacyMessageRenderer({ content, className = '' }: LegacyMessageRendererProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  // ✅ Theme-aware prose styling
  const { isDarkMode } = useThemeMode();

  const handleCopy = async (codeContent: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopiedStates(prev => ({ ...prev, [codeId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeId]: false }));
      }, 2000);
    } catch (err) {
      logger.error('[MessageRenderer] Error copying code:', err);
    }
  };

  return (
    <div className={`prose ${isDarkMode ? 'prose-invert' : ''} max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // KaTeX Math rendering
          // math component removed - not valid in react-markdown
          // inlineMath component removed - not valid in react-markdown
          code({ node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode; [key: string]: unknown }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');
            const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
            const isCopied = copiedStates[codeId] || false;

            if (!inline && match) {
              return (
                <div className="relative group my-4">
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(codeContent, codeId)}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs px-2 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg text-sm !m-0"
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    }}
                    {...props}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code 
                className={`${isDarkMode ? 'bg-gray-800/50 text-gray-200' : 'bg-gray-100 text-gray-800'} px-1.5 py-0.5 rounded text-sm font-mono`} 
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className={`mb-4 last:mb-0 leading-relaxed ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</p>;
          },
          h1({ children }) {
            return <h1 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={`text-base font-medium mb-2 ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</h3>;
          },
          ul({ children }) {
            return <ul className={`list-disc ml-5 mb-5 space-y-2.5 ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={`list-decimal ml-5 mb-5 space-y-2.5 ${isDarkMode ? 'text-gray-200' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</ol>;
          },
          li({ children }) {
            return <li className={`${isDarkMode ? 'text-gray-200' : ''} pl-1.5 leading-relaxed`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className={`border-l-4 border-[#B2BDA3] pl-4 py-2 my-3 ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100'} rounded-r`} style={!isDarkMode ? { color: '#000000' } : undefined}>
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#B2BDA3] hover:text-[#A3B295] underline transition-colors"
                style={{ 
                  color: '#B2BDA3',
                  textDecoration: 'underline',
                  WebkitTextDecorationColor: '#B2BDA3',
                  textDecorationColor: '#B2BDA3'
                }}
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className={`font-semibold ${isDarkMode ? 'text-white' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</strong>;
          },
          em({ children }) {
            return <em className={`italic ${isDarkMode ? 'text-gray-300' : ''}`} style={!isDarkMode ? { color: '#000000' } : undefined}>{children}</em>;
          },
          // Tables (GitHub Flavored Markdown) - Enhanced with theme-aware styling
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 -mx-2 sm:mx-0">
                <table className={`min-w-full border-collapse border ${isDarkMode ? 'border-gray-600/50' : 'border-gray-300'} rounded-lg overflow-hidden shadow-lg`}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className={`${isDarkMode ? 'bg-gray-700/80 border-gray-600' : 'bg-gray-100 border-gray-300'} border-b-2`}>{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className={`${isDarkMode ? 'bg-gray-800/40 divide-gray-700/50' : 'bg-white divide-gray-200'} divide-y`}>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className={`${isDarkMode ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} transition-colors duration-150`}>{children}</tr>;
          },
          th({ children }) {
            return (
              <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-100 border-gray-600/50' : 'text-gray-900 border-gray-300'} border-r last:border-r-0`}>
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-200 border-gray-600/30' : 'text-gray-800 border-gray-200'} border-r last:border-r-0 leading-relaxed`}>
                {children}
              </td>
            );
          },
          // Images
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || 'Image'}
                className="max-w-full h-auto rounded-lg my-3 shadow-sm"
                loading="lazy"
              />
            );
          },
          // Horizontal rule
          hr() {
            return <hr className="my-4 border-t border-gray-300" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
