import React from 'react';
import { X, Check, Crown, Download, Calendar, Bell, Shield } from 'lucide-react';
import { TIER_CONFIGS } from '../types/subscription';
import type { UserProfile } from '../types/subscription';
import Tooltip from './Tooltip';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string;
  profile: UserProfile | null;
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  tier,
  profile
}) => {
  if (!isOpen) return null;

  const tierConfig = TIER_CONFIGS[tier];
  const currentDate = new Date();
  const nextBillingDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-300 shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header with gradient background */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Upgrade Successful!</h2>
                <p className="opacity-90">Your account has been upgraded to {tierConfig.displayName}</p>
              </div>
            </div>
            <Tooltip content="Close" position="left">
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Success Message */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to {tierConfig.displayName}!
              </h3>
              <p className="text-gray-600">
                Your payment was successful and your account has been upgraded. You now have access to all {tierConfig.displayName} features.
              </p>
            </div>

            {/* Plan Details */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-4">Plan Details</h4>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">{tierConfig.displayName}</span>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Price</span>
                  <span className="font-medium text-gray-900">{tierConfig.price}</span>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Billing Cycle</span>
                  <span className="font-medium text-gray-900">Monthly</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Billing Date</span>
                  <span className="font-medium text-gray-900">{nextBillingDate.toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">What's Included</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tierConfig.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Crown className="w-5 h-5" />
                <span>Start Using Pro Features</span>
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                <span>Download Receipt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Secure payment processed by Stripe</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Manage Subscription</span>
              </button>
              
              <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Bell className="w-4 h-4" />
                <span>Set Reminders</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;