import { useEffect } from 'react';

type ShortcutOptions = {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  /**
   * If true, the shortcut will trigger even if the user is typing in an input field.
   * By default, it's false to avoid accidental triggers while typing.
   */
  ignoreInputFields?: boolean;
};

export const useKeyboardShortcuts = (
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field unless explicitly allowed
      if (!options.ignoreInputFields) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          // If we want to allow Ctrl+Enter in inputs, we can handle it specifically
          // For general shortcuts like Ctrl+S, we might want to allow them even in inputs
          // but for just letters (e.g., 'K' for search), we don't.
          // Let's only ignore if it's not a modifying shortcut.
          if (!options.ctrl && !options.meta && !options.alt) {
            return;
          }
        }
      }

      const isCtrlOrMeta = options.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
      const isShift = options.shift ? e.shiftKey : !e.shiftKey;
      const isAlt = options.alt ? e.altKey : !e.altKey;

      if (isCtrlOrMeta && isShift && isAlt && e.key.toLowerCase() === key.toLowerCase()) {
        if (options.preventDefault !== false) e.preventDefault();
        if (options.stopPropagation !== false) e.stopPropagation();
        callback(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
};
