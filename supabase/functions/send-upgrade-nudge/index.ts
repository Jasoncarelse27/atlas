// supabase/functions/send-upgrade-nudge/index.ts
// Atlas AI Upgrade Nudge Email Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const mailerliteApiKey = Deno.env.get('MAILERLITE_API_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

export const POST = async (req: Request): Promise<Response> => {
  try {
    const { email, name, usage_count, usage_limit } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: email' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Send upgrade nudge via MailerLite
    const mailerliteResponse = await fetch('https://connect.mailerlite.com/api/automations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailerliteApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger: 'manual',
        flow_id: 'atlas-upgrade-nudge-flow',
        subscriber: { 
          email,
          ...(name && { name }),
          custom_fields: {
            usage_count: usage_count || 0,
            usage_limit: usage_limit || 10
          }
        },
      }),
    });

    if (!mailerliteResponse.ok) {
      const errorData = await mailerliteResponse.text();
      console.error('MailerLite error:', errorData);
      return new Response(JSON.stringify({ 
        error: 'Failed to send upgrade nudge',
        details: errorData
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const mailerliteData = await mailerliteResponse.json();

    // Log email sent
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        flow_type: 'upgrade_nudge',
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
      message: 'Upgrade nudge sent successfully',
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
