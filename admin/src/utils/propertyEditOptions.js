import { useEffect, useMemo, useState } from "react";
import { BASE_URL } from "./config";
import { useDesignations } from "./designations";

const normalize = (value) => String(value || "").trim();

const uniqueOptions = (values) => {
  const seen = new Set();
  return (values || []).filter((value) => {
    const clean = normalize(value);
    const key = clean.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const includeCurrentOption = (options, currentValue) =>
  uniqueOptions([currentValue, ...(options || [])]);

export const usePropertyEditOptions = (classificationDesignations = [], enabled = true) => {
  const [classificationOptions, setClassificationOptions] = useState([]);
  const { designations: storedToOptions } = useDesignations();
  const designationKey = classificationDesignations.join("|");

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const loadClassifications = async () => {
      try {
        const response = await fetch(`${BASE_URL}/classification?active=true`, {
          credentials: "include",
          silentStatuses: [401, 403],
          suppressErrorToast: true,
        });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload?.data || [];
        const allowed = new Set(designationKey.split("|").map(normalize).filter(Boolean));
        const values = rows
          .filter((row) => allowed.has(normalize(row?.designation)))
          .map((row) => normalize(row?.description));
        if (!cancelled) setClassificationOptions(uniqueOptions(values));
      } catch {
        if (!cancelled) setClassificationOptions([]);
      }
    };

    loadClassifications();
    return () => {
      cancelled = true;
    };
  }, [designationKey, enabled]);

  return useMemo(
    () => ({
      classificationOptions,
      storedToOptions: uniqueOptions(storedToOptions),
    }),
    [classificationOptions, storedToOptions]
  );
};
