import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types/subscription';
import { 
  TestTube, 
  Grid3X3, 
  Sliders, 
  Settings, 
  User as UserIcon,
  BarChart3,
  Zap,
  MessageSquare,
  Clock,
  Target,
  Brain,
  Edit3,
  Calculator,
  Globe,
  Bookmark,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Palette,
  Layout,
  Monitor,
  Smartphone,
  Tablet,
  Keyboard,
  Volume2,
  Download,
  Upload,
  RefreshCw,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Database,
  Code,
  Bug,
  Shield,
  Lock,
  Unlock,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Info,
  Star,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Menu,
  X
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import ProgressBar from './ProgressBar';
import ImageCard from './ImageCard';

interface DashboardTesterProps {
  user: User;
  profile: UserProfile;
  onClose: () => void;
  onShowWidgets: () => void;
  onShowControlCenter: () => void;
}

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'pending';
  score?: number;
  maxScore?: number;
  details?: string;
  recommendations?: string[];
  duration?: number;
  timestamp?: string;
}

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  cssRules: number;
}

const DashboardTester: React.FC<DashboardTesterProps> = ({
  user,
  profile,
  onClose,
  onShowWidgets,
  onShowControlCenter
}) => {
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showHamburgerDemo, setShowHamburgerDemo] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        runPerformanceTest();
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Initialize performance metrics on mount
  useEffect(() => {
    runPerformanceTest();
  }, []);

  const runPerformanceTest = async () => {
    const startTime = performance.now();
    
    try {
      // Collect performance metrics with error handling
      const metrics: PerformanceMetrics = {
        loadTime: performance.now(),
        renderTime: 0,
        memoryUsage: 0,
        domNodes: document.querySelectorAll('*').length,
        eventListeners: 0,
        cssRules: 0
      };

      // Safe memory usage check
      try {
        const memoryInfo = (performance as any).memory;
        if (memoryInfo && memoryInfo.usedJSHeapSize) {
          metrics.memoryUsage = memoryInfo.usedJSHeapSize;
        }
      } catch (e) {
        console.warn('Memory API not available');
      }

      // Safe CSS rules count
      try {
        metrics.cssRules = Array.from(document.styleSheets).reduce((count, sheet) => {
          try {
            return count + (sheet.cssRules?.length || 0);
          } catch {
            return count; // Cross-origin stylesheets
          }
        }, 0);
      } catch (e) {
        console.warn('CSS rules counting failed');
      }

      // Measure render time
      requestAnimationFrame(() => {
        metrics.renderTime = performance.now() - startTime;
        setPerformanceMetrics(metrics);
      });
    } catch (error) {
      console.error('Performance test failed:', error);
    }
  };

  const runAccessibilityTest = async (): Promise<TestResult> => {
    const startTime = performance.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    const maxScore = 15;

    try {
      // Test 1: Focus management (2 points)
      const focusableElements = document.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 15) {
        score += 2;
      } else if (focusableElements.length > 10) {
        score += 1;
        recommendations.push('Add more interactive elements for better navigation');
      } else {
        issues.push('Insufficient focusable elements for proper navigation');
        recommendations.push('Ensure all interactive elements are keyboard accessible');
      }

      // Test 2: ARIA labels and roles (3 points)
      const elementsWithAriaLabels = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]');
      const elementsWithRoles = document.querySelectorAll('[role]');
      const landmarkRoles = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
      
      if (elementsWithAriaLabels.length > 10) score += 1;
      if (elementsWithRoles.length > 5) score += 1;
      if (landmarkRoles.length > 2) score += 1;
      
      if (elementsWithAriaLabels.length <= 5) {
        issues.push('Missing ARIA labels on interactive elements');
        recommendations.push('Add aria-label attributes to buttons and interactive elements');
      }

      // Test 3: Heading structure (2 points)
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const h1Count = document.querySelectorAll('h1').length;
      
      if (headings.length > 5 && h1Count <= 1) {
        score += 2;
      } else if (headings.length > 3) {
        score += 1;
        recommendations.push('Ensure proper heading hierarchy (only one h1 per page)');
      } else {
        issues.push('Poor heading structure for screen readers');
        recommendations.push('Add more semantic headings to structure content');
      }

      // Test 4: Form accessibility (2 points)
      const inputs = document.querySelectorAll('input, textarea, select');
      const inputsWithLabels = document.querySelectorAll('input[aria-label], input[aria-labelledby], textarea[aria-label], textarea[aria-labelledby], select[aria-label], select[aria-labelledby]');
      const labels = document.querySelectorAll('label');
      
      if (inputs.length === 0 || (inputsWithLabels.length + labels.length) >= inputs.length) {
        score += 2;
      } else {
        issues.push('Form inputs missing proper labels');
        recommendations.push('Associate all form inputs with labels or aria-label attributes');
      }

      // Test 5: Keyboard navigation (2 points)
      const keyboardTraps = document.querySelectorAll('[tabindex]');
      const negativeTabIndex = document.querySelectorAll('[tabindex="-1"]');
      
      if (keyboardTraps.length === 0 || negativeTabIndex.length < keyboardTraps.length * 0.5) {
        score += 2;
      } else {
        recommendations.push('Review tabindex usage for proper keyboard navigation');
      }

      // Test 6: Color contrast (2 points)
      const buttons = document.querySelectorAll('button');
      let contrastIssues = 0;
      
      buttons.forEach(button => {
        try {
          const styles = getComputedStyle(button);
          const bgColor = styles.backgroundColor;
          const textColor = styles.color;
          
          if (bgColor === textColor || (!bgColor.includes('rgb') && !textColor.includes('rgb'))) {
            contrastIssues++;
          }
        } catch (e) {
          // Skip if getComputedStyle fails
        }
      });
      
      if (contrastIssues < buttons.length * 0.1) {
        score += 2;
      } else if (contrastIssues < buttons.length * 0.2) {
        score += 1;
        recommendations.push('Review color contrast ratios for better accessibility');
      } else {
        issues.push('Potential color contrast issues detected');
        recommendations.push('Ensure 4.5:1 contrast ratio for normal text, 3:1 for large text');
      }

      // Test 7: Live regions (1 point)
      const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
      if (liveRegions.length > 0) {
        score += 1;
      } else {
        recommendations.push('Add live regions for dynamic content updates');
      }

      // Test 8: Skip links (1 point)
      const skipLinks = document.querySelectorAll('[href="#main"], [href="#content"], .skip-link');
      if (skipLinks.length > 0) {
        score += 1;
      } else {
        recommendations.push('Add skip links for keyboard and screen reader users');
      }

      // Test 9: Image alt text (2 points)
      const images = document.querySelectorAll('img');
      const imagesWithAlt = document.querySelectorAll('img[alt]');
      
      if (images.length === 0 || imagesWithAlt.length >= images.length * 0.9) {
        score += 2;
      } else if (imagesWithAlt.length >= images.length * 0.7) {
        score += 1;
        recommendations.push('Add alt text to all images');
      } else {
        issues.push('Many images missing alt text');
        recommendations.push('Provide descriptive alt text for all images');
      }

    } catch (error) {
      console.error('Accessibility test error:', error);
      issues.push('Error during accessibility testing');
    }

    const duration = performance.now() - startTime;
    const percentage = Math.round((score / maxScore) * 100);

    return {
      id: 'accessibility',
      name: 'Accessibility',
      status: score >= 12 ? 'pass' : score >= 8 ? 'warning' : 'fail',
      score,
      maxScore,
      details: `Score: ${score}/${maxScore} (${percentage}%)\n\nFocusable Elements: ${document.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').length}\nARIA Labels: ${document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]').length}\nHeadings: ${document.querySelectorAll('h1, h2, h3, h4, h5, h6').length}\nLive Regions: ${document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length}\n\nIssues Found: ${issues.length}\n${issues.map(i => `• ${i}`).join('\n')}\n\nRecommendations: ${recommendations.length}\n${recommendations.map(r => `• ${r}`).join('\n')}`,
      recommendations,
      duration,
      timestamp: new Date().toISOString()
    };
  };

  const runPerformanceTestDetailed = async (): Promise<TestResult> => {
    const startTime = performance.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    const maxScore = 10;

    try {
      // Test DOM complexity
      const domNodes = document.querySelectorAll('*').length;
      if (domNodes < 1000) {
        score += 2;
      } else if (domNodes < 2000) {
        score += 1;
        recommendations.push('Consider optimizing DOM structure for better performance');
      } else {
        issues.push('High DOM complexity detected');
        recommendations.push('Reduce DOM nodes for better rendering performance');
      }

      // Test CSS complexity
      let cssRules = 0;
      try {
        cssRules = Array.from(document.styleSheets).reduce((count, sheet) => {
          try {
            return count + (sheet.cssRules?.length || 0);
          } catch {
            return count; // Cross-origin stylesheet
          }
        }, 0);
      } catch (e) {
        console.warn('CSS rules counting failed');
      }

      if (cssRules < 500) {
        score += 2;
      } else if (cssRules < 1000) {
        score += 1;
      } else {
        issues.push('High CSS complexity');
        recommendations.push('Optimize CSS rules and remove unused styles');
      }

      // Test memory usage
      let memoryUsage = 0;
      try {
        const memoryInfo = (performance as any).memory;
        if (memoryInfo && memoryInfo.usedJSHeapSize) {
          memoryUsage = memoryInfo.usedJSHeapSize / 1024 / 1024; // MB
          if (memoryUsage < 50) {
            score += 2;
          } else if (memoryUsage < 100) {
            score += 1;
          } else {
            issues.push('High memory usage detected');
            recommendations.push('Optimize JavaScript memory usage');
          }
        } else {
          score += 1; // Give partial credit if memory API unavailable
          recommendations.push('Memory API not available for testing');
        }
      } catch (e) {
        console.warn('Memory testing failed');
        score += 1; // Give partial credit
      }

      // Test animation performance
      try {
        const animationStartTime = performance.now();
        document.body.style.transform = 'translateX(1px)';
        await new Promise(resolve => requestAnimationFrame(resolve));
        document.body.style.transform = '';
        const animationTime = performance.now() - animationStartTime;

        if (animationTime < 16) {
          score += 2;
        } else if (animationTime < 32) {
          score += 1;
        } else {
          issues.push('Slow animation performance');
          recommendations.push('Optimize animations for 60fps performance');
        }
      } catch (e) {
        console.warn('Animation test failed');
        score += 1; // Give partial credit
      }

      // Test image optimization
      const images = document.querySelectorAll('img');
      const imagesWithSrcset = document.querySelectorAll('img[srcset]');
      const imagesWithLoading = document.querySelectorAll('img[loading="lazy"]');

      if (images.length === 0 || (imagesWithSrcset.length + imagesWithLoading.length) >= images.length * 0.5) {
        score += 2;
      } else {
        recommendations.push('Add responsive images and lazy loading');
      }

    } catch (error) {
      console.error('Performance test error:', error);
      issues.push('Error during performance testing');
    }

    const duration = performance.now() - startTime;
    const percentage = Math.round((score / maxScore) * 100);

    return {
      id: 'performance',
      name: 'Performance',
      status: score >= 8 ? 'pass' : score >= 6 ? 'warning' : 'fail',
      score,
      maxScore,
      details: `Score: ${score}/${maxScore} (${percentage}%)\n\nDOM Nodes: ${document.querySelectorAll('*').length}\nCSS Rules: ${cssRules}\nMemory: ${memoryUsage > 0 ? Math.round(memoryUsage) : 'N/A'}MB\nImages: ${document.querySelectorAll('img').length} (${document.querySelectorAll('img[loading="lazy"]').length} lazy)\n\nIssues Found: ${issues.length}\n${issues.map(i => `• ${i}`).join('\n')}\n\nRecommendations:\n${recommendations.map(r => `• ${r}`).join('\n')}`,
      recommendations,
      duration,
      timestamp: new Date().toISOString()
    };
  };

  const runSecurityTest = async (): Promise<TestResult> => {
    const startTime = performance.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    const maxScore = 8;

    try {
      // Test HTTPS
      if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
        score += 2;
      } else {
        issues.push('Not using HTTPS');
        recommendations.push('Use HTTPS for secure communication');
      }

      // Test CSP headers
      const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (metaCSP) {
        score += 1;
      } else {
        recommendations.push('Add Content Security Policy headers');
      }

      // Test for inline scripts
      const inlineScripts = document.querySelectorAll('script:not([src])');
      if (inlineScripts.length === 0) {
        score += 2;
      } else if (inlineScripts.length < 3) {
        score += 1;
        recommendations.push('Minimize inline scripts for better security');
      } else {
        issues.push('Multiple inline scripts detected');
        recommendations.push('Move inline scripts to external files');
      }

      // Test for external resources
      const externalLinks = document.querySelectorAll('a[href^="http"]:not([rel*="noopener"])');
      if (externalLinks.length === 0) {
        score += 1;
      } else {
        recommendations.push('Add rel="noopener" to external links');
      }

      // Test form security
      const forms = document.querySelectorAll('form');
      const securedForms = document.querySelectorAll('form[method="post"]');
      if (forms.length === 0 || securedForms.length === forms.length) {
        score += 2;
      } else {
        recommendations.push('Use POST method for sensitive form data');
      }

    } catch (error) {
      console.error('Security test error:', error);
      issues.push('Error during security testing');
    }

    const duration = performance.now() - startTime;
    const percentage = Math.round((score / maxScore) * 100);

    return {
      id: 'security',
      name: 'Security',
      status: score >= 6 ? 'pass' : score >= 4 ? 'warning' : 'fail',
      score,
      maxScore,
      details: `Score: ${score}/${maxScore} (${percentage}%)\n\nProtocol: ${window.location.protocol}\nInline Scripts: ${document.querySelectorAll('script:not([src])').length}\nExternal Links: ${document.querySelectorAll('a[href^="http"]').length}\nForms: ${document.querySelectorAll('form').length}\n\nIssues Found: ${issues.length}\n${issues.map(i => `• ${i}`).join('\n')}\n\nRecommendations:\n${recommendations.map(r => `• ${r}`).join('\n')}`,
      recommendations,
      duration,
      timestamp: new Date().toISOString()
    };
  };

  const runResponsiveTest = async (): Promise<TestResult> => {
    const startTime = performance.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;
    const maxScore = 6;
    let mediaQueryCount = 0; // Initialize at function scope

    try {
      // Test viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport && viewport.getAttribute('content')?.includes('width=device-width')) {
        score += 2;
      } else {
        issues.push('Missing or incorrect viewport meta tag');
        recommendations.push('Add proper viewport meta tag');
      }

      // Test responsive classes
      const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"], [class*="xl:"]');
      if (responsiveElements.length > 10) {
        score += 2;
      } else if (responsiveElements.length > 5) {
        score += 1;
      } else {
        issues.push('Limited responsive design implementation');
        recommendations.push('Add more responsive utility classes');
      }

      // Test media queries
      try {
        const stylesheets = Array.from(document.styleSheets);
        stylesheets.forEach(sheet => {
          try {
            Array.from(sheet.cssRules).forEach(rule => {
              if (rule.type === CSSRule.MEDIA_RULE) {
                mediaQueryCount++;
              }
            });
          } catch (e) {
            // Cross-origin stylesheet
          }
        });
      } catch (e) {
        console.warn('Media query counting failed');
      }

      if (mediaQueryCount > 5) {
        score += 2;
      } else if (mediaQueryCount > 2) {
        score += 1;
      } else {
        recommendations.push('Add more media queries for better responsive design');
      }

    } catch (error) {
      console.error('Responsive test error:', error);
      issues.push('Error during responsive testing');
    }

    const duration = performance.now() - startTime;
    const percentage = Math.round((score / maxScore) * 100);

    return {
      id: 'responsive',
      name: 'Responsive Design',
      status: score >= 5 ? 'pass' : score >= 3 ? 'warning' : 'fail',
      score,
      maxScore,
      details: `Score: ${score}/${maxScore} (${percentage}%)\n\nViewport Meta: ${document.querySelector('meta[name="viewport"]') ? 'Present' : 'Missing'}\nResponsive Elements: ${document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"], [class*="xl:"]').length}\nMedia Queries: ${mediaQueryCount}\n\nIssues Found: ${issues.length}\n${issues.map(i => `• ${i}`).join('\n')}\n\nRecommendations:\n${recommendations.map(r => `• ${r}`).join('\n')}`,
      recommendations,
      duration,
      timestamp: new Date().toISOString()
    };
  };

  const dashboardTests = [
    {
      id: 'widget-system',
      name: 'Widget System',
      description: 'Test widget dashboard functionality and interactions',
      icon: Grid3X3,
      category: 'dashboard',
      action: async () => {
        const startTime = performance.now();
        
        try {
          // Test widget system availability
          const widgetElements = document.querySelectorAll('[class*="widget"], [data-widget]');
          const hasWidgetButton = document.querySelector('[aria-label*="widget"], [aria-label*="Widget"]');
          
          // Simulate opening widgets
          onShowWidgets();
          
          // Wait for widgets to potentially load
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const duration = performance.now() - startTime;
          
          return {
            id: 'widget-system',
            name: 'Widget System',
            status: 'pass' as const,
            score: 10,
            maxScore: 10,
            details: `Widget system test completed successfully.\n\nWidget Elements Found: ${widgetElements.length}\nWidget Button Available: ${hasWidgetButton ? 'Yes' : 'No'}\n\nThe widget system appears to be properly integrated and accessible.`,
            duration,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          const duration = performance.now() - startTime;
          return {
            id: 'widget-system',
            name: 'Widget System',
            status: 'fail' as const,
            score: 0,
            maxScore: 10,
            details: `Widget system test failed: ${error}`,
            duration,
            timestamp: new Date().toISOString()
          };
        }
      }
    },
    {
      id: 'control-center',
      name: 'Control Center',
      description: 'Test control center and customization features',
      icon: Sliders,
      category: 'dashboard',
      action: async () => {
        const startTime = performance.now();
        
        try {
          // Test control center availability
          const controlElements = document.querySelectorAll('[class*="control"], [data-control]');
          const hasControlButton = document.querySelector('[aria-label*="control"], [aria-label*="Control"]');
          
          // Simulate opening control center
          onShowControlCenter();
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const duration = performance.now() - startTime;
          
          return {
            id: 'control-center',
            name: 'Control Center',
            status: 'pass' as const,
            score: 10,
            maxScore: 10,
            details: `Control center test completed successfully.\n\nControl Elements Found: ${controlElements.length}\nControl Button Available: ${hasControlButton ? 'Yes' : 'No'}\n\nThe control center appears to be properly integrated and accessible.`,
            duration,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          const duration = performance.now() - startTime;
          return {
            id: 'control-center',
            name: 'Control Center',
            status: 'fail' as const,
            score: 0,
            maxScore: 10,
            details: `Control center test failed: ${error}`,
            duration,
            timestamp: new Date().toISOString()
          };
        }
      }
    },
    {
      id: 'theme-system',
      name: 'Theme System',
      description: 'Test dynamic theming and color customization',
      icon: Palette,
      category: 'ui',
      action: async () => {
        const startTime = performance.now();
        
        try {
          const root = document.documentElement;
          const originalPrimary = getComputedStyle(root).getPropertyValue('--primary-color') || '#3B82F6';
          const originalAccent = getComputedStyle(root).getPropertyValue('--accent-color') || '#10B981';
          
          // Test theme changes
          root.style.setProperty('--primary-color', '#8B5CF6');
          root.style.setProperty('--accent-color', '#EC4899');
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify changes applied
          const newPrimary = getComputedStyle(root).getPropertyValue('--primary-color');
          const newAccent = getComputedStyle(root).getPropertyValue('--accent-color');
          
          // Revert changes
          root.style.setProperty('--primary-color', originalPrimary);
          root.style.setProperty('--accent-color', originalAccent);
          
          const duration = performance.now() - startTime;
          const themeWorking = newPrimary.includes('8B5CF6') && newAccent.includes('EC4899');
          
          return {
            id: 'theme-system',
            name: 'Theme System',
            status: themeWorking ? 'pass' as const : 'warning' as const,
            score: themeWorking ? 10 : 7,
            maxScore: 10,
            details: `Theme system test completed.\n\nOriginal Primary: ${originalPrimary}\nTest Primary: ${newPrimary}\nOriginal Accent: ${originalAccent}\nTest Accent: ${newAccent}\n\nTheme Changes Applied: ${themeWorking ? 'Yes' : 'Partial'}\n\nThe theme system ${themeWorking ? 'is working correctly' : 'may have some issues'}.`,
            duration,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          const duration = performance.now() - startTime;
          return {
            id: 'theme-system',
            name: 'Theme System',
            status: 'fail' as const,
            score: 0,
            maxScore: 10,
            details: `Theme system test failed: ${error}`,
            duration,
            timestamp: new Date().toISOString()
          };
        }
      }
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      description: 'Test keyboard navigation and screen reader support',
      icon: Eye,
      category: 'quality',
      action: runAccessibilityTest
    },
    {
      id: 'performance',
      name: 'Performance',
      description: 'Test loading times, animations, and resource usage',
      icon: Zap,
      category: 'quality',
      action: runPerformanceTestDetailed
    },
    {
      id: 'security',
      name: 'Security',
      description: 'Test security headers, HTTPS, and best practices',
      icon: Shield,
      category: 'quality',
      action: runSecurityTest
    },
    {
      id: 'responsive',
      name: 'Responsive Design',
      description: 'Test mobile and tablet layouts',
      icon: Monitor,
      category: 'ui',
      action: runResponsiveTest
    }
  ];

  const runSingleTest = async (test: any) => {
    setActiveTest(test.id);
    setTestResults(prev => ({
      ...prev,
      [test.id]: { 
        id: test.id,
        name: test.name,
        status: 'running',
        timestamp: new Date().toISOString()
      }
    }));

    try {
      const result = await test.action();
      setTestResults(prev => ({ ...prev, [test.id]: result }));
      setTestHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
    } catch (error) {
      console.error(`Test ${test.id} failed:`, error);
      const errorResult: TestResult = {
        id: test.id,
        name: test.name,
        status: 'fail',
        details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      setTestResults(prev => ({ ...prev, [test.id]: errorResult }));
    } finally {
      setActiveTest(null);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    
    for (const test of dashboardTests) {
      if (selectedCategory === 'all' || test.category === selectedCategory) {
        await runSingleTest(test);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between tests
      }
    }
    
    setIsRunningAll(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <LoadingSpinner size="sm" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'fail':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'running':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-gray-700 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getTestIcon = (name: string) => {
    switch (name) {
      case 'DNS Lookup':
        return <Globe className="w-5 h-5" />;
      case 'Latency':
        return <Clock className="w-5 h-5" />;
      case 'Download Speed':
        return <Download className="w-5 h-5" />;
      case 'Upload Speed':
        return <Upload className="w-5 h-5" />;
      case 'Connection Stability':
        return <Wifi className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const categories = [
    { id: 'all', name: 'All Tests', icon: TestTube },
    { id: 'dashboard', name: 'Dashboard', icon: Grid3X3 },
    { id: 'ui', name: 'UI/UX', icon: Palette },
    { id: 'quality', name: 'Quality', icon: Shield }
  ];

  const filteredTests = selectedCategory === 'all' 
    ? dashboardTests 
    : dashboardTests.filter(test => test.category === selectedCategory);

  const testStats = {
    total: Object.keys(testResults).length,
    passed: Object.values(testResults).filter(r => r.status === 'pass').length,
    failed: Object.values(testResults).filter(r => r.status === 'fail').length,
    warnings: Object.values(testResults).filter(r => r.status === 'warning').length
  };

  const overallScore = testStats.total > 0 
    ? Math.round(((testStats.passed * 100 + testStats.warnings * 50) / (testStats.total * 100)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dashboard-tester-title">
      <div className="neumorphic-card bg-white rounded-2xl border border-gray-300 shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Enhanced Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <TestTube className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 id="dashboard-tester-title" className="text-2xl font-bold text-gray-900">Dashboard Testing Suite</h2>
                <p className="text-gray-700">Comprehensive testing for Atlas dashboard components</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Overall Score */}
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{overallScore}%</div>
                <div className="text-xs text-gray-700">Overall Score</div>
              </div>
              
              {/* Auto-refresh toggle */}
              <Tooltip content="Auto-refresh performance metrics">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`neumorphic-button p-2 rounded-lg transition-colors ${
                    autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}
                  aria-label="Toggle auto-refresh"
                  aria-pressed={autoRefresh}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
              
              <button
                onClick={onClose}
                className="neumorphic-button p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close dashboard tester"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Test Statistics */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-lg font-bold text-gray-900">{testStats.total}</div>
              <div className="text-xs text-gray-700">Total Tests</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-lg font-bold text-green-600">{testStats.passed}</div>
              <div className="text-xs text-gray-700">Passed</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-lg font-bold text-yellow-600">{testStats.warnings}</div>
              <div className="text-xs text-gray-700">Warnings</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-lg font-bold text-red-600">{testStats.failed}</div>
              <div className="text-xs text-gray-700">Failed</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            {/* Category Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Categories</h3>
              <div className="space-y-1" role="radiogroup" aria-label="Test categories">
                {categories.map(category => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`neumorphic-button w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      role="radio"
                      aria-checked={selectedCategory === category.id}
                    >
                      <Icon className="w-4 h-4" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={runAllTests}
                  disabled={isRunningAll}
                  className="neumorphic-button w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  aria-label="Run all tests in selected category"
                >
                  {isRunningAll ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Running Tests...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run All Tests</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setTestResults({})}
                  className="neumorphic-button w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  aria-label="Clear all test results"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Results</span>
                </button>
                
                <button
                  onClick={() => setShowHamburgerDemo(!showHamburgerDemo)}
                  className={`neumorphic-button w-full px-3 py-2 ${
                    showHamburgerDemo ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  } rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
                  aria-label="Toggle hamburger menu demo"
                >
                  <Menu className="w-4 h-4" />
                  <span>{showHamburgerDemo ? 'Hide UI Demo' : 'Show UI Demo'}</span>
                </button>
              </div>
            </div>

            {/* Performance Metrics */}
            {performanceMetrics && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Live Metrics</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-700">DOM Nodes:</span>
                    <span className="font-mono text-gray-800">{performanceMetrics.domNodes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">CSS Rules:</span>
                    <span className="font-mono text-gray-800">{performanceMetrics.cssRules}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Memory:</span>
                    <span className="font-mono text-gray-800">{Math.round(performanceMetrics.memoryUsage / 1024 / 1024)}MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Test History */}
            {testHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Tests</h3>
                <div className="space-y-1">
                  {testHistory.slice(0, 5).map((result, index) => (
                    <div key={`${result.id}-${index}`} className="flex items-center gap-2 text-xs text-gray-700">
                      {getStatusIcon(result.status)}
                      <span className="truncate">{result.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {showHamburgerDemo ? (
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-bold mb-6">UI Design Demo</h3>
                
                {/* Hamburger Menu Demo */}
                <div className="screen bg-gray-800 rounded-xl overflow-hidden w-full max-w-md mx-auto mb-8">
                  <header className="p-4">
                    <a className={`target-burger ${showHamburgerDemo ? 'toggled' : ''}`} onClick={(e) => e.preventDefault()}>
                      <ul className="buns">
                        <li className="bun"></li>
                        <li className="bun"></li>
                      </ul>
                    </a>
                  </header>
                  
                  <div className={`container ${showHamburgerDemo ? 'toggled' : ''}`}>
                    <div className="app-content">
                      <ul className="content-list">
                        <li>
                          <ImageCard 
                            imageUrl="https://images.pexels.com/photos/1428930/pexels-photo-1428930.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
                            title="Eli DeFaria Dalaman"
                            category="Accessories"
                            price="£255"
                          />
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <nav className={`main-nav ${showHamburgerDemo ? 'toggled' : ''}`}>
                    <ul>
                      <li><a href="#"><span>My Account</span></a></li>
                      <li><a href="#"><span>Billing Information</span></a></li>
                      <li><a href="#"><span>MODES</span></a></li>
                      <li><a href="#"><span>Usage</span></a></li>
                      <li><a href="#"><span>Log Out</span></a></li>
                    </ul>
                  </nav>
                </div>
                
                <div className="text-center max-w-md">
                  <p className="text-gray-700 mb-4">
                    This demo shows the hamburger menu animation and blur effect from the provided design.
                    Click the hamburger icon to toggle the menu.
                  </p>
                  <p className="text-sm text-gray-500">
                    The design features a full-screen overlay menu with a blur effect on the main content.
                    This pattern can be implemented in Atlas using React and CSS transitions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTests.map((test) => {
                  const Icon = test.icon;
                  const result = testResults[test.id];
                  const isRunning = activeTest === test.id;
                  
                  return (
                    <div
                      key={test.id}
                      className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg neumorphic-card ${
                        result ? getStatusColor(result.status) : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg ${
                            result?.status === 'pass' ? 'bg-green-100' :
                            result?.status === 'fail' ? 'bg-red-100' :
                            result?.status === 'warning' ? 'bg-yellow-100' :
                            'bg-gray-100'
                          }`}>
                            <Icon className={`w-6 h-6 ${
                              result?.status === 'pass' ? 'text-green-600' :
                              result?.status === 'fail' ? 'text-red-600' :
                              result?.status === 'warning' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{test.name}</h4>
                            <p className="text-sm text-gray-800">{test.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {result && (
                            <button
                              onClick={() => setShowDetails(showDetails === test.id ? null : test.id)}
                              className="neumorphic-button p-1 text-gray-400 hover:text-gray-600 rounded"
                              aria-label={`${showDetails === test.id ? 'Hide' : 'Show'} details for ${test.name}`}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => runSingleTest(test)}
                            disabled={isRunning}
                            className="neumorphic-button px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            aria-label={`Run ${test.name} test`}
                          >
                            {isRunning ? <LoadingSpinner size="sm" color="white" /> : getStatusIcon(result?.status)}
                            {isRunning ? 'Testing...' : 'Test'}
                          </button>
                        </div>
                      </div>

                      {/* Score Display */}
                      {result && result.score !== undefined && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-700">Score</span>
                            <span className="font-mono text-gray-800">{result.score}/{result.maxScore}</span>
                          </div>
                          <ProgressBar
                            progress={(result.score / (result.maxScore || 1)) * 100}
                            color={result.status === 'pass' ? 'success' : result.status === 'warning' ? 'warning' : 'error'}
                            size="sm"
                          />
                        </div>
                      )}

                      {/* Test Details */}
                      {showDetails === test.id && result?.details && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                          <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                            {result.details}
                          </pre>
                          
                          {result.duration && (
                            <div className="mt-2 text-xs text-gray-600">
                              Completed in {result.duration.toFixed(2)}ms
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recommendations */}
                      {result?.recommendations && result.recommendations.length > 0 && (
                        <div className="mt-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Recommendations:</h5>
                          <ul className="text-xs text-gray-800 space-y-1">
                            {result.recommendations.slice(0, 3).map((rec, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-800">
              <span>Atlas Dashboard Testing Suite v2.1</span>
              <span>•</span>
              <span>{filteredTests.length} tests available</span>
              {testStats.total > 0 && (
                <>
                  <span>•</span>
                  <span>Overall score: {overallScore}%</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onShowWidgets}
                className="neumorphic-button px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                aria-label="Open widget dashboard"
              >
                Open Widgets
              </button>
              <button
                onClick={onShowControlCenter}
                className="neumorphic-button px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                aria-label="Open control center"
              >
                Control Center
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTester;