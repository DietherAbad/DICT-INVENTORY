import { useCallback, useEffect } from "react";

const DEFAULT_WARNING_MESSAGE =
  "You have unsaved progress in this form. Leaving now will clear your progress. Continue?";

const isBypassClick = (event) =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

const isIgnorableHref = (href) =>
  !href ||
  href === "#" ||
  href.startsWith("mailto:") ||
  href.startsWith("tel:");

export const useUnsavedChangesWarning = (
  enabled,
  warningMessage = DEFAULT_WARNING_MESSAGE
) => {
  const confirmDiscard = useCallback(() => {
    if (!enabled || typeof window === "undefined") return true;
    return window.confirm(warningMessage);
  }, [enabled, warningMessage]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = warningMessage;
      return warningMessage;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, warningMessage]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const onLinkClickCapture = (event) => {
      if (isBypassClick(event)) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const rawHref = (anchor.getAttribute("href") || "").trim();
      if (isIgnorableHref(rawHref)) return;

      if (rawHref.startsWith("#")) {
        const currentHash = window.location.hash || "#/";
        if (rawHref === currentHash) return;
      } else {
        try {
          const targetUrl = new URL(anchor.href, window.location.href);
          if (targetUrl.protocol === `javascript${":"}`) return;
          const absoluteTarget = targetUrl.toString();
          if (absoluteTarget === window.location.href) return;
        } catch {
          return;
        }
      }

      if (!window.confirm(warningMessage)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", onLinkClickCapture, true);
    return () => document.removeEventListener("click", onLinkClickCapture, true);
  }, [enabled, warningMessage]);

  return { confirmDiscard };
};
