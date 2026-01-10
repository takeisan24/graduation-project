// Store translation getter function that will be set by the app
let getToastTranslation: ((key: string, params?: Record<string, any>) => string) | null = null;

export function setToastTranslation(getter: (key: string, params?: Record<string, any>) => string) {
  getToastTranslation = getter;
}

export function getToast(key: string, params?: Record<string, any>): string {
  if (getToastTranslation) {
    return getToastTranslation(key, params);
  }
  // Fallback to key if translation getter is not set
  return formatMessage(key, params);
}

// Helper to format message with parameters
export function formatMessage(message: string, params?: Record<string, any>): string {
  if (!params) return message;
  
  let result = message;
  Object.keys(params).forEach(key => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(params[key]));
  });
  return result;
}
