import "@testing-library/jest-dom";
import { server } from "./testServer";

// MSW (mock server) – start for tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
