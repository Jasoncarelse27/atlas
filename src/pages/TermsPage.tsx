import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4E8E1] to-[#CEC1B8] dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/login" 
            className="inline-flex items-center text-[#8B7E74] dark:text-gray-400 hover:text-[#5A524A] dark:text-gray-200 dark:hover:text-gray-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Link>
          <h1 className="text-4xl font-bold text-[#3B3632] dark:text-white mb-2">Terms of Service</h1>
          <p className="text-[#8B7E74] dark:text-gray-400">Last Updated: December 8, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-[#F9F6F3] dark:bg-gray-900 rounded-2xl shadow-lg p-8 space-y-6 text-[#3B3632] dark:text-white">
          
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200 dark:text-gray-200">1. Acceptance of Terms</h2>
            <p className="text-[#6B6560] dark:text-gray-300 dark:text-gray-300 leading-relaxed">
              By accessing and using Atlas ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. 
              If you do not agree to these Terms of Service, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200 dark:text-gray-200">2. Description of Service</h2>
            <p className="text-[#6B6560] dark:text-gray-300 dark:text-gray-300 leading-relaxed mb-3">
              Atlas is an AI-powered emotional intelligence assistant designed to help users improve their emotional well-being through:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 dark:text-gray-300 space-y-2 ml-4">
              <li>Conversational AI support for emotional intelligence coaching</li>
              <li>Habit tracking and personal development tools</li>
              <li>Daily emotional intelligence challenges</li>
              <li>Voice and text-based interactions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200 dark:text-gray-200">3. User Accounts</h2>
            <p className="text-[#6B6560] dark:text-gray-300 dark:text-gray-300 leading-relaxed mb-3">
              To use certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 dark:text-gray-300 space-y-2 ml-4">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and update your information as necessary</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200 dark:text-gray-200">4. Subscription Tiers and Payment</h2>
            <p className="text-[#6B6560] dark:text-gray-300 dark:text-gray-300 leading-relaxed mb-3">
              Atlas offers three subscription tiers:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Free:</strong> Limited features, 15 messages per month</li>
              <li><strong>Core:</strong> $19.99/month - Unlimited messages, advanced features</li>
              <li><strong>Studio:</strong> $149.99/month - Premium features, priority support</li>
            </ul>
            <p className="text-[#6B6560] dark:text-gray-300 dark:text-gray-300 leading-relaxed mt-4">
              Subscriptions are billed monthly or annually. You may cancel your subscription at any time. 
              Cancellation will take effect at the end of your current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">5. Refund Policy</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              We offer a <strong>7-day money-back guarantee</strong> on all paid subscriptions. If you are not satisfied 
              with Atlas within 7 days of your first payment, contact us at support@atlas.com for a full refund. 
              Refunds are processed within 3-5 business days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">6. Acceptable Use & Content Moderation</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mb-3">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
            </ul>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mt-4 mb-3">
              <strong>Content Moderation:</strong> Atlas uses automated content moderation systems to ensure a safe environment. 
              Inappropriate content, including but not limited to sexual content, hate speech, harassment, violence, or self-harm 
              content, may be automatically blocked. Users can report inappropriate content through the reporting mechanism. 
              All moderation decisions are logged for audit purposes and reviewed regularly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">7. Intellectual Property</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              The Service and its original content, features, and functionality are owned by Otium Creations and are 
              protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">8. Disclaimer of Warranties</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. 
              Atlas is not a replacement for professional medical advice, diagnosis, or treatment. Always seek the advice 
              of qualified health providers with any questions regarding mental health conditions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">9. Limitation of Liability</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              In no event shall Otium Creations be liable for any indirect, incidental, special, consequential, or punitive 
              damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, 
              resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">10. Changes to Terms</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. We will notify users of any material 
              changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of 
              the Service after such modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">11. Contact Information</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-[#6B6560] dark:text-gray-300 mt-2">
              <strong>Email:</strong> support@atlas.com<br />
              <strong>Company:</strong> Otium Creations
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[#8B7E74] dark:text-gray-400 text-sm">
          <p>
            By using Atlas, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;

