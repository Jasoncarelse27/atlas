// supabase/functions/send-welcome/index.ts
// Atlas AI Welcome Email Edge Function
// Handles welcome email sending for new user registrations

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const mailerliteApiKey = Deno.env.get('MAILERLITE_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

export const POST = async (req: Request): Promise<Response> => {
  try {
    // Check Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        error: 'Missing or invalid authorization header' 
      }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validate JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JWT token' 
      }), { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const { email, name } = await req.json()

    // Basic validation
    if (!email) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: email' 
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      })
    }

    // Send welcome email via MailerLite
    const mailerliteResponse = await fetch('https://connect.mailerlite.com/api/campaigns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailerliteApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Welcome to Atlas AI 🌱',
        name: 'Atlas Welcome Flow',
        type: 'regular',
        recipients: { 
          emails: [email],
          ...(name && { names: [name] })
        },
        settings: {
          from: 'support@atlas.app',
          reply_to: 'support@atlas.app',
          language: 'EN',
        },
        content: {
          html: generateWelcomeEmailHTML(name),
          text: generateWelcomeEmailText(name),
        },
      }),
    });

    if (!mailerliteResponse.ok) {
      const errorData = await mailerliteResponse.text();
      console.error('MailerLite error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Failed to send welcome email',
        details: errorData
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        }
      });
    }

    const mailerliteData = await mailerliteResponse.json();

    // Log email sent to Supabase
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        flow_type: 'welcome',
        recipient_email: email,
        recipient_name: name,
        recipient_user_id: user.id,
        message_id: mailerliteData.id,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Welcome email sent successfully',
      messageId: mailerliteData.id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    })
  } catch (e) {
    console.error('Server error:', e)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: e instanceof Error ? e.message : 'Unknown error'
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    })
  }
}

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  })
}

// Health check endpoint
export const GET = async () => {
  return new Response(JSON.stringify({ 
    status: 'healthy',
    function: 'send-welcome',
    timestamp: new Date().toISOString(),
    features: ['welcome_email', 'mailerlite_integration', 'email_logging']
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

// Email template functions
function generateWelcomeEmailHTML(name?: string): string {
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
          <h2>Hi${name ? ` ${name}` : ''}!</h2>
          <p>Welcome to Atlas AI! We're excited to have you join our community of intelligent conversation enthusiasts.</p>
          
          <div class="feature">
            <h3>🚀 What you can do with Atlas:</h3>
            <ul>
              <li>Chat with multiple AI models (Claude Sonnet, Claude Opus)</li>
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
}

function generateWelcomeEmailText(name?: string): string {
  return `
Welcome to Atlas AI!

Hi${name ? ` ${name}` : ''}!

Welcome to Atlas AI! We're excited to have you join our community of intelligent conversation enthusiasts.

What you can do with Atlas:
- Chat with multiple AI models (Claude Sonnet, Claude Opus)
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
}
