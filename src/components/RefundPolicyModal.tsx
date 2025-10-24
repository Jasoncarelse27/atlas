import React from 'react';
import { X, Clock, Mail, CheckCircle } from 'lucide-react';
import { REFUND_POLICY } from '../types/subscription';
import Tooltip from './Tooltip';

interface RefundPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSoundPlay?: (sound: string) => void;
}

const RefundPolicyModal: React.FC<RefundPolicyModalProps> = ({
  isOpen,
  onClose,
  onSoundPlay
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onSoundPlay) {
      onSoundPlay('modal_close');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Refund Policy</h2>
            <p className="text-gray-600 mt-1">Your satisfaction is our priority</p>
          </div>
          <Tooltip content="Close" position="left">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </Tooltip>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Guarantee Badge */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-800">
                  {REFUND_POLICY.eligible_days}-Day Money-Back Guarantee
                </h3>
                <p className="text-green-700 text-sm">
                  Not satisfied? Get a full refund within {REFUND_POLICY.eligible_days} days of your first payment.
                </p>
              </div>
            </div>
          </div>

          {/* Policy Details */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900">How It Works</h4>
            
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-atlas-sage text-sm font-semibold">1</span>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Request Refund</h5>
                  <p className="text-gray-600 text-sm">
                    Contact us at {REFUND_POLICY.contact_method} within {REFUND_POLICY.eligible_days} days of your first payment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-atlas-sage text-sm font-semibold">2</span>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">No Questions Asked</h5>
                  <p className="text-gray-600 text-sm">
                    We believe in our service. If it's not right for you, we'll process your refund without hassle.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-atlas-sage text-sm font-semibold">3</span>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Quick Processing</h5>
                  <p className="text-gray-600 text-sm">
                    Refunds are processed within {REFUND_POLICY.process_time} and appear in your account shortly after.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-900">Refund Conditions</h4>
            <div className="space-y-2">
              {REFUND_POLICY.conditions.map((condition, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{condition}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-600" />
              <div>
                <h5 className="font-medium text-gray-900">Need a Refund?</h5>
                <p className="text-gray-600 text-sm">
                  Email us at <a href={`mailto:${REFUND_POLICY.contact_method}`} className="text-atlas-sage hover:underline">{REFUND_POLICY.contact_method}</a>
                </p>
              </div>
            </div>
          </div>

          {/* Processing Time */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-atlas-sage" />
              <div>
                <h5 className="font-medium text-blue-900">Processing Time</h5>
                <p className="text-blue-700 text-sm">
                  Refunds are processed within {REFUND_POLICY.process_time}. You'll receive a confirmation email once processed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="w-full px-6 py-3 bg-atlas-sage hover:bg-atlas-success text-white rounded-lg font-medium transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyModal; 