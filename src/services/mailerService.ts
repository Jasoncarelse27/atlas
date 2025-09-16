// Environment-based service selection
import { MailerServiceMock } from "./mailerService.mock";
import { MailerServiceReal } from "./mailerService.real";

export const MailerService = (process.env.NODE_ENV === "test" || process.env.USE_MOCK_MAILER === "true") 
  ? MailerServiceMock 
  : MailerServiceReal;