import { useEffect, useState } from "react";
import { BASE_URL } from "./config";

export const DEFAULT_DESIGNATIONS = [
  "DICT Region 2",
  "Regional Office - Tuguegarao",
  "Office of the Regional Director",
  "AFD",
  "AFD Cashier",
  "Cashier’s Office",
  "Cashiers Office",
  "TOD",
  "Cagayan Office",
  "Isabela Office - Cauayan",
  "Isabela Office - Santiago",
  "Nueva Vizcaya Office",
  "Quirino Office",
  "Batanes Office",
  "Regional Office",
  "Provincial Office",
  "Field Office",
  "Motorpool",
  "Procurement",
  "Asset Management",
  "Helpdesk / Service Desk",
];

const normalize = (value) => String(value || "").trim();

const uniq = (list) => {
  const seen = new Set();
  return list.filter((item) => {
    const key = normalize(item).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildActiveSet = (list) => {
  const set = new Set();
  list.forEach((item) => {
    const key = normalize(item).toLowerCase();
    if (key) set.add(key);
  });
  return set;
};

export const useDesignations = ({ activeOnly = true } = {}) => {
  const [designations, setDesignations] = useState(DEFAULT_DESIGNATIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSet, setActiveSet] = useState(() => buildActiveSet(DEFAULT_DESIGNATIONS));

  const loadDesignations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set("activeOnly", "1");
      const res = await fetch(`${BASE_URL}/designations?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load designations.");
      const data = await res.json();
      const names = Array.isArray(data)
        ? data.map((d) => d.name).filter(Boolean)
        : [];
      const merged = uniq([...names, ...DEFAULT_DESIGNATIONS]);
      setDesignations(merged);
      setActiveSet(buildActiveSet(merged));
    } catch (err) {
      setError(err);
      setDesignations(DEFAULT_DESIGNATIONS);
      setActiveSet(buildActiveSet(DEFAULT_DESIGNATIONS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDesignations();
  }, [activeOnly]);

  return { designations, loading, error, reload: loadDesignations, activeSet };
};
