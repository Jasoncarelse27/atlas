import React from 'react';
import { Check, X } from 'lucide-react';
import type { UserProfile } from '../types/subscription';
import { TIER_CONFIGS } from '../types/subscription';
import Tooltip from './Tooltip';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  selectedBilling?: 'monthly' | 'yearly';
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  profile,
  selectedBilling = 'monthly'
}) => {
  if (!isOpen) return null;

  const tierConfig = TIER_CONFIGS[profile.tier];
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);



  const getPriceDisplay = (tier: string) => {
  const tierConfig = TIER_CONFIGS[tier];
    if (!tierConfig) return '';

    if (tier === 'free') {
      return tierConfig.price;
    }

    if (selectedBilling === 'yearly' && tierConfig.yearlyPrice) {
      return tierConfig.yearlyPrice;
    }

    return tierConfig.price;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
            <p className="text-gray-600 mt-1">Welcome to your new plan</p>
            </div>
            <Tooltip content="Close" position="left">
              <button
                onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Welcome to {tierConfig.displayName}!
              </h3>
              <p className="text-gray-600">
              Your subscription has been activated successfully. You now have access to all {tierConfig.displayName} features.
              </p>
            </div>

          {/* Subscription Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-gray-900 mb-4">Subscription Details</h4>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">{tierConfig.displayName}</span>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Price</span>
                <span className="font-medium text-gray-900">{getPriceDisplay(profile.tier)}</span>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Billing Cycle</span>
                <span className="font-medium text-gray-900">{selectedBilling === 'yearly' ? 'Yearly' : 'Monthly'}</span>
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
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onClose}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
              Start Using Atlas
              </button>
              
              <button
              onClick={() => {
                // Handle account settings or billing portal
                onClose();
              }}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Manage Subscription
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;