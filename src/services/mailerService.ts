// Environment-based service selection
import { mailerService as mockService } from "./mailerService.mock";
import { mailerService as realService } from "./mailerService.real";

const useMock =
  process.env.NODE_ENV === "test" || process.env.USE_MOCK_MAILER === "true";

export const mailerService = useMock ? mockService : realService;