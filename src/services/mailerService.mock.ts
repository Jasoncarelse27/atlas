import { logEmailFailure } from "./emailFailureLogger";

// Mock MailerLite service for tests
export const mailerService = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    // Simulate failure if SIMULATE_FAILURE=true
    if (process.env.SIMULATE_FAILURE === "true") {
      const errorMessage = `Mock failure: ${templateId} to ${to}`;
      console.log(`[MOCK][FAILED] Would have sent ${templateId} to ${to}`, data);
      
      // Log mock failure to Supabase for testing
      await logEmailFailure(to, templateId, errorMessage);
      
      throw new Error(errorMessage);
    }
    
    console.log(`[MOCK] Email sent to ${to} with template ${templateId}`, data);
    return { success: true, mock: true };
  },

  // Optional: Simulate failure for testing error handling
  sendEmailWithFailure: async (to: string, templateId: string, data: any) => {
    const errorMessage = `Mock failure: ${templateId} to ${to}`;
    console.log(`[MOCK][FAILED] Would have sent ${templateId} to ${to}`, data);
    
    // Log mock failure to Supabase for testing
    await logEmailFailure(to, templateId, errorMessage);
    
    throw new Error(errorMessage);
  }
};