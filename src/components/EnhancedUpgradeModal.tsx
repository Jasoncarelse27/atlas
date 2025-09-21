import { useEffect, useRef } from "react";
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

declare global { interface Window { Paddle?: any; } }

const CORE_PRICE_ID = import.meta.env.VITE_PADDLE_CORE_PRICE_ID!;
const STUDIO_PRICE_ID = import.meta.env.VITE_PADDLE_STUDIO_PRICE_ID!;
const PADDLE_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN!;
const PADDLE_ENV = import.meta.env.VITE_PADDLE_ENVIRONMENT || "sandbox";

interface EnhancedUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: string;
  reason?: string;
  onUpgrade?: (tier: string) => void;
}

export function EnhancedUpgradeModal({ 
  isOpen, 
  onClose, 
  currentTier,
  reason = 'upgrade',
  onUpgrade
}: EnhancedUpgradeModalProps) {
  const paddleReady = useRef(false);

  useEffect(() => {
    if (paddleReady.current || !isOpen) return;
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => {
      window.Paddle?.Environment?.set(PADDLE_ENV);
      window.Paddle?.Setup?.({ token: PADDLE_TOKEN });
      paddleReady.current = true;
    };
    document.head.appendChild(s);
  }, [isOpen]);

  const checkout = async (plan: "core" | "studio") => {
    if (!window.Paddle) {
      toast.error('Payment system loading... Please try again in a moment.');
      return;
    }

    try {
      // Get current user for checkout
      const { data: { user } } = await supabase.auth.getUser();
      const priceId = plan === "core" ? CORE_PRICE_ID : STUDIO_PRICE_ID;
      
      window.Paddle?.Checkout?.open({
        items: [{ priceId, quantity: 1 }],
        customer: user?.email ? { email: user.email } : undefined,
        customData: {
          userId: user?.id,
          targetTier: plan,
          source: 'upgrade_modal'
        },
        successCallback: async () => {
          toast.success(`Successfully upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`);
          
          // Verify subscription update
          if (user?.id) {
            try {
              const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
              const response = await fetch(`${baseUrl}/admin/verify-subscription?userId=${user.id}`);
              const result = await response.json();
              
              if (result.success) {
                console.log('Subscription verified:', result.tier);
                onUpgrade?.(result.tier);
              }
            } catch (error) {
              console.warn('Failed to verify subscription:', error);
            }
          }
          
          onClose();
        },
        closeCallback: () => {
          console.log('Paddle checkout closed');
        },
        errorCallback: (error: any) => {
          console.error('Paddle checkout error:', error);
          toast.error('Payment failed. Please try again.');
        }
      });
    } catch (error) {
      console.error('Failed to open checkout:', error);
      toast.error('Failed to open checkout. Please try again.');
    }
  };

  const getReasonMessage = () => {
    switch (reason) {
      case 'daily_limit':
        return "You've used all 15 conversations today! 🎯";
      case 'budget_limit':
        return "Daily budget limit reached 💰";
      default:
        return "Upgrade for unlimited access 🚀";
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 grid place-items-center bg-black/40 z-50">
      <div className="w-[min(92vw,520px)] rounded-2xl p-6"
           style={{ background: "#F4E5D9", border: "2px solid #B2BDA3" }}>
        
        <h2 className="text-xl font-semibold mb-2 text-center">
          {getReasonMessage()}
        </h2>
        <p className="opacity-80 mb-6 text-center">
          Choose the plan that fits your emotional wellbeing journey
        </p>
        
        <div className="grid gap-4 mb-6">
          {/* Core Plan */}
          <div className="bg-white rounded-xl p-4 border-2 border-transparent hover:border-green-200 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">🌱 Core</h3>
                <p className="text-2xl font-bold text-green-600">$19.99<span className="text-sm font-normal text-gray-500">/month</span></p>
              </div>
            </div>
            <ul className="text-sm space-y-1 mb-4 text-gray-600">
              <li>• Unlimited messages</li>
              <li>• Claude Sonnet access</li>
              <li>• Persistent memory</li>
              <li>• EQ challenges</li>
            </ul>
            <button 
              onClick={() => checkout("core")} 
              className="w-full rounded-xl py-3 font-medium text-white transition-colors hover:opacity-90" 
              style={{ background: "#B2BDA3" }}
            >
              Upgrade to Core
            </button>
          </div>

          {/* Studio Plan */}
          <div className="bg-white rounded-xl p-4 border-2 border-transparent hover:border-purple-200 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">🚀 Studio</h3>
                <p className="text-2xl font-bold text-purple-600">$179.99<span className="text-sm font-normal text-gray-500">/month</span></p>
              </div>
            </div>
            <ul className="text-sm space-y-1 mb-4 text-gray-600">
              <li>• Everything in Core</li>
              <li>• Claude Opus access</li>
              <li>• Advanced analytics</li>
              <li>• Priority processing</li>
              <li>• Premium insights</li>
            </ul>
            <button 
              onClick={() => checkout("studio")} 
              className="w-full rounded-xl py-3 font-medium text-white bg-purple-500 hover:bg-purple-600 transition-colors"
            >
              Upgrade to Studio
            </button>
          </div>
        </div>
        
        <div className="text-center">
          <button onClick={onClose} className="text-sm underline opacity-80 hover:opacity-100 transition-opacity">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

export default EnhancedUpgradeModal;