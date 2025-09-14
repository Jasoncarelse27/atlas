// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAILERLITE_API_KEY = Deno.env.get('MAILERLITE_API_KEY')!;
const MAILERLITE_SIGNING_SECRET = Deno.env.get('MAILERLITE_SIGNING_SECRET')!;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// MailerLite configuration
const MAILERLITE_BASE = 'https://connect.mailerlite.com/api';

interface CICDAlertRequest {
  stage: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
  signingSecret?: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { stage, status, details, signingSecret }: CICDAlertRequest = await req.json();

    // Verify signing secret for security
    if (signingSecret !== MAILERLITE_SIGNING_SECRET) {
      console.error('Invalid signing secret provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate required fields
    if (!stage || !status || !details) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: stage, status, details' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate email content
    const subject = `[Atlas Alert] ${stage} - ${status.toUpperCase()}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Atlas CI/CD Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background: ${status === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                        status === 'failure' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
          }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-weight: bold; 
            text-transform: uppercase;
            background: ${status === 'success' ? '#10b981' : 
                        status === 'failure' ? '#ef4444' : '#f59e0b'};
            color: white;
          }
          .details { 
            background: white; 
            padding: 20px; 
            border-radius: 5px; 
            border-left: 4px solid ${status === 'success' ? '#10b981' : 
                                 status === 'failure' ? '#ef4444' : '#f59e0b'};
            margin: 20px 0;
            white-space: pre-wrap;
            font-family: monospace;
          }
          .timestamp { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Atlas CI/CD Alert</h1>
            <p>Automated deployment notification</p>
          </div>
          <div class="content">
            <h2>Stage: ${stage}</h2>
            <p><strong>Status:</strong> <span class="status-badge">${status}</span></p>
            <p class="timestamp">Timestamp: ${new Date().toISOString()}</p>
            
            <h3>Details:</h3>
            <div class="details">${details}</div>
            
            <p>This is an automated alert from the Atlas CI/CD pipeline.</p>
            <p>For more information, check the GitHub Actions logs or contact the development team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using MailerLite API
    const emailResponse = await fetch(`${MAILERLITE_BASE}/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: subject,
        name: `Atlas CI/CD Alert - ${new Date().toISOString()}`,
        type: 'regular',
        recipients: { 
          emails: ['admin@otiumcreations.com']
        },
        settings: {
          from: 'support@atlas.app',
          reply_to: 'support@atlas.app',
          language: 'EN',
        },
        content: {
          html: html,
          text: `Atlas CI/CD Alert\n\nStage: ${stage}\nStatus: ${status.toUpperCase()}\nDetails: ${details}\n\nTimestamp: ${new Date().toISOString()}`,
        },
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Failed to send email:', errorText);
      return new Response(JSON.stringify({ 
        error: `Failed to send email: ${errorText}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailData = await emailResponse.json();

    // Log the alert to Supabase for tracking
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        flow_type: 'cicd_alert',
        recipient_email: 'admin@otiumcreations.com',
        message_id: emailData.id,
        sent_at: new Date().toISOString(),
        status: 'sent',
        metadata: {
          stage,
          status,
          details: details.substring(0, 500) // Truncate for storage
        }
      });

    if (logError) {
      console.error('Failed to log alert:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailData.id,
      stage,
      status 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('CICD Alert Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
