import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface SkeletonLoaderProps {
  type: 'message' | 'conversation' | 'chat' | 'widget' | 'card' | 'list' | 'custom';
  count?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Unified skeleton loading component for consistent loading states across the app
 */
export function SkeletonLoader({ type, count = 1, className = '', children }: SkeletonLoaderProps) {
  const baseColor = '#f3f4f6'; // gray-100
  const highlightColor = '#e5e7eb'; // gray-200
  const darkBaseColor = '#1f2937'; // gray-800
  const darkHighlightColor = '#374151'; // gray-700
  
  const isDark = document.documentElement.classList.contains('dark');
  
  const renderSkeleton = () => {
    switch (type) {
      case 'message':
        return Array.from({ length: count }).map((_, index) => (
          <div key={index} className={`flex gap-3 mb-4 ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[80%] ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
              <Skeleton circle width={32} height={32} />
              <div className={`flex-1 ${index % 2 === 0 ? '' : 'text-right'}`}>
                <Skeleton height={16} width={100} className="mb-2" />
                <div className={`p-4 rounded-2xl ${index % 2 === 0 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-atlas-sage/20'}`}>
                  <Skeleton count={2} />
                  <Skeleton width="60%" />
                </div>
              </div>
            </div>
          </div>
        ));
        
      case 'conversation':
        return Array.from({ length: count }).map((_, index) => (
          <div key={index} className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <Skeleton circle width={40} height={40} />
              <div className="flex-1">
                <Skeleton height={20} width="70%" className="mb-2" />
                <Skeleton height={16} width="90%" />
                <Skeleton height={14} width={120} className="mt-2" />
              </div>
            </div>
          </div>
        ));
        
      case 'chat':
        return (
          <div className="flex-1 p-4">
            {/* Chat header skeleton */}
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Skeleton height={24} width={200} />
            </div>
            {/* Messages skeleton */}
            {renderSkeleton()}
          </div>
        );
        
      case 'widget':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton circle width={40} height={40} />
              <div className="flex-1">
                <Skeleton height={20} width="60%" className="mb-2" />
                <Skeleton height={16} width="40%" />
              </div>
            </div>
            <Skeleton height={80} />
          </div>
        );
        
      case 'card':
        return Array.from({ length: count }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <Skeleton height={24} width="60%" className="mb-3" />
            <Skeleton count={2} className="mb-2" />
            <Skeleton width="40%" />
          </div>
        ));
        
      case 'list':
        return (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: count }).map((_, index) => (
              <div key={index} className="p-4">
                <Skeleton height={20} width="80%" className="mb-2" />
                <Skeleton height={16} width="60%" />
              </div>
            ))}
          </div>
        );
        
      case 'custom':
        return children;
        
      default:
        return <Skeleton count={count} />;
    }
  };
  
  return (
    <SkeletonTheme
      baseColor={isDark ? darkBaseColor : baseColor}
      highlightColor={isDark ? darkHighlightColor : highlightColor}
    >
      <div className={className}>
        {renderSkeleton()}
      </div>
    </SkeletonTheme>
  );
}

/**
 * Message skeleton for chat interface
 */
export function MessageSkeleton({ count = 3 }: { count?: number }) {
  return <SkeletonLoader type="message" count={count} />;
}

/**
 * Conversation list skeleton
 */
export function ConversationSkeleton({ count = 5 }: { count?: number }) {
  return <SkeletonLoader type="conversation" count={count} />;
}

/**
 * Widget skeleton for dashboard widgets
 */
export function WidgetSkeleton() {
  return <SkeletonLoader type="widget" />;
}

/**
 * Card skeleton for general card layouts
 */
export function CardSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="card" count={count} />;
}

/**
 * List skeleton for simple list layouts
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return <SkeletonLoader type="list" count={count} />;
}
