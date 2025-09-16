// Mock MailerLite service for tests
export const MailerServiceMock = {
  sendEmail: async (to: string, templateId: string, data: any) => {
    console.log(`[MOCK] Email sent to ${to} with template ${templateId}`, data);
    return { success: true, mock: true };
  }
};