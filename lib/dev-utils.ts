// ✅ Helper functions for development-only logging
export const devLog = (...args: any[]) => {
  // SILENCED: if (process.env.NODE_ENV === 'development') { console.log(...args); }
};

export const devWarn = (...args: any[]) => {
  // SILENCED: if (process.env.NODE_ENV === 'development') { console.warn(...args); }
};

export const devError = (...args: any[]) => {
  // SILENCED: if (process.env.NODE_ENV === 'development') { console.error(...args); }
};
