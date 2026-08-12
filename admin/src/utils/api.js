const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultRetryStatuses = new Set([429, 502, 503, 504]);

const isRetryableMethod = (method) => {
  const m = (method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
};

const readErrorMessage = async (response) => {
  try {
    const clone = response.clone();
    const data = await clone.json();
    return (
      data?.message ||
      data?.error ||
      (typeof data === "string" ? data : JSON.stringify(data))
    );
  } catch {
    try {
      const text = await response.clone().text();
      return text || response.statusText;
    } catch {
      return response.statusText || "Request failed";
    }
  }
};

const normalizeHeaders = (headers) => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return headers.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
  if (typeof headers === "object") return headers;
  return {};
};

const extractBody = (body) => {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) return null;
  if (typeof Blob !== "undefined" && body instanceof Blob) return null;
  if (typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
  return null;
};

const buildRetryPayload = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  const method = (init.method || input?.method || "GET").toUpperCase();
  const headers = normalizeHeaders(init.headers || input?.headers);
  const body = extractBody(init.body);
  const retryable = method === "GET" || body !== null;
  return retryable
    ? {
        retryable: true,
        retryPayload: {
          url,
          method,
          headers,
          body,
          credentials: init.credentials || "include",
        },
      }
    : { retryable: false, retryPayload: null };
};

export const setupApiClient = (options = {}) => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window.__apiFetchPatched) return;

  const baseRetries = Number.isFinite(options.retries) ? options.retries : 2;
  const baseDelay = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 400;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const nextInit = {
      credentials: init.credentials || "include",
      ...init,
    };
    const silentStatuses = Array.isArray(nextInit.silentStatuses)
      ? nextInit.silentStatuses
      : [];
    const suppressErrors = Boolean(nextInit.suppressErrorToast);
    const retryCount = Number.isFinite(nextInit.retry)
      ? Number(nextInit.retry)
      : isRetryableMethod(method)
      ? baseRetries
      : 0;
    const retryDelay = Number.isFinite(nextInit.retryDelayMs)
      ? nextInit.retryDelayMs
      : baseDelay;
    const retryOn = typeof nextInit.retryOn === "function"
      ? nextInit.retryOn
      : (response) => defaultRetryStatuses.has(response.status);

    let lastError = null;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        const response = await nativeFetch(input, nextInit);
        if (response.ok) return response;

        if (attempt < retryCount && retryOn(response)) {
          await sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }

        const suppressReadAccessErrors =
          (response.status === 403 || response.status === 404) &&
          (method === "GET" || method === "HEAD");
        if (
          !suppressErrors &&
          !silentStatuses.includes(response.status) &&
          !suppressReadAccessErrors
        ) {
          const message = await readErrorMessage(response);
          const retryMeta = buildRetryPayload(input, nextInit);
          window.dispatchEvent(
            new CustomEvent("api:error", {
              detail: {
                url: typeof input === "string" ? input : input?.url,
                method,
                status: response.status,
                message,
                time: new Date().toISOString(),
                ...retryMeta,
              },
            })
          );
        }
        return response;
      } catch (err) {
        if (err?.name === "AbortError") {
          throw err;
        }
        lastError = err;
        if (attempt < retryCount && isRetryableMethod(method)) {
          await sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }
        if (!suppressErrors) {
          const retryMeta = buildRetryPayload(input, nextInit);
          window.dispatchEvent(
            new CustomEvent("api:error", {
              detail: {
                url: typeof input === "string" ? input : input?.url,
                method,
                status: 0,
                message: err?.message || "Network error",
                time: new Date().toISOString(),
                ...retryMeta,
              },
            })
          );
        }
        throw err;
      }
    }

    throw lastError || new Error("Request failed");
  };

  window.__apiFetchPatched = true;
};
