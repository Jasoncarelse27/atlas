import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// MailerLite configuration
const MAILERLITE_API_KEY = import.meta.env.VITE_MAILERLITE_API_KEY;
const MAILERLITE_BASE = 'https://connect.mailerlite.com/api';

const mailerLite = axios.create({
  baseURL: MAILERLITE_BASE,
  headers: {
    Authorization: `Bearer ${MAILERLITE_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Email templates and flow IDs
const EMAIL_CONFIG = {
  templates: {
    welcome: 'atlas-welcome-template',
    upgradeNudge: 'atlas-upgrade-nudge-template',
    inactivityReminder: 'atlas-inactivity-reminder-template',
    weeklySummary: 'atlas-weekly-summary-template',
  },
  flows: {
    upgradeNudge: 'atlas-upgrade-nudge-flow',
    inactivityReminder: 'atlas-inactivity-reminder-flow',
  },
  sender: {
    from: 'support@atlas.app',
    replyTo: 'support@atlas.app',
  }
};

export interface EmailRecipient {
  email: string;
  name?: string;
  userId?: string;
}

export interface WeeklySummaryData {
  messageCount: number;
  conversationCount: number;
  topTopics: string[];
  insights: string[];
  usageStats: {
    totalMessages: number;
    averageResponseTime: number;
    favoriteModel: string;
  };
}

export const mailerService = {
  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(recipient: EmailRecipient): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Validate email
      if (!recipient.email || !recipient.email.trim()) {
        return { 
          success: false, 
          error: 'Email address is required' 
        };
      }

      const response = await mailerLite.post('/campaigns', {
        subject: 'Welcome to Atlas AI 🌱',
        name: 'Atlas Welcome Flow',
        type: 'regular',
        recipients: { 
          emails: [recipient.email],
          ...(recipient.name && { names: [recipient.name] })
        },
        settings: {
          from: EMAIL_CONFIG.sender.from,
          reply_to: EMAIL_CONFIG.sender.replyTo,
          language: 'EN',
          template_id: EMAIL_CONFIG.templates.welcome,
        },
        content: {
          html: this.generateWelcomeEmailHTML(recipient),
          text: this.generateWelcomeEmailText(recipient),
        },
      });

      // Log email sent to Supabase
      await this.logEmailSent('welcome', recipient, response.data.id);

      return { 
        success: true, 
        messageId: response.data.id 
      };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Send upgrade nudge when usage cap is reached
   */
  async sendUpgradeNudge(recipient: EmailRecipient, usageStats?: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await mailerLite.post('/automations', {
        trigger: 'manual',
        flow_id: EMAIL_CONFIG.flows.upgradeNudge,
        subscriber: { 
          email: recipient.email,
          ...(recipient.name && { name: recipient.name }),
          ...(usageStats && { custom_fields: usageStats })
        },
      });

      // Log email sent to Supabase
      await this.logEmailSent('upgrade_nudge', recipient, response.data.id);

      return { 
        success: true, 
        messageId: response.data.id 
      };
    } catch (error) {
      console.error('Failed to send upgrade nudge:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Send inactivity reminder after 7 days of no activity
   */
  async sendInactivityReminder(recipient: EmailRecipient, lastActivityDate?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await mailerLite.post('/automations', {
        trigger: 'manual',
        flow_id: EMAIL_CONFIG.flows.inactivityReminder,
        subscriber: { 
          email: recipient.email,
          ...(recipient.name && { name: recipient.name }),
          ...(lastActivityDate && { custom_fields: { last_activity: lastActivityDate } })
        },
      });

      // Log email sent to Supabase
      await this.logEmailSent('inactivity_reminder', recipient, response.data.id);

      return { 
        success: true, 
        messageId: response.data.id 
      };
    } catch (error) {
      console.error('Failed to send inactivity reminder:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Send weekly summary with user insights
   */
  async sendWeeklySummary(recipient: EmailRecipient, summaryData: WeeklySummaryData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await mailerLite.post('/campaigns', {
        subject: 'Your Atlas Weekly Insight ✨',
        name: 'Weekly Summary',
        type: 'regular',
        recipients: { 
          emails: [recipient.email],
          ...(recipient.name && { names: [recipient.name] })
        },
        settings: {
          from: EMAIL_CONFIG.sender.from,
          reply_to: EMAIL_CONFIG.sender.replyTo,
          language: 'EN',
          template_id: EMAIL_CONFIG.templates.weeklySummary,
        },
        content: {
          html: this.generateWeeklySummaryHTML(recipient, summaryData),
          text: this.generateWeeklySummaryText(recipient, summaryData),
        },
      });

      // Log email sent to Supabase
      await this.logEmailSent('weekly_summary', recipient, response.data.id);

      return { 
        success: true, 
        messageId: response.data.id 
      };
    } catch (error) {
      console.error('Failed to send weekly summary:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Test email functionality
   */
  async testEmailFlow(recipient: EmailRecipient, flowType: 'welcome' | 'upgrade_nudge' | 'inactivity_reminder' | 'weekly_summary'): Promise<{ success: boolean; error?: string }> {
    try {
      switch (flowType) {
        case 'welcome':
          return await this.sendWelcomeEmail(recipient);
        case 'upgrade_nudge':
          return await this.sendUpgradeNudge(recipient);
        case 'inactivity_reminder':
          return await this.sendInactivityReminder(recipient);
        case 'weekly_summary':
          return await this.sendWeeklySummary(recipient, {
            messageCount: 25,
            conversationCount: 5,
            topTopics: ['AI Development', 'React', 'TypeScript'],
            insights: ['You\'re in the top 10% of active users!', 'Your favorite model is Claude'],
            usageStats: {
              totalMessages: 150,
              averageResponseTime: 2.3,
              favoriteModel: 'Claude'
            }
          });
        default:
          return { success: false, error: 'Invalid flow type' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  /**
   * Log email sent to Supabase for tracking
   */
  async logEmailSent(flowType: string, recipient: EmailRecipient, messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_logs')
        .insert({
          flow_type: flowType,
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          recipient_user_id: recipient.userId,
          message_id: messageId,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });

      if (error) {
        console.error('Failed to log email:', error);
      }
    } catch (error) {
      console.error('Failed to log email to Supabase:', error);
    }
  },

  /**
   * Generate welcome email HTML content
   */
  generateWelcomeEmailHTML(recipient: EmailRecipient): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Atlas AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { margin: 20px 0; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌱 Welcome to Atlas AI!</h1>
            <p>Your intelligent conversation companion is ready</p>
          </div>
          <div class="content">
            <h2>Hi${recipient.name ? ` ${recipient.name}` : ''}!</h2>
            <p>Welcome to Atlas AI! We're excited to have you join our community of intelligent conversation enthusiasts.</p>
            
            <div class="feature">
              <h3>🚀 What you can do with Atlas:</h3>
              <ul>
                <li>Chat with multiple AI models (Claude, Groq, Opus)</li>
                <li>Voice input and real-time transcription</li>
                <li>Image analysis and processing</li>
                <li>Offline-first message persistence</li>
                <li>Real-time insights and analytics</li>
              </ul>
            </div>

            <div class="feature">
              <h3>🎯 Get Started:</h3>
              <p>1. Try asking Atlas about your favorite topics</p>
              <p>2. Explore voice input for hands-free conversations</p>
              <p>3. Upload images for AI analysis</p>
              <p>4. Check out your conversation insights</p>
            </div>

            <a href="https://atlas.app/dashboard" class="button">Start Your First Conversation</a>
            
            <p>Need help? Reply to this email or visit our <a href="https://atlas.app/support">support center</a>.</p>
            
            <p>Happy chatting!<br>The Atlas AI Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generate welcome email text content
   */
  generateWelcomeEmailText(recipient: EmailRecipient): string {
    return `
Welcome to Atlas AI!

Hi${recipient.name ? ` ${recipient.name}` : ''}!

Welcome to Atlas AI! We're excited to have you join our community of intelligent conversation enthusiasts.

What you can do with Atlas:
- Chat with multiple AI models (Claude, Groq, Opus)
- Voice input and real-time transcription
- Image analysis and processing
- Offline-first message persistence
- Real-time insights and analytics

Get Started:
1. Try asking Atlas about your favorite topics
2. Explore voice input for hands-free conversations
3. Upload images for AI analysis
4. Check out your conversation insights

Start your first conversation: https://atlas.app/dashboard

Need help? Reply to this email or visit our support center: https://atlas.app/support

Happy chatting!
The Atlas AI Team
    `;
  },

  /**
   * Generate weekly summary HTML content
   */
  generateWeeklySummaryHTML(recipient: EmailRecipient, data: WeeklySummaryData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Atlas Weekly Insight</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .stat { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; text-align: center; }
          .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
          .insight { background: #e8f4fd; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          .topic { display: inline-block; background: #667eea; color: white; padding: 5px 10px; margin: 5px; border-radius: 15px; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Your Atlas Weekly Insight</h1>
            <p>Here's what you accomplished this week</p>
          </div>
          <div class="content">
            <h2>Hi${recipient.name ? ` ${recipient.name}` : ''}!</h2>
            
            <div class="stat">
              <div class="stat-number">${data.messageCount}</div>
              <div>Messages Sent</div>
            </div>
            
            <div class="stat">
              <div class="stat-number">${data.conversationCount}</div>
              <div>Conversations</div>
            </div>

            <h3>🎯 Your Top Topics This Week:</h3>
            <div>
              ${(data?.topTopics || ['General Topics']).map(topic => `<span class="topic">${topic}</span>`).join('')}
            </div>

            <h3>💡 Insights:</h3>
            ${(data?.insights || ['Keep up the great conversations!']).map(insight => `<div class="insight">${insight}</div>`).join('')}

            <h3>📊 Usage Stats:</h3>
            <ul>
              <li>Total Messages: ${data?.usageStats?.totalMessages || 0}</li>
              <li>Average Response Time: ${data?.usageStats?.averageResponseTime || 0}s</li>
              <li>Favorite Model: ${data?.usageStats?.favoriteModel || 'Claude'}</li>
            </ul>

            <p>Keep up the great conversations! 🚀</p>
            <p>The Atlas AI Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Generate weekly summary text content
   */
  generateWeeklySummaryText(recipient: EmailRecipient, data: WeeklySummaryData): string {
    return `
Your Atlas Weekly Insight

Hi${recipient.name ? ` ${recipient.name}` : ''}!

Here's what you accomplished this week:

📊 Stats:
- Messages Sent: ${data?.messageCount || 0}
- Conversations: ${data?.conversationCount || 0}
- Total Messages: ${data?.usageStats?.totalMessages || 0}
- Average Response Time: ${data?.usageStats?.averageResponseTime || 0}s
- Favorite Model: ${data?.usageStats?.favoriteModel || 'Claude'}

🎯 Your Top Topics This Week:
${(data?.topTopics || ['General Topics']).map(topic => `- ${topic}`).join('\n')}

💡 Insights:
${(data?.insights || ['Keep up the great conversations!']).map(insight => `- ${insight}`).join('\n')}

Keep up the great conversations! 🚀

The Atlas AI Team
    `;
  }
};

export default mailerService;