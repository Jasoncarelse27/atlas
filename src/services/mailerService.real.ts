import fetch from "node-fetch";
import { logEmailFailure } from "./emailFailureLogger";

const API_URL = "https://api.mailerlite.com/api/v2";

// Production safety check on init
if (process.env.NODE_ENV === 'production' && !process.env.MAILERLITE_API_KEY) {
  throw new Error("Missing MAILERLITE_API_KEY in production");
}

// Store validated API key
const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;

export const mailerService = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    if (!MAILERLITE_API_KEY) {
      throw new Error("Missing MAILERLITE_API_KEY");
    }

    try {
      const response = await fetch(`${API_URL}/email/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MAILERLITE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          template_id: templateId,
          data,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MailerLite API error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      // Structured error logging for production debugging
      console.error(`[MailerLite][FAILED] Template: ${templateId}, Recipient: ${to}, Error:`, error);
      
      // Log failure to Supabase for permanent tracking
      await logEmailFailure(to, templateId, error instanceof Error ? error.message : String(error));
      
      throw error;
    }
  },
};