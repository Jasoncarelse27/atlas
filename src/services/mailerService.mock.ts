// Mock MailerLite service for tests
export const mailerService = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    console.log(`[MOCK] Email sent to ${to} with template ${templateId}`, data);
    return { success: true, mock: true };
  },

  // Optional: Simulate failure for testing error handling
  sendEmailWithFailure: async (to: string, templateId: string, data: any) => {
    console.log(`[MOCK][FAILED] Would have sent ${templateId} to ${to}`, data);
    throw new Error(`Mock failure: ${templateId} to ${to}`);
  }
};