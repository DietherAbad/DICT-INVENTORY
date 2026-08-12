import { useEffect, useRef } from "react";

const readDraft = (key) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeDraft = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const clearDraftKey = (key) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const useFormDraft = (key, value, applyDraft, options = {}) => {
  const { enabled = true, debounceMs = 500 } = options;
  const hydratedRef = useRef(false);
  const timeoutRef = useRef(null);
  const applyDraftRef = useRef(applyDraft);

  useEffect(() => {
    applyDraftRef.current = applyDraft;
  }, [applyDraft]);

  useEffect(() => {
    if (!enabled || !key) return;
    const existing = readDraft(key);
    if (existing && applyDraftRef.current) {
      applyDraftRef.current(existing);
    }
    hydratedRef.current = true;
    return () => {
      hydratedRef.current = false;
    };
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || !key || !hydratedRef.current) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      writeDraft(key, value);
    }, debounceMs);

    return () => window.clearTimeout(timeoutRef.current);
  }, [debounceMs, enabled, key, value]);

  return {
    clear: () => clearDraftKey(key),
  };
};
