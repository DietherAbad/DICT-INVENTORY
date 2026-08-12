import { useEffect, useState } from "react";
import { BASE_URL } from "./config";

export const DEFAULT_PROJECTS = [
  "General",
  "eLGU",
  "FreeWifi",
  "IIDB",
  "ILCDB",
  "Tech4Ed",
  "Not Applicable",
  "N/A",
];

const normalizeProject = (value) => String(value || "").trim();

const uniqProjects = (list) => {
  const seen = new Set();
  return list.filter((item) => {
    const key = normalizeProject(item).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildActiveSet = (list) => {
  const set = new Set();
  list.forEach((item) => {
    const key = normalizeProject(item).toLowerCase();
    if (key) set.add(key);
  });
  return set;
};

export const useProjects = ({ activeOnly = true } = {}) => {
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [activeSet, setActiveSet] = useState(() => buildActiveSet(DEFAULT_PROJECTS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set("activeOnly", "1");
      const res = await fetch(`${BASE_URL}/projects?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load projects.");
      const data = await res.json();
      const names = Array.isArray(data)
        ? data.map((p) => p.name).filter(Boolean)
        : [];
      const merged = uniqProjects([...names, ...DEFAULT_PROJECTS]);
      setProjects(merged);
      setActiveSet(buildActiveSet(merged));
    } catch (err) {
      setError(err);
      setProjects(DEFAULT_PROJECTS);
      setActiveSet(buildActiveSet(DEFAULT_PROJECTS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [activeOnly]);

  return { projects, loading, error, reload: loadProjects, activeSet };
};
