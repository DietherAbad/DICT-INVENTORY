import { useEffect, useRef, useState } from "react";

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const scoreName = (input, candidate) => {
  if (!input || !candidate) return 0;
  if (input === candidate) return 1;
  if (candidate.startsWith(input) || input.startsWith(candidate)) return 0.93;
  if (candidate.includes(input) || input.includes(candidate)) return 0.88;

  let i = 0;
  const minLen = Math.min(input.length, candidate.length);
  while (i < minLen && input[i] === candidate[i]) i += 1;
  return i / Math.max(input.length, candidate.length);
};

const getCandidateName = (item) =>
  item?.itemName || item?.item_name || item?.description || "";

const getListFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.inventory)) return payload.inventory;
  return [];
};

const pickBestMatch = (query, items) => {
  const normalizedQuery = normalizeName(query);
  let best = null;
  let bestScore = 0;

  items.forEach((item) => {
    const candidate = normalizeName(getCandidateName(item));
    const score = scoreName(normalizedQuery, candidate);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  return { item: best, score: bestScore };
};

export const useSmartItemPrefill = ({
  endpoint,
  query,
  enabled = true,
  minChars = 3,
  debounceMs = 320,
}) => {
  const [suggestion, setSuggestion] = useState(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastQueryRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      setSuggestion(null);
      setScore(0);
      setLoading(false);
      return undefined;
    }

    const search = String(query || "").trim();
    if (search.length < minChars) {
      setSuggestion(null);
      setScore(0);
      setLoading(false);
      return undefined;
    }

    lastQueryRef.current = search;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "8");
        params.set("search", search);

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch suggestions.");

        const data = await res.json();
        const list = getListFromPayload(data);
        const best = pickBestMatch(search, list);

        if (controller.signal.aborted) return;
        if (lastQueryRef.current !== search) return;

        setSuggestion(best.item || null);
        setScore(best.score || 0);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestion(null);
        setScore(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [endpoint, query, enabled, minChars, debounceMs]);

  return { suggestion, score, loading };
};
