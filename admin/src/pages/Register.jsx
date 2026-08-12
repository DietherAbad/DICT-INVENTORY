// src/pages/Register.jsx
import React, { useState } from "react";
import DICT_GIF from "../assets/DICTGIF.gif";
import DICT from "../assets/DICT.png";
import { BASE_URL } from "../utils/config";
import ModalShell from "../components/ModalShell";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../utils/projects";
import { useDesignations } from "../utils/designations";

function Register() {
  const navigate = useNavigate();

  /* -------------------- form state -------------------- */
  const [credentials, setCredentials] = useState({
    username: "",
    email: "",
    project: "",
    designation: "",
    password: "",
    position: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [emailSent, setEmailSent] = useState(true);

  // For success modal summary
  const [createdEmail, setCreatedEmail] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [revealCreatedPassword, setRevealCreatedPassword] = useState(false);

  /* -------------------- helpers -------------------- */
  const { projects, activeSet: activeProjectSet } = useProjects();
  const { designations, activeSet: activeDesignationSet } = useDesignations();
  const normalizeProject = (value) => String(value || "").trim().toLowerCase();
  const normalizeDesignation = (value) => String(value || "").trim().toLowerCase();

  const handleChange = (e) => {
    const { id, value } = e.target;
    if (id === "fullName") {
      setCredentials((s) => ({ ...s, username: value }));
    } else {
      setCredentials((s) => ({ ...s, [id]: value }));
    }
    setErrors((s) => ({ ...s, [id]: "" })); // clear per-field error on change
    setServerError("");
  };

  const validate = (c) => {
    const e = {};

    if (!c.username?.trim()) e.fullName = "Display name is required.";
    if (!c.position?.trim()) e.position = "Position is required.";
    if (!c.email?.trim()) {
      e.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(c.email)) {
      e.email = "Please enter a valid email.";
    }
    if (!c.project) {
      e.project = "Please select a project.";
    } else if (!activeProjectSet.has(normalizeProject(c.project))) {
      e.project = "Selected project is inactive. Choose another.";
    }
    if (!c.designation) {
      e.designation = "Please select a designation.";
    } else if (!activeDesignationSet.has(normalizeDesignation(c.designation))) {
      e.designation = "Selected designation is inactive. Choose another.";
    }

    const pw = c.password || "";
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasUpper = /[A-Z]/.test(pw);
    const hasLen = pw.length >= 8;

    if (!pw) {
      e.password = "Password is required.";
    } else if (!(hasSpecial && hasNumber && hasUpper && hasLen)) {
      e.password =
        "Must be 8+ chars and include an uppercase letter, a number, and a special character.";
    }

    return e;
  };

  const passwordStrength = (pw) => {
    if (!pw) return { label: "Too weak", pct: 10, cls: "bg-red-500" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
    if (pw.length >= 12) score++;

    // map score (0-5) to percent & color (Tailwind v2-safe)
    const map = [
      { label: "Too weak", pct: 15, cls: "bg-red-500" },
      { label: "Weak", pct: 30, cls: "bg-red-500" },
      { label: "Fair", pct: 50, cls: "bg-yellow-500" },
      { label: "Good", pct: 75, cls: "bg-green-500" },
      { label: "Strong", pct: 90, cls: "bg-green-600" },
      { label: "Excellent", pct: 100, cls: "bg-green-700" },
    ];
    return map[score];
  };

  const normalizeMessage = (value) =>
    String(value || "")
      .replace(/^error:\s*/i, "")
      .trim();

  const friendlyRegisterError = (status, payload = {}) => {
    const message = normalizeMessage(payload?.message || payload?.error || "");
    const details = Array.isArray(payload?.details)
      ? payload.details.map((d) => normalizeMessage(d)).filter(Boolean)
      : [];

    if (status === 409 || /email.+(exists|taken)|already exists/i.test(message)) {
      return "Email is already taken. Use a different email.";
    }

    if (status === 400) {
      if (details.some((d) => /email/i.test(d))) return "Please enter a valid email address.";
      if (details.some((d) => /password/i.test(d))) {
        return "Password must be 8+ characters with an uppercase letter, a number, and a special character.";
      }
      if (details.some((d) => /username|name/i.test(d))) return "Display name is required.";
      if (details.some((d) => /project/i.test(d))) return "Please choose a valid active project.";
      if (details.some((d) => /designation/i.test(d)))
        return "Please choose a valid active designation.";
      if (message) return message;
      return "Some details are invalid. Please review the form.";
    }

    if (status === 401 || status === 403) {
      return "You are not allowed to register users with this account.";
    }
    if (status === 404) return "Registration service is unavailable right now.";
    if (status === 429) return "Too many attempts. Please wait and try again.";
    if (status >= 500) return "Server error while creating account. Please try again.";
    if (message && !/^\d{3}$/.test(message)) return message;

    return "Registration failed. Please try again.";
  };

  const sanitizeCredentials = (c) => ({
    username: String(c.username || "").trim(),
    email: String(c.email || "").trim().toLowerCase(),
    project: String(c.project || "").trim(),
    designation: String(c.designation || "").trim(),
    password: String(c.password || ""),
    position: String(c.position || "").trim(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const payload = sanitizeCredentials(credentials);
    const eMap = validate(payload);
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) return;

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : { message: await res.text().catch(() => "") };

      if (!res.ok) {
        setServerError(friendlyRegisterError(res.status, result));
        return;
      }

      // success
      setCreatedEmail(payload.email);
      setCreatedPassword(payload.password);
      setEmailSent(result?.emailSent !== false);
      setRevealCreatedPassword(false);
      setShowSuccessPopup(true);
    } catch (err) {
      const raw = normalizeMessage(err?.message || "");
      if (/failed to fetch|network|load failed/i.test(raw)) {
        setServerError("Cannot reach the server. Check your connection and try again.");
      } else {
        setServerError("Something went wrong while creating the account.");
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(credentials.password);
  const pw = credentials.password || "";
  const pwChecks = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "Number", ok: /\d/.test(pw) },
    { label: "Special character", ok: /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
  ];
  const sanitized = sanitizeCredentials(credentials);
  const hasPasswordPolicy = pwChecks.every((rule) => rule.ok);
  const emailLooksValid = /^\S+@\S+\.\S+$/.test(sanitized.email);
  const completionChecks = [
    { label: "Display name", ok: Boolean(sanitized.username) },
    { label: "Position", ok: Boolean(sanitized.position) },
    { label: "Email", ok: Boolean(sanitized.email) && emailLooksValid },
    {
      label: "Project",
      ok: Boolean(sanitized.project) && activeProjectSet.has(normalizeProject(sanitized.project)),
    },
    {
      label: "Office",
      ok:
        Boolean(sanitized.designation) &&
        activeDesignationSet.has(normalizeDesignation(sanitized.designation)),
    },
    { label: "Password policy", ok: hasPasswordPolicy },
  ];
  const completedCount = completionChecks.filter((item) => item.ok).length;
  const completionPct = Math.round((completedCount / completionChecks.length) * 100);
  const canSubmit = completionChecks.every((item) => item.ok) && !loading;

  const copy = (value) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(value);
      }
    } catch {
      /* no-op */
    }
  };

  const resetForm = () => {
    setCredentials({
      username: "",
      email: "",
      project: "",
      designation: "",
      password: "",
      position: "",
    });
    setErrors({});
    setServerError("");
    setCreatedEmail("");
    setCreatedPassword("");
    setRevealCreatedPassword(false);
    setEmailSent(true);
  };

  const closeSuccessPopup = () => {
    setShowSuccessPopup(false);
    setCreatedEmail("");
    setCreatedPassword("");
    setRevealCreatedPassword(false);
  };

  const generateStrongPassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const num = "23456789";
    const special = "!@#$%^&*";
    const all = `${upper}${lower}${num}${special}`;
    const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];

    const parts = [pick(upper), pick(lower), pick(num), pick(special)];
    while (parts.length < 12) parts.push(pick(all));
    for (let i = parts.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }

    const generated = parts.join("");
    setCredentials((s) => ({ ...s, password: generated }));
    setErrors((s) => ({ ...s, password: "" }));
    setShowPassword(true);
    setServerError("");
  };

  const fieldLabel =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500";
  const fieldShell =
    "group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200/60";
  const fieldInput =
    "w-full bg-transparent px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 border-0 outline-none shadow-none appearance-none focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:outline-none focus-visible:ring-0 focus:shadow-none";

  /* -------------------- UI -------------------- */
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-indigo-50 text-slate-900"
      style={{
        "--reg-accent": "#1e3a8a",
        "--reg-glow": "#60a5fa",
      }}
    >
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-indigo-100/70 blur-3xl register-float" />
      <div className="pointer-events-none absolute -bottom-44 left-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/70 blur-3xl register-float-slow" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.06),_transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* LEFT: Form card */}
          <div className="register-rise rounded-3xl border border-slate-200 bg-white/95 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.18)] overflow-hidden text-slate-900">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-white via-slate-50 to-indigo-50 px-6 py-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-100 blur-2xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-100 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    aria-label="Go back"
                    title="Go back"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 4L6 10L12 16"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back
                  </button>
                  <div className="h-10 w-10 rounded-xl bg-white ring-1 ring-slate-200 grid place-items-center">
                    <img src={DICT} alt="DICT" className="h-6 w-6 object-contain" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Create account</p>
                    <p className="text-[11px] text-slate-500">Admin access provisioning</p>
                  </div>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Register
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 md:px-8 pt-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-700">
                Step 01
                <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                Profile setup
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                Bring new users on board
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Fill in the details below. We will send a welcome email with their initial password
                and onboarding steps after account creation.
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Completion
                  </p>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                    {completedCount}/{completionChecks.length}
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2.5 rounded-full bg-[linear-gradient(90deg,#1d4ed8,#0284c7)] transition-all duration-300"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {completionChecks.map((item) => (
                    <div
                      key={item.label}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[11px] ${
                        item.ok
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.ok ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Server error */}
            {serverError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 mx-6 md:mx-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
              >
                {serverError}
              </div>
            ) : null}

            {/* Form */}
            <form
              className="mt-6 space-y-6 px-6 md:px-8 pb-8"
              onSubmit={handleSubmit}
              noValidate
              autoComplete="off"
            >
              {/* Personal data */}
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Personal profile</h2>
                <p className="text-xs text-slate-500">Basic user details for identification</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Display name */}
                  <div>
                    <label htmlFor="fullName" className={fieldLabel}>
                      Display name
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.fullName ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <input
                        id="fullName"
                        type="text"
                        required
                        autoComplete="off"
                        onChange={handleChange}
                        value={credentials.username}
                        className={fieldInput}
                        placeholder="Full name"
                      />
                    </div>
                    {errors.fullName ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.fullName}</p>
                    ) : null}
                  </div>

                  {/* Position */}
                  <div>
                    <label htmlFor="position" className={fieldLabel}>
                      Position
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.position ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <input
                        id="position"
                        type="text"
                        required
                        autoComplete="off"
                        onChange={handleChange}
                        value={credentials.position}
                        className={fieldInput}
                        placeholder="Role or title"
                      />
                    </div>
                    {errors.position ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.position}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className={fieldLabel}>
                      Email address
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.email ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        onChange={handleChange}
                        value={credentials.email}
                        className={fieldInput}
                        placeholder="name@example.com"
                      />
                    </div>
                    {errors.email ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
                    ) : null}
                  </div>

                  {/* Project */}
                  <div>
                    <label htmlFor="project" className={fieldLabel}>
                      Project
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.project ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <select
                        id="project"
                        required
                        onChange={handleChange}
                        value={credentials.project}
                        className={fieldInput}
                      >
                        <option value="">Select project</option>
                        {projects.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.project ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.project}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Only active projects are available.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Office/Designation */}
                  <div>
                    <label htmlFor="designation" className={fieldLabel}>
                      Office / designation
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.designation ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <select
                        id="designation"
                        required
                        onChange={handleChange}
                        value={credentials.designation}
                        className={fieldInput}
                      >
                        <option value="">Select office/designation</option>
                        {designations.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.designation ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.designation}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Office list follows current active setup.
                      </p>
                    )}
                  </div>

                  {/* Password with show/hide & strength meter */}
                  <div>
                    <label htmlFor="password" className={fieldLabel}>
                      Initial password
                    </label>
                    <div
                      className={`${fieldShell} ${
                        errors.password ? "border-rose-300" : "border-slate-300"
                      }`}
                    >
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        onChange={handleChange}
                        value={credentials.password}
                        className={`${fieldInput} pr-16`}
                        placeholder="Set a strong initial password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute inset-y-0 right-3 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 w-full rounded-full bg-slate-200">
                        <div
                          className={`h-2 rounded-full ${strength.cls}`}
                          style={{ width: `${strength.pct}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Password strength: {strength.label}</span>
                        <span>8+ chars • A • 1 • *</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        {pwChecks.map((rule) => (
                          <div key={rule.label} className="flex items-center gap-2">
                            <span
                            className={`h-2 w-2 rounded-full ${
                                rule.ok ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            />
                            <span className={rule.ok ? "text-emerald-600" : "text-slate-500"}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={generateStrongPassword}
                        className="mt-2 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Generate strong password
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.password}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  aria-disabled={!canSubmit}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(30,58,138,0.45)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--reg-accent)]/30 ${
                    !canSubmit
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-[linear-gradient(135deg,var(--reg-accent),#1e3a8a)] hover:shadow-[0_22px_50px_-24px_rgba(30,58,138,0.55)]"
                  }`}
                >
                  {loading ? "Creating account…" : "Create account"}
                  {!loading && (
                    <svg
                      className="ml-2 h-3 w-3"
                      viewBox="0 0 12 8"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8.01 3H0V5H8.01V8L12 4L8.01 0V3Z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  className={`inline-flex items-center justify-center px-6 py-3 rounded-2xl text-sm font-semibold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                    loading
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "text-slate-700 bg-white hover:bg-slate-50"
                  }`}
                >
                  Clear form
                </button>
              </div>
              {!canSubmit ? (
                <p className="text-xs text-slate-500">
                  Complete all required fields and password policy checks to enable account
                  creation.
                </p>
              ) : (
                <p className="text-xs text-emerald-700">All checks passed. Ready to create account.</p>
              )}
            </form>
          </div>

          {/* RIGHT: Visual */}
          <div className="register-rise-delayed flex flex-col gap-6">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              <div className="relative h-44 bg-gradient-to-br from-sky-50 via-white to-indigo-50">
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-sky-200/40" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-200/40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={DICT_GIF}
                    alt="DICT animation"
                    className="h-24 xl:h-28 object-contain drop-shadow-md"
                  />
                </div>
                <div className="absolute left-5 bottom-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 ring-1 ring-slate-200 text-sky-700 shadow-sm">
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7h16v10H4z" />
                      <path d="M8 7V5h8v2" />
                      <path d="M9 12h6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Inventory
                    </p>
                    <p className="text-sm font-semibold text-slate-900">User onboarding</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-700">
                  Account briefing
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Smooth onboarding</h2>
                <p className="mt-2 text-sm text-slate-600">
                  New users receive a welcome email with their initial credentials and reminders to
                  reset their password after the first login.
                </p>
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                  Tip: Share initial passwords through a secure channel and encourage immediate
                  rotation.
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              <div className="relative h-24 bg-gradient-to-br from-amber-50 via-white to-sky-50">
                <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-amber-200/40" />
                <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-sky-200/40" />
                <div className="absolute left-5 bottom-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 ring-1 ring-slate-200 text-amber-600 shadow-sm">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 7h18" />
                      <path d="M8 3h8" />
                      <path d="M7 11h10v10H7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Preview
                    </p>
                    <p className="text-sm font-semibold text-slate-900">Live account summary</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Display name</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {sanitized.username || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Position</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {sanitized.position || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Project</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {sanitized.project || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Office</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {sanitized.designation || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
                  <p className="font-semibold text-slate-700">Email destination</p>
                  <p className="mt-1 text-slate-600">{sanitized.email || "name@example.com"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        emailLooksValid
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {emailLooksValid ? "Valid email format" : "Email format pending"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        hasPasswordPolicy
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      Password: {strength.label}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Keep access aligned with department policy and share initial credentials through
                  a secure channel.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Popup */}
      <ModalShell
        open={showSuccessPopup}
        title="Account created"
        subtitle="User Registration"
        variant="neutral"
        onClose={closeSuccessPopup}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              The user account has been created successfully.{" "}
              {emailSent ? (
                <>
                  A welcome email has been sent to{" "}
                  <span className="font-semibold">{createdEmail}</span>.
                </>
              ) : (
                <>
                  Email delivery is disabled or failed. Share the initial password with{" "}
                  <span className="font-semibold">{createdEmail}</span>.
                </>
              )}
            </p>
          </div>

          {/* Quick reference for admin */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Email</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{createdEmail}</span>
                <button
                  type="button"
                  onClick={() => copy(createdEmail)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Initial password</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">
                    {revealCreatedPassword ? createdPassword : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealCreatedPassword((s) => !s)}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    {revealCreatedPassword ? "Hide" : "Reveal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(createdPassword)}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                closeSuccessPopup();
                resetForm();
              }}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Create another
            </button>
            <button
              type="button"
              onClick={closeSuccessPopup}
              className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-gray-500">
            {emailSent
              ? "If email sending is disabled in your environment, share the initial password securely with the user and remind them to change it after login."
              : "Please share the initial password securely and remind the user to change it after login."}
          </p>
        </div>
      </ModalShell>
    </div>
  );
}

export default Register;
