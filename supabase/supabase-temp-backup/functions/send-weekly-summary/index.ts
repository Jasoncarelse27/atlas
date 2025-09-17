// supabase/functions/send-weekly-summary/index.ts
// Atlas AI Weekly Summary Email Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const mailerliteApiKey = Deno.env.get('MAILERLITE_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

export const POST = async (req: Request): Promise<Response> => {
  try {
    const { email, name, summary_data } = await req.json()

    if (!email || !summary_data) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: email, summary_data' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate email content
    const htmlContent = generateWeeklySummaryHTML(name, summary_data);
    const textContent = generateWeeklySummaryText(name, summary_data);

    // Send weekly summary via MailerLite
    const mailerliteResponse = await fetch('https://connect.mailerlite.com/api/campaigns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailerliteApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Your Atlas Weekly Insight ✨',
        name: 'Weekly Summary',
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
          html: htmlContent,
          text: textContent,
        },
      }),
    });

    if (!mailerliteResponse.ok) {
      const errorData = await mailerliteResponse.text();
      console.error('MailerLite error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Failed to send weekly summary',
        details: errorData
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const mailerliteData = await mailerliteResponse.json();

    // Log email sent
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        flow_type: 'weekly_summary',
        recipient_email: email,
        recipient_name: name,
        message_id: mailerliteData.id,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Weekly summary sent successfully',
      messageId: mailerliteData.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('Server error:', e)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: e instanceof Error ? e.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
  })
}

// Email template functions
function generateWeeklySummaryHTML(name?: string, data?: any): string {
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
          <h2>Hi${name ? ` ${name}` : ''}!</h2>
          
          <div class="stat">
            <div class="stat-number">${data?.messageCount || 0}</div>
            <div>Messages Sent</div>
          </div>
          
          <div class="stat">
            <div class="stat-number">${data?.conversationCount || 0}</div>
            <div>Conversations</div>
          </div>

          <h3>🎯 Your Top Topics This Week:</h3>
          <div>
            ${(data?.topTopics || []).map((topic: string) => `<span class="topic">${topic}</span>`).join('')}
          </div>

          <h3>💡 Insights:</h3>
          ${(data?.insights || []).map((insight: string) => `<div class="insight">${insight}</div>`).join('')}

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
}

function generateWeeklySummaryText(name?: string, data?: any): string {
  return `
Your Atlas Weekly Insight

Hi${name ? ` ${name}` : ''}!

Here's what you accomplished this week:

📊 Stats:
- Messages Sent: ${data?.messageCount || 0}
- Conversations: ${data?.conversationCount || 0}
- Total Messages: ${data?.usageStats?.totalMessages || 0}
- Average Response Time: ${data?.usageStats?.averageResponseTime || 0}s
- Favorite Model: ${data?.usageStats?.favoriteModel || 'Claude'}

🎯 Your Top Topics This Week:
${(data?.topTopics || []).map((topic: string) => `- ${topic}`).join('\n')}

💡 Insights:
${(data?.insights || []).map((insight: string) => `- ${insight}`).join('\n')}

Keep up the great conversations! 🚀

The Atlas AI Team
  `;
}
