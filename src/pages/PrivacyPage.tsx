import { ArrowLeft } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4E8E1] to-[#CEC1B8] dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/login" 
            className="inline-flex items-center text-[#8B7E74] dark:text-gray-400 dark:text-gray-400 hover:text-[#5A524A] dark:text-gray-200 dark:hover:text-gray-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Link>
          <h1 className="text-4xl font-bold text-[#3B3632] dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-[#8B7E74] dark:text-gray-400 dark:text-gray-400">Last Updated: December 8, 2025</p>
        </div>

        {/* Content */}
        <div className="bg-[#F9F6F3] dark:bg-gray-900 rounded-2xl shadow-lg p-8 space-y-6 text-[#3B3632] dark:text-white">
          
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">1. Introduction</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              Otium Creations ("we," "our," or "us") operates Atlas, an AI-powered emotional intelligence assistant. 
              We are committed to protecting your privacy and ensuring the security of your personal information. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 text-[#5A524A] dark:text-gray-200 mt-4">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Email address, password (encrypted), and subscription tier</li>
              <li><strong>Conversation Data:</strong> Messages, conversations, and interactions with Atlas</li>
              <li><strong>Habit Tracking:</strong> Personal habits, goals, and progress data</li>
              <li><strong>Payment Information:</strong> Processed securely through FastSpring (we do not store payment details)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 text-[#5A524A] dark:text-gray-200 mt-4">2.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Usage Data:</strong> Feature usage, message counts, and interaction patterns</li>
              <li><strong>Device Information:</strong> Device type, browser type, and operating system</li>
              <li><strong>Technical Data:</strong> IP address, timestamps, and error logs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">3. How We Use Your Information</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your transactions and manage your subscription</li>
              <li>Send you service-related communications</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Enforce our Terms of Service and prevent fraud</li>
              <li>Analyze usage patterns to improve user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">4. Data Storage and Security</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mb-3">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Encryption:</strong> All data is encrypted in transit (HTTPS) and at rest</li>
              <li><strong>Authentication:</strong> Secure authentication through Supabase Auth</li>
              <li><strong>Access Controls:</strong> Row-level security policies prevent unauthorized access</li>
              <li><strong>Regular Backups:</strong> Data is backed up daily and stored securely</li>
            </ul>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mt-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. 
              While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">5. Data Sharing and Disclosure</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> With trusted third-party services (Supabase, FastSpring, Railway) necessary to operate the Service</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with notice to users)</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">6. Data Retention</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              We retain your personal information for as long as necessary to provide the Service and fulfill the purposes 
              outlined in this Privacy Policy. Conversation history is stored for 30 days for active users. 
              You may request deletion of your data at any time by contacting support@atlas.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">7. Your Rights and Choices</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mb-3">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-[#6B6560] dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed mt-4">
              To exercise these rights, contact us at support@atlas.com. We will respond to your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">8. Children's Privacy</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              Atlas is not intended for users under the age of 13. We do not knowingly collect personal information from 
              children under 13. If you believe we have collected information from a child under 13, please contact us 
              immediately at support@atlas.com, and we will delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">9. International Data Transfers</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. 
              These countries may have data protection laws that differ from those in your country. By using the Service, 
              you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">10. Changes to This Privacy Policy</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting 
              the new Privacy Policy on this page and updating the "Last Updated" date. Your continued use of the Service 
              after such modifications constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-[#5A524A] dark:text-gray-200">11. Contact Us</h2>
            <p className="text-[#6B6560] dark:text-gray-300 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
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
            Your privacy is important to us. We are committed to protecting your personal information and being transparent 
            about how we collect, use, and share it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;

