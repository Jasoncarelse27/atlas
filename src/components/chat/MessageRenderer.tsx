import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { uploadImage } from '../../services/uploadService';
import { useMessageStore } from '../../stores/useMessageStore';
import type { Message } from '../../types/chat';
import { ImageMessageBubble } from './ImageMessageBubble';

interface MessageRendererProps {
  message: Message;
  className?: string;
  allMessages?: Message[];
}

// Legacy support for string content
interface LegacyMessageRendererProps {
  content: string;
  className?: string;
}

export function MessageRenderer({ message, className = '', allMessages = [] }: MessageRendererProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopy = async (codeContent: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopiedStates(prev => ({ ...prev, [codeId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const retryUpload = async (messageId: string) => {
    console.log("Retrying upload for", messageId);
    
    // Find the message and retry upload
    const message = useMessageStore.getState().messages.find(m => m.id === messageId);
    if (message && message.localUrl) {
      // Reset error state
      useMessageStore.getState().updateMessage(messageId, { 
        error: false, 
        uploading: true, 
        status: 'uploading' 
      });
      
      // Create a new file from the blob URL and retry upload
      try {
        const response = await fetch(message.localUrl);
        const blob = await response.blob();
        const file = new File([blob], 'retry-upload.jpg', { type: blob.type });
        
        // Retry the upload
        await uploadImage(messageId, file);
      } catch (error) {
        console.error('Retry upload failed:', error);
        useMessageStore.getState().markUploadFailed(messageId);
      }
    }
  };

  // Handle image messages with professional preview
  if (message.type === "image") {
    return (
      <ImageMessageBubble 
        message={message} 
        onRetry={retryUpload}
        allMessages={allMessages}
        className={className}
      />
    );
  }

  // Handle audio messages
  if (message.type === "audio") {
    return (
      <div className={`my-2 rounded-xl bg-gray-800 p-2 text-white ${className}`}>
        🎤 Sent an audio recording
      </div>
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

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }) {
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
                className="bg-gray-800/50 px-1.5 py-0.5 rounded text-sm font-mono text-gray-200" 
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-semibold mb-2 text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-medium mb-2 text-white">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-gray-200">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-[#B2BDA3] pl-4 py-2 my-3 bg-gray-800/30 rounded-r">
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
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-gray-300">{children}</em>;
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

  const handleCopy = async (codeContent: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopiedStates(prev => ({ ...prev, [codeId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }) {
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
                className="bg-gray-800/50 px-1.5 py-0.5 rounded text-sm font-mono text-gray-200" 
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-semibold mb-2 text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-medium mb-2 text-white">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-gray-200">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-[#B2BDA3] pl-4 py-2 my-3 bg-gray-800/30 rounded-r">
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
              >
                {children}
              </a>
            );
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-gray-300">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
