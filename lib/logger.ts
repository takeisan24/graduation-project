const getLogLevel = () => {
  if (typeof process !== 'undefined' && process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
};

const LOG_LEVEL = getLogLevel();

const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error') => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(LOG_LEVEL);
  const targetLevelIndex = levels.indexOf(level);
  return targetLevelIndex >= currentLevelIndex;
};

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.log(new Date().toISOString(), '[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.log(new Date().toISOString(), '[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn(new Date().toISOString(), '[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error(new Date().toISOString(), '[ERROR]', ...args);
    }
  },
  log: (...args: any[]) => {
    // Default to info
    if (shouldLog('info')) {
      console.log(new Date().toISOString(), '[INFO]', ...args);
    }
  }
};

// Backwards compatibility
export const log = logger.info;
export const error = logger.error;

