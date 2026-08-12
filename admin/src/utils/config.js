// export const BASE_URL = `http://localhost:4000/api/v1`;
export const BASE_URL = `https://inventory.dictr2.cloud/api/v1`;
// export const BASE_URL = `https://dictbackend.onrender.com/api/v1`;

export const API_ROOT = BASE_URL.replace(/\/api\/v1\/?$/, "");

export const resolveServerUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = String(path).startsWith("/") ? path : `/${path}`;
  if (normalizedPath.startsWith("/api/v1/uploads/")) {
    return `${API_ROOT}${normalizedPath.replace(/^\/api\/v1/, "")}`;
  }
  if (normalizedPath.startsWith("/uploads/")) {
    return `${API_ROOT}${normalizedPath}`;
  }
  if (normalizedPath.startsWith("/api/v1/")) {
    return `${API_ROOT}${normalizedPath}`;
  }
  return `${API_ROOT}${normalizedPath}`;
};
