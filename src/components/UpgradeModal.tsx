import React, { useState } from 'react';
import { X, Check, Crown, Zap, Star, ArrowRight, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import type { UserProfile } from '../types/subscription';
import Tooltip from './Tooltip';
import LoadingSpinner from './LoadingSpinner';
import type { SoundType } from '../hooks/useSoundEffects';
import { TIER_CONFIGS } from '../types/subscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile | null;
  onUpgrade?: (tier: string) => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ 
  isOpen, 
  onClose, 
  currentProfile,
  onUpgrade,
  onSoundPlay
}) => {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'select-plan' | 'payment-details' | 'confirmation'>('select-plan');
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvc: '',
    promoCode: ''
  });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectTier = (tier: string) => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    setError(null);
    setSelectedTier(tier);
  };

  const handleProceedToPayment = () => {
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    if (!selectedTier) {
      setError('Please select a plan to continue');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      return;
    }
    
    setPaymentStep('payment-details');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation
    if (!paymentDetails.cardNumber.trim() || 
        !paymentDetails.cardName.trim() || 
        !paymentDetails.expiry.trim() || 
        !paymentDetails.cvc.trim()) {
      setError('Please fill in all required payment fields');
      if (onSoundPlay) {
        onSoundPlay('error');
      }
      return;
    }

    // Simulate payment processing
    setIsProcessing(true);
    
    setTimeout(() => {
      setIsProcessing(false);
      
      // Simulate successful payment
      setPaymentStep('confirmation');
      
      // Play success sound
      if (onSoundPlay) {
        onSoundPlay('success');
      }
      
      // Call the onUpgrade callback
      if (onUpgrade) {
        onUpgrade(selectedTier!);
      }
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Format card number with spaces
    if (name === 'cardNumber') {
      const formatted = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
      setPaymentDetails(prev => ({ ...prev, [name]: formatted }));
      return;
    }
    
    // Format expiry date
    if (name === 'expiry') {
      const cleaned = value.replace(/\D/g, '');
      let formatted = cleaned;
      
      if (cleaned.length > 2) {
        formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
      }
      
      setPaymentDetails(prev => ({ ...prev, [name]: formatted }));
      return;
    }
    
    setPaymentDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_close');
    }
    onClose();
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free':
        return <Star className="w-6 h-6" />;
      case 'pro':
        return <Zap className="w-6 h-6" />;
      case 'pro_max':
        return <Crown className="w-6 h-6" />;
      default:
        return <Star className="w-6 h-6" />;
    }
  };

  const getTierClasses = (tier: string, isCurrentTier: boolean) => {
    const baseClasses = 'relative p-6 rounded-xl border-2 transition-all duration-200';
    
    if (isCurrentTier) {
      return `${baseClasses} border-gray-400 bg-gray-100`;
    }
    
    if (selectedTier === tier) {
      return `${baseClasses} border-blue-400 bg-blue-50 shadow-lg transform scale-105`;
    }
    
    switch (tier) {
      case 'pro':
        return `${baseClasses} border-blue-200 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-lg transform hover:scale-105`;
      case 'pro_max':
        return `${baseClasses} border-purple-200 hover:border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-lg transform hover:scale-105`;
      default:
        return `${baseClasses} border-gray-200 hover:border-gray-300 bg-white hover:shadow-lg transform hover:scale-105`;
    }
  };

  const getButtonClasses = (tier: string, isCurrentTier: boolean) => {
    if (isCurrentTier) {
      return 'w-full px-4 py-3 bg-gray-300 text-gray-600 rounded-lg font-medium cursor-not-allowed';
    }
    
    if (selectedTier === tier) {
      return 'w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 transform hover:scale-105';
    }
    
    switch (tier) {
      case 'pro':
        return 'w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 transform hover:scale-105';
      case 'pro_max':
        return 'w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 transform hover:scale-105';
      default:
        return 'w-full px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 transform hover:scale-105';
    }
  };

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

  const getSavingsText = (tier: string) => {
    const tierConfig = TIER_CONFIGS[tier];
    if (!tierConfig || tier === 'free' || !tierConfig.yearlyPrice) return null;

    // Calculate savings
    const monthlyPrice = tierConfig.price;
    const yearlyPrice = tierConfig.yearlyPrice;
    
    // Extract numbers from strings like "R149/month" and "R999/year"
    const monthlyNum = parseInt(monthlyPrice.replace(/[^\d]/g, ''));
    const yearlyNum = parseInt(yearlyPrice.replace(/[^\d]/g, ''));
    
    const yearlyTotal = monthlyNum * 12;
    const savings = yearlyTotal - yearlyNum;
    
    if (savings > 0) {
      return `Save R${savings}/year`;
    }
    
    return null;
  };

  const renderPlanSelectionStep = () => (
    <>
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
          <p className="text-gray-600 mt-1">Upgrade to unlock more emotional wellness features</p>
        </div>
        <Tooltip content="Close" position="left">
          <button
            onClick={handleClose}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      <div className="p-6">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedBilling('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedBilling === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedBilling('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedBilling === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Save
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(TIER_CONFIGS).map(([tierKey, tierInfo]) => {
            const isCurrentTier = currentProfile?.tier === tierKey;
            const isPopular = tierInfo.popular;
            const isSelected = selectedTier === tierKey;
            const savingsText = getSavingsText(tierKey);
            
            return (
              <div 
                key={tierKey} 
                className={getTierClasses(tierKey, isCurrentTier)}
                onClick={() => !isCurrentTier && handleSelectTier(tierKey)}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentTier && (
                  <div className="absolute -top-3 right-4">
                    <div className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </div>
                  </div>
                )}

                {/* Selected Indicator */}
                {isSelected && !isCurrentTier && (
                  <div className="absolute -top-3 right-4">
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Selected
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${
                    tierKey === 'free' ? 'bg-gray-200 text-gray-600' :
                    tierKey === 'pro' ? 'bg-blue-200 text-blue-600' :
                    'bg-purple-200 text-purple-600'
                  }`}>
                    {getTierIcon(tierKey)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{tierInfo.displayName}</h3>
                  <p className="text-gray-600 text-sm mb-4">{tierInfo.description}</p>
                  <div className="text-3xl font-bold text-gray-900">{getPriceDisplay(tierKey)}</div>
                  {savingsText && (
                    <div className="text-sm text-green-600 font-medium mt-1">{savingsText}</div>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-6">
                  {tierInfo.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCurrentTier) handleSelectTier(tierKey);
                  }}
                  disabled={isCurrentTier}
                  className={getButtonClasses(tierKey, isCurrentTier)}
                >
                  {isCurrentTier ? (
                    'Current Plan'
                  ) : (
                    <>
                      <span>{isSelected ? 'Selected' : 'Select Plan'}</span>
                      {!isSelected && <ArrowRight className="w-4 h-4" />}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleProceedToPayment}
            disabled={!selectedTier || (currentProfile?.tier === selectedTier)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Continue to Payment
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-gray-900">Need help choosing?</h4>
            <p className="text-gray-600 text-sm">
              All plans include secure authentication, emotional wellness tracking, and 24/7 support.
              You can upgrade or downgrade at any time.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Secure payments</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Instant activation</span>
              </div>
            </div>
            
            {/* Refund Policy Notice */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">7-Day Money-Back Guarantee</p>
                  <p className="text-xs">Not satisfied? Get a full refund within 7 days of your first payment. No questions asked.</p>
                  <button 
                    onClick={() => {
                      // TODO: Add state to show refund policy modal
                      console.log('Show refund policy modal');
                    }}
                    className="text-blue-600 hover:text-blue-800 underline text-xs mt-1"
                  >
                    View full refund policy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
          <p className="text-gray-600 mt-1">Complete your subscription upgrade</p>
        </div>
        <Tooltip content="Close" position="left">
          <button
            onClick={handleClose}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      <div className="p-6">
        <form onSubmit={handlePaymentSubmit} className="space-y-6">
          {/* Selected Plan Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${
                selectedTier === 'pro' ? 'bg-blue-200 text-blue-600' :
                selectedTier === 'pro_max' ? 'bg-purple-200 text-purple-600' :
                'bg-gray-200 text-gray-600'
              }`}>
                {selectedTier && getTierIcon(selectedTier)}
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {selectedTier && TIER_CONFIGS[selectedTier].displayName} Plan
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {selectedTier && TIER_CONFIGS[selectedTier].description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {selectedTier && getPriceDisplay(selectedTier)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSoundPlay) {
                        onSoundPlay('click');
                      }
                      setPaymentStep('select-plan');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Change plan
                  </button>
                </div>
                {selectedTier && getSavingsText(selectedTier) && (
                  <div className="text-sm text-green-600 font-medium mt-1">
                    {getSavingsText(selectedTier)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Card Number
              </label>
              <input
                type="text"
                name="cardNumber"
                value={paymentDetails.cardNumber}
                onChange={handleInputChange}
                placeholder="1234 5678 9012 3456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={19}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date
                </label>
                <input
                  type="text"
                  name="expiry"
                  value={paymentDetails.expiry}
                  onChange={handleInputChange}
                  placeholder="MM/YY"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={5}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CVC
                </label>
                <input
                  type="text"
                  name="cvc"
                  value={paymentDetails.cvc}
                  onChange={handleInputChange}
                  placeholder="123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={4}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cardholder Name
              </label>
              <input
                type="text"
                name="cardName"
                value={paymentDetails.cardName}
                onChange={handleInputChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              Promo Code (Optional)
            </label>
            <input
              type="text"
              name="promoCode"
              value={paymentDetails.promoCode}
              onChange={handleInputChange}
              placeholder="Enter promo code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                <LoadingSpinner size="sm" />
                Processing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                Complete Payment
                </>
              )}
            </button>
        </form>
      </div>
    </>
  );

  const renderConfirmationStep = () => {
    const tierConfig = selectedTier ? TIER_CONFIGS[selectedTier] : null;
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    return (
    <>
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
            <p className="text-gray-600 mt-1">Welcome to your new plan</p>
        </div>
        <Tooltip content="Close" position="left">
          <button
            onClick={handleClose}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Welcome to {tierConfig?.displayName}!
            </h3>
            <p className="text-gray-600">
              Your subscription has been activated successfully. You now have access to all {tierConfig?.displayName} features.
            </p>
          </div>
          
          {/* Subscription Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h4 className="font-semibold text-gray-900 mb-4">Subscription Details</h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Plan</span>
                <span className="font-medium text-gray-900">{tierConfig?.displayName}</span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Price</span>
                <span className="font-medium text-gray-900">{getPriceDisplay(selectedTier!)}</span>
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
              {tierConfig?.features.map((feature, index) => (
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
            onClick={handleClose}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
              Start Using Atlas
            </button>
            
            <button
              onClick={() => {
                // Handle account settings or billing portal
                handleClose();
              }}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Manage Subscription
          </button>
        </div>
      </div>
    </>
  );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {paymentStep === 'select-plan' && renderPlanSelectionStep()}
        {paymentStep === 'payment-details' && renderPaymentStep()}
        {paymentStep === 'confirmation' && renderConfirmationStep()}
      </div>
    </div>
  );
};

export default UpgradeModal;