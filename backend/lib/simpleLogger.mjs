// Simple logger for Atlas backend (replacing winston temporarily)
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > currentLevel) return;
  
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...meta
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logData));
  } else {
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`, Object.keys(meta).length > 0 ? meta : '');
  }
}

export const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  
  // Winston compatibility
  child: (meta) => ({
    error: (message, additionalMeta) => log('error', message, { ...meta, ...additionalMeta }),
    warn: (message, additionalMeta) => log('warn', message, { ...meta, ...additionalMeta }),
    info: (message, additionalMeta) => log('info', message, { ...meta, ...additionalMeta }),
    debug: (message, additionalMeta) => log('debug', message, { ...meta, ...additionalMeta }),
  })
};

export default logger;
