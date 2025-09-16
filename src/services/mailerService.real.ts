import fetch from "node-fetch";

const API_URL = "https://api.mailerlite.com/api/v2";

export const mailerService = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    if (!process.env.MAILERLITE_API_KEY) {
      throw new Error("Missing MAILERLITE_API_KEY");
    }

    const response = await fetch(`${API_URL}/email/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
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
  },
};