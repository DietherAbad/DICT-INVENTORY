// src/pages/Login.jsx
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import DICT_GIF from "../assets/DICTGIF.gif"; // animated brand visual
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";
import { useNavigate, useLocation } from "react-router-dom";
import ModalShell from "../components/ModalShell";

/**
 * Login
 * - Polished, responsive layout with branded header
 * - "Stay logged in" controls persistent session across browser restarts
 * - Strong button colors, proper focus states, accessible labels
 * - Success / error popups with improved, high-contrast buttons
 */
export default function Login() {
  /* -------------------- state -------------------- */
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isReturning, setIsReturning] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("login_seen") === "1";
  });

  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showUnsuccessfulPopup, setShowUnsuccessfulPopup] = useState(false);
  const [showRateLimitPopup, setShowRateLimitPopup] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    "User not found. Please try again."
  );

  const { dispatch } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  /* -------------------- effects -------------------- */
  const persistStayLoggedInPreference = useCallback((enabled) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("stay_logged_in", enabled ? "1" : "0");
    // clean legacy remember-me keys
    localStorage.removeItem("remember_me");
    localStorage.removeItem("remembered_email");
  }, []);

  useEffect(() => {
    const stayLoggedIn = localStorage.getItem("stay_logged_in");
    if (stayLoggedIn === "1") {
      setRememberMe(true);
      return;
    }
    // backward compatibility with old remember_me flag
    if (localStorage.getItem("remember_me") === "1") {
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!isReturning) {
      localStorage.setItem("login_seen", "1");
    }
  }, [isReturning]);

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setGoogleReady(false);
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [googleClientId]);

  /* -------------------- handlers -------------------- */
  const handleChange = (e) => {
    const { id, value } = e.target;
    setCredentials((prev) => ({ ...prev, [id]: value }));
  };

  const normalizeMessage = (value) =>
    String(value || "")
      .replace(/^error:\s*/i, "")
      .trim();

  const resolveLoginError = (status, payload = {}) => {
    const message = normalizeMessage(payload?.message || payload?.error || "");
    const raw = message.toLowerCase();
    const details = Array.isArray(payload?.details)
      ? payload.details.map((d) => normalizeMessage(d).toLowerCase()).filter(Boolean)
      : [];

    if (status === 429) return "Too many login attempts. Please wait and try again.";
    if (status === 400) {
      if (details.some((d) => d.includes("email"))) return "Please enter a valid email address.";
      if (details.some((d) => d.includes("password"))) return "Password is required.";
      if (message) return message;
      return "Invalid login details. Please review your email and password.";
    }
    if (status === 404 || raw.includes("not found")) return "Email is not registered.";
    if (status === 403 || raw.includes("inactive")) {
      return "Account is inactive. Please contact the administrator.";
    }
    if (status === 401 || raw.includes("incorrect")) return "Incorrect email or password.";
    if (status >= 500) return "Login service is temporarily unavailable. Please try again.";
    if (message && !/^\d{3}$/.test(message)) return message;
    return "Unable to sign in right now. Please try again.";
  };

  const formatCountdown = (totalSeconds) => {
    const safe = Math.max(0, Math.ceil(totalSeconds || 0));
    const minutes = Math.floor(safe / 60);
    const seconds = String(safe % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const closeRateLimitPopup = () => {
    setShowRateLimitPopup(false);
  };

  const getRateLimitUntil = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem("login_rate_limit_until");
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) ? until : 0;
  }, []);

  const syncRateLimitFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    const until = getRateLimitUntil();
    if (!until) return;
    const remaining = Math.ceil((until - Date.now()) / 1000);
    if (remaining > 0) {
      setRateLimitSeconds(remaining);
      setShowRateLimitPopup(true);
    } else {
      localStorage.removeItem("login_rate_limit_until");
    }
  }, [getRateLimitUntil]);

  useEffect(() => {
    syncRateLimitFromStorage();
  }, [syncRateLimitFromStorage]);

  useEffect(() => {
    if (!showRateLimitPopup) return;
    if (rateLimitSeconds <= 0) {
      setShowRateLimitPopup(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("login_rate_limit_until");
      }
      return;
    }
    const t = setTimeout(() => {
      setRateLimitSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [showRateLimitPopup, rateLimitSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const lockedUntil = getRateLimitUntil();
    if (lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setRateLimitSeconds(remaining);
      setShowRateLimitPopup(true);
      setShowUnsuccessfulPopup(false);
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...credentials,
          stayLoggedIn: rememberMe,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : { message: await res.text().catch(() => "") };
      if (!res.ok) {
        if (res.status === 429) {
          const now = Date.now();
          const existingUntil = getRateLimitUntil();
          if (existingUntil > now) {
            const remaining = Math.ceil((existingUntil - now) / 1000);
            setRateLimitSeconds(remaining);
            setShowRateLimitPopup(true);
            setShowUnsuccessfulPopup(false);
            return;
          }
          const retryAfter = Number(res.headers.get("Retry-After"));
          const fallback = 15 * 60;
          const duration =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : fallback;
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "login_rate_limit_until",
              String(now + duration * 1000)
            );
          }
          setRateLimitSeconds(duration);
          setShowRateLimitPopup(true);
          setShowUnsuccessfulPopup(false);
          return;
        }
        setErrorMessage(resolveLoginError(res.status, result));
        setShowUnsuccessfulPopup(true);
        return;
      }

      // success
      persistStayLoggedInPreference(rememberMe);
      dispatch({ type: "LOGIN_SUCCESS", payload: result });
      setShowSuccessPopup(true);

      // brief delay so user sees the success state
      setTimeout(() => {
        setShowSuccessPopup(false);
        const resumePath = sessionStorage.getItem("resume_after_login");
        const fallback = location.state?.from?.pathname
          ? `${location.state.from.pathname}${location.state.from.search || ""}`
          : "/";
        if (resumePath) {
          sessionStorage.removeItem("resume_after_login");
          navigate(resumePath);
          return;
        }
        navigate(fallback);
      }, 1200);
    } catch (err) {
      const raw = normalizeMessage(err?.message || "").toLowerCase();
      if (raw.includes("failed to fetch") || raw.includes("network") || raw.includes("load failed")) {
        setErrorMessage("Cannot reach the server. Check your connection and try again.");
      } else {
        setErrorMessage("Unable to sign in right now. Please try again.");
      }
      setShowUnsuccessfulPopup(true);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = useCallback(async (response) => {
    if (busy) return;
    const lockedUntil = getRateLimitUntil();
    if (lockedUntil > Date.now()) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setRateLimitSeconds(remaining);
      setShowRateLimitPopup(true);
      setShowUnsuccessfulPopup(false);
      return;
    }
    const credential = response?.credential;
    if (!credential) {
      setErrorMessage("Google sign-in failed. Please try again.");
      setShowUnsuccessfulPopup(true);
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credential,
          stayLoggedIn: rememberMe,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : { message: await res.text().catch(() => "") };
      if (!res.ok) {
        if (res.status === 429) {
          const now = Date.now();
          const existingUntil = getRateLimitUntil();
          if (existingUntil > now) {
            const remaining = Math.ceil((existingUntil - now) / 1000);
            setRateLimitSeconds(remaining);
            setShowRateLimitPopup(true);
            setShowUnsuccessfulPopup(false);
            return;
          }
          const retryAfter = Number(res.headers.get("Retry-After"));
          const fallback = 15 * 60;
          const duration =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : fallback;
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "login_rate_limit_until",
              String(now + duration * 1000)
            );
          }
          setRateLimitSeconds(duration);
          setShowRateLimitPopup(true);
          setShowUnsuccessfulPopup(false);
          return;
        }
        setErrorMessage(resolveLoginError(res.status, result));
        setShowUnsuccessfulPopup(true);
        return;
      }

      persistStayLoggedInPreference(rememberMe);
      dispatch({ type: "LOGIN_SUCCESS", payload: result });
      setShowSuccessPopup(true);

      setTimeout(() => {
        setShowSuccessPopup(false);
        const resumePath = sessionStorage.getItem("resume_after_login");
        const fallback = location.state?.from?.pathname
          ? `${location.state.from.pathname}${location.state.from.search || ""}`
          : "/";
        if (resumePath) {
          sessionStorage.removeItem("resume_after_login");
          navigate(resumePath);
          return;
        }
        navigate(fallback);
      }, 1200);
    } catch (err) {
      const raw = normalizeMessage(err?.message || "").toLowerCase();
      if (raw.includes("failed to fetch") || raw.includes("network") || raw.includes("load failed")) {
        setErrorMessage("Cannot reach the server. Check your connection and try again.");
      } else {
        setErrorMessage("Google sign-in failed. Please try again.");
      }
      setShowUnsuccessfulPopup(true);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    dispatch,
    location,
    navigate,
    normalizeMessage,
    persistStayLoggedInPreference,
    rememberMe,
    resolveLoginError,
  ]);

  useEffect(() => {
    if (!googleReady || !googleClientId) return;
    if (!googleButtonRef.current || !window.google?.accounts?.id) return;

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
    });
  }, [googleReady, googleClientId, handleGoogleCredential]);

  const handleSignUpClick = () => setShowContactPopup(true);

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full bg-blue-300/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-[-140px] h-[380px] w-[380px] rounded-full bg-indigo-300/20 blur-[140px]" />
      {/* Top brand bar */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur fixed inset-x-0 top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Brand avatar */}
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-sm grid place-items-center overflow-hidden">
                <img
                  src={DICT_GIF}
                  alt="DICT"
                  className="h-8 w-8 object-contain"
                />
              </div>
              {/* System title */}
              <div className="leading-tight">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900">
                  DICT Region 2 Inventory
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500">
                  Asset &amp; Supplies Management System
                </p>
              </div>
            </div>

            {/* Right-side hint */}
            <div className="hidden sm:flex items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full font-semibold bg-blue-600/10 text-blue-700 border border-blue-600/20">
                Production
              </span>
              <span className="hidden md:inline text-slate-500">
                DICT Regional Office II
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 pb-8 sm:pt-28 sm:pb-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
          {/* Left panel — form card */}
          <div className="w-full h-full flex flex-col">
            <div className="relative rounded-3xl bg-white border border-slate-200 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.2)] p-6 sm:p-8 h-full flex flex-col overflow-hidden">
              {/* Subtle top accent bar */}
              <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]" />

              <div className="flex-1">
                {/* Heading */}
                <div className="mb-2 pt-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {isReturning ? "Welcome back" : "Welcome"}
                  </h2>
                  <p className="mt-1 text-sm sm:text-[15px] text-slate-600">
                    {isReturning ? "Sign in to continue to " : "Sign in to access "}
                    <span className="font-semibold">
                      DICT Region 2 Inventory
                    </span>
                    .
                  </p>
                </div>

                {/* Form */}
                <form className="mt-4 sm:mt-6 space-y-4" onSubmit={handleSubmit}>
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs sm:text-[11px] font-semibold text-slate-500 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="username"
                      required
                      value={credentials.email}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                      placeholder="name@dict.gov.ph"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-xs sm:text-[11px] font-semibold text-slate-500 mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={credentials.password}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 my-1 mr-1 inline-flex items-center justify-center rounded-md px-3 text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {/* Stay logged in + Forgot */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <label className="inline-flex items-center gap-2 text-xs sm:text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400/50"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="select-none">Stay logged in</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleSignUpClick}
                      className="text-[11px] sm:text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline text-left sm:text-right"
                    >
                      Forgot password?{" "}
                      <span className="font-normal text-slate-500">
                        Contact your admin
                      </span>
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 ${
                        busy
                          ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                          : "bg-[linear-gradient(135deg,#1e3a8a,#0f172a)] hover:shadow-[0_18px_40px_-24px_rgba(30,58,138,0.45)]"
                      }`}
                    >
                      {busy ? "Signing in…" : "Log in"}
                    </button>

                    <button
                      type="button"
                      onClick={handleSignUpClick}
                      className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300"
                    >
                      Request Access
                    </button>
                  </div>

                  {/* Google sign-in */}
                  <div className="pt-3">
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-[10px] text-gray-500">
                        <span className="bg-white px-2 text-slate-500">
                          or continue with
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-center ${busy ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      {googleClientId ? (
                        <div ref={googleButtonRef} />
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          Google sign-in is not configured.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tiny note */}
                  <p className="text-[10px] sm:text-[11px] text-slate-500 pt-1">
                    By continuing, you agree to DICT Region 2 acceptable use
                    policies.
                  </p>
                </form>
              </div>

              {/* Footnote badges */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  Secure Access
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/20">
                  Region 2
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Right panel — brand visual */}
          <div className="hidden lg:flex items-stretch justify-center h-full">
            <div className="w-full rounded-3xl bg-white border border-slate-200 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.18)] p-6 flex flex-col items-center h-full">
              <img
                src={DICT_GIF}
                alt="DICT"
                className="max-w-full h-64 xl:h-72 object-contain"
              />
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  Department of Information and Communications Technology
                </p>
                <p className="text-xs text-slate-500">Regional Office II</p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 w-full">
                <Badge title="Supplies" />
                <Badge title="Equipment" />
                <Badge title="ICT" />
              </div>

              <p className="mt-3 text-[11px] text-slate-500 text-center max-w-xs">
                Track, manage, and safeguard{" "}
                <span className="font-semibold">DICT Region 2</span> assets in
                one centralized system.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Success Popup */}
      <Dialog
        open={showSuccessPopup}
        intent="success"
        title="Login Successful"
        description="Redirecting you to the dashboard..."
        primaryLabel="Go now"
        onPrimary={() => {
          setShowSuccessPopup(false);
          navigate("/");
        }}
      />

      {/* Unsuccessful Popup */}
      <Dialog
        open={showUnsuccessfulPopup}
        intent="error"
        title="Login Unsuccessful"
        description={errorMessage}
        primaryLabel="Close"
        onPrimary={() => setShowUnsuccessfulPopup(false)}
      />

      <Dialog
        open={showRateLimitPopup}
        intent="warning"
        title="Please wait to try again"
        description="Too many login attempts. Your access is temporarily limited."
        meta={`Try again in ${formatCountdown(rateLimitSeconds)}`}
        primaryLabel="OK"
        onPrimary={closeRateLimitPopup}
      />

      {/* Contact Admin Popup */}
      <Dialog
        open={showContactPopup}
        intent="info"
        title="Request Access"
        description="Please contact your administrator to create or reset your account."
        primaryLabel="Close"
        onPrimary={() => setShowContactPopup(false)}
      />
    </div>
  );
}

/* -------------------- small subcomponents -------------------- */

function Badge({ title }) {
  const key = String(title || "").toLowerCase();
  const tones = {
    supplies: {
      bg: "from-white via-white to-white",
      border: "border-slate-200/80",
      text: "text-slate-900",
      accent: "from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]",
      dot: "bg-[#1e3a8a]",
      glow: "bg-blue-500/10",
    },
    equipment: {
      bg: "from-white via-white to-white",
      border: "border-slate-200/80",
      text: "text-slate-900",
      accent: "from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]",
      dot: "bg-[#1e3a8a]",
      glow: "bg-blue-500/10",
    },
    ict: {
      bg: "from-white via-white to-white",
      border: "border-slate-200/80",
      text: "text-slate-900",
      accent: "from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]",
      dot: "bg-[#1e3a8a]",
      glow: "bg-blue-500/10",
    },
    default: {
      bg: "from-white via-white to-white",
      border: "border-slate-200/80",
      text: "text-slate-900",
      accent: "from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a]",
      dot: "bg-[#1e3a8a]",
      glow: "bg-blue-500/10",
    },
  };
  const tone = tones[key] || tones.default;

  return (
    <div
      className={`relative h-16 rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.bg} px-3 grid place-items-center text-xs font-semibold ${tone.text} shadow-[0_14px_28px_-22px_rgba(15,23,42,0.6)] overflow-hidden`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.accent}`} />
      <div className={`absolute -right-6 -bottom-6 h-14 w-14 rounded-full ${tone.glow}`} />
      <span className={`absolute left-3 top-3 h-2 w-2 rounded-full ${tone.dot}`} />
      <span className="relative z-10">{title}</span>
    </div>
  );
}

function Dialog({
  open = false,
  intent = "info",
  title,
  description,
  meta,
  primaryLabel,
  onPrimary,
}) {
  if (!open) return null;

  const variant =
    intent === "error" ? "danger" : intent === "success" ? "neutral" : "warning";
  const iconTone =
    intent === "success"
      ? "bg-emerald-100 text-emerald-700"
      : intent === "error"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-700";

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle="Account Access"
      variant={variant}
      onClose={onPrimary}
      maxWidthClass="max-w-sm"
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-full grid place-items-center ${iconTone}`}>
          {intent === "success" && (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {intent === "error" && (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {intent !== "success" && intent !== "error" && (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M12 8h.01M12 12v4"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            System Notice
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-xs text-gray-600">{description}</p>
          {meta ? (
            <p className="mt-3 text-xs font-semibold text-gray-900">{meta}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onPrimary}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
        >
          {primaryLabel || "OK"}
        </button>
      </div>
    </ModalShell>
  );
}
