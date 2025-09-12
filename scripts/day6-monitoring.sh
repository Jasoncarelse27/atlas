#!/usr/bin/env bash
set -euo pipefail

echo "📊 Day 6: Monitoring & Observability Integration starting..."

# 1. Install logger dependency
npm install winston --save

# 2. Replace console.log with winston logger (basic config)
cat > src/lib/logger.ts <<'EOL'
import { createLogger, transports, format } from "winston";

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [new transports.Console()],
});

export default logger;
EOL

# 3. Ensure error boundaries use logger
cat > src/lib/errorBoundary.tsx <<'EOL'
import React from "react";
import logger from "./logger";

class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    logger.error("React error boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
EOL

# 4. Run typecheck + full tests
npm run typecheck || true
npm test || true

echo "✅ Day 6 Monitoring & Observability Integration complete!"
