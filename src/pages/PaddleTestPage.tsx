import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

declare global { interface Window { Paddle?: any; } }

const CORE_PRICE_ID = import.meta.env.VITE_PADDLE_CORE_PRICE_ID;
const STUDIO_PRICE_ID = import.meta.env.VITE_PADDLE_STUDIO_PRICE_ID;
const PADDLE_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
const PADDLE_ENV = import.meta.env.VITE_PADDLE_ENVIRONMENT || "sandbox";

export default function PaddleTestPage() {
  const paddleReady = useRef(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Load Paddle
    if (paddleReady.current) return;
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => {
      console.log('Paddle script loaded');
      if (PADDLE_TOKEN) {
        window.Paddle?.Environment?.set(PADDLE_ENV);
        window.Paddle?.Setup?.({ token: PADDLE_TOKEN });
        paddleReady.current = true;
        console.log(`Paddle initialized in ${PADDLE_ENV} mode`);
      }
    };
    document.head.appendChild(s);
  }, []);

  const testCheckout = async (plan: "core" | "studio") => {
    if (!window.Paddle) {
      toast.error('Paddle not loaded yet. Please wait and try again.');
      return;
    }

    if (!user?.email) {
      toast.error('Please log in first to test checkout.');
      return;
    }

    setLoading(true);

    try {
      const priceId = plan === "core" ? CORE_PRICE_ID : STUDIO_PRICE_ID;
      
      if (!priceId) {
        throw new Error(`Missing price ID for ${plan} tier. Check your .env file.`);
      }

      console.log(`Opening Paddle checkout for ${plan}:`, { priceId, email: user.email });

      window.Paddle?.Checkout?.open({
        items: [{ priceId, quantity: 1 }],
        customer: { 
          email: user.email,
          id: user.id
        },
        customData: {
          userId: user.id,
          targetTier: plan,
          source: 'paddle_test_page'
        },
        successCallback: (data: any) => {
          console.log('Paddle success callback:', data);
          toast.success(`✅ Payment successful for ${plan} tier!`);
          setLoading(false);
        },
        closeCallback: () => {
          console.log('Paddle checkout closed');
          setLoading(false);
        },
        errorCallback: (error: any) => {
          console.error('Paddle error callback:', error);
          toast.error('Payment failed. Please try again.');
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('Failed to open checkout:', error);
      toast.error(`Failed to open checkout: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">🧪 Paddle Integration Test</h1>
        
        {/* Environment Info */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Environment Status</h2>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Paddle Environment:</strong> 
              <span className={`ml-2 px-2 py-1 rounded ${PADDLE_ENV === 'sandbox' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {PADDLE_ENV}
              </span>
            </div>
            <div>
              <strong>Client Token:</strong> 
              <span className={`ml-2 ${PADDLE_TOKEN ? 'text-green-600' : 'text-red-600'}`}>
                {PADDLE_TOKEN ? '✅ Set' : '❌ Missing'}
              </span>
            </div>
            <div>
              <strong>Core Price ID:</strong> 
              <span className={`ml-2 ${CORE_PRICE_ID ? 'text-green-600' : 'text-red-600'}`}>
                {CORE_PRICE_ID || '❌ Missing'}
              </span>
            </div>
            <div>
              <strong>Studio Price ID:</strong> 
              <span className={`ml-2 ${STUDIO_PRICE_ID ? 'text-green-600' : 'text-red-600'}`}>
                {STUDIO_PRICE_ID || '❌ Missing'}
              </span>
            </div>
            <div>
              <strong>Current User:</strong> 
              <span className={`ml-2 ${user ? 'text-green-600' : 'text-red-600'}`}>
                {user ? `✅ ${user.email}` : '❌ Not logged in'}
              </span>
            </div>
            <div>
              <strong>Paddle Ready:</strong> 
              <span className={`ml-2 ${paddleReady.current ? 'text-green-600' : 'text-yellow-600'}`}>
                {paddleReady.current ? '✅ Ready' : '⏳ Loading...'}
              </span>
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Test Checkout Flow</h2>
          
          {!user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800">
                ⚠️ Please log in first to test the checkout flow.
              </p>
            </div>
          )}
          
          {(!PADDLE_TOKEN || !CORE_PRICE_ID || !STUDIO_PRICE_ID) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 mb-2">
                ❌ Missing Paddle configuration. Add to your .env file:
              </p>
              <code className="text-xs bg-gray-100 p-2 rounded block">
                VITE_PADDLE_ENVIRONMENT=sandbox<br/>
                VITE_PADDLE_CLIENT_TOKEN=your_token<br/>
                VITE_PADDLE_CORE_PRICE_ID=pri_core_id<br/>
                VITE_PADDLE_STUDIO_PRICE_ID=pri_studio_id
              </code>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => testCheckout('core')}
              disabled={loading || !user || !PADDLE_TOKEN || !CORE_PRICE_ID}
              className="p-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Opening Checkout...' : 'Test Core Upgrade ($19.99)'}
            </button>
            
            <button
              onClick={() => testCheckout('studio')}
              disabled={loading || !user || !PADDLE_TOKEN || !STUDIO_PRICE_ID}
              className="p-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Opening Checkout...' : 'Test Studio Upgrade ($179.99)'}
            </button>
          </div>

          <div className="mt-6 text-sm text-gray-600">
            <p><strong>Note:</strong> This is in {PADDLE_ENV} mode - no real charges will occur.</p>
            <p>Use test card: 4000 0000 0000 0002 (any CVV, future date)</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-2 text-blue-800">Testing Instructions</h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Ensure you're logged into Atlas</li>
            <li>2. Check that all environment variables are set above</li>
            <li>3. Click "Test Core Upgrade" or "Test Studio Upgrade"</li>
            <li>4. Paddle checkout should open in a modal</li>
            <li>5. Use test card: 4000 0000 0000 0002</li>
            <li>6. Complete checkout and verify success callback</li>
            <li>7. Check browser console for success/error logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
