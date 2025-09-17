// Fallback email failure logger for when Supabase is not available
const logEmailFailure = async (recipient: string, template: string, error: string) => {
  console.log(`[MockService] Email failure logged: ${recipient} (${template}) - ${error}`);
};

// Mock MailerLite service for tests
export const mailerService = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    // Simulate validation errors for empty email
    if (!to || to.trim() === '') {
      const errorMessage = 'Email address is required';
      console.log(`[MOCK][FAILED] Empty email address for template ${templateId}`);
      return { success: false, error: errorMessage };
    }

    // Simulate failure if SIMULATE_FAILURE=true
    if (process.env.SIMULATE_FAILURE === "true") {
      const errorMessage = `Mock failure: ${templateId} to ${to}`;
      console.log(`[MOCK][FAILED] Would have sent ${templateId} to ${to}`, data);
      
      // Log mock failure to Supabase for testing
      await logEmailFailure(to, templateId, errorMessage);
      
      return { success: false, error: errorMessage };
    }

    // Simulate network errors when MSW is configured to return errors
    // This is a hack to make the mock service respond to MSW configuration
    try {
      // Try to make a real fetch call that will be intercepted by MSW
      const response = await fetch('https://connect.mailerlite.com/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      if (!response.ok) {
        return { success: false, error: `Network error: ${response.status}` };
      }
    } catch (error) {
      // If MSW is configured to throw errors, catch them here
      return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
    
    console.log(`[MOCK] Email sent to ${to} with template ${templateId}`, data);
    return { 
      success: true, 
      mock: true, 
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      error: undefined
    };
  },

  // Optional: Simulate failure for testing error handling
  sendEmailWithFailure: async (to: string, templateId: string, data: any) => {
    const errorMessage = `Mock failure: ${templateId} to ${to}`;
    console.log(`[MOCK][FAILED] Would have sent ${templateId} to ${to}`, data);
    
    // Log mock failure to Supabase for testing
    await logEmailFailure(to, templateId, errorMessage);
    
    return { success: false, error: errorMessage };
  }
};