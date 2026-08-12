import { createContext, useEffect, useReducer, useRef, useState } from 'react'

const USER_STORAGE_KEY = "user"
const STAY_LOGGED_IN_KEY = "stay_logged_in"

const parseStoredUser = (raw) => {
   if (!raw) return null
   try {
      return JSON.parse(raw)
   } catch {
      return null
   }
}

const loadStoredUser = () => {
   if (typeof window === "undefined") return null
   const preferPersistent = localStorage.getItem(STAY_LOGGED_IN_KEY) === "1"

   const localRaw = localStorage.getItem(USER_STORAGE_KEY)
   const sessionRaw = sessionStorage.getItem(USER_STORAGE_KEY)
   const localUser = parseStoredUser(localRaw)
   const sessionUser = parseStoredUser(sessionRaw)

   if (localRaw && !localUser) localStorage.removeItem(USER_STORAGE_KEY)
   if (sessionRaw && !sessionUser) sessionStorage.removeItem(USER_STORAGE_KEY)

   if (preferPersistent) {
      if (localUser) return localUser
      if (sessionUser) {
         localStorage.setItem(USER_STORAGE_KEY, sessionRaw)
         sessionStorage.removeItem(USER_STORAGE_KEY)
         return sessionUser
      }
      return null
   }

   if (sessionUser) return sessionUser
   if (localUser) return localUser
   return null
}

const DEFAULT_SESSION_SETTINGS = { enabled: true, minutes: 30 }

const normalizeSessionSettings = (raw) => {
   if (!raw || typeof raw !== "object") return DEFAULT_SESSION_SETTINGS
   const enabled =
      raw.session_timeout_enabled ??
      raw.enabled ??
      DEFAULT_SESSION_SETTINGS.enabled
   const minutesRaw =
      raw.session_timeout_minutes ??
      raw.minutes ??
      DEFAULT_SESSION_SETTINGS.minutes
   const minutes = Number.isFinite(Number(minutesRaw))
      ? Number(minutesRaw)
      : DEFAULT_SESSION_SETTINGS.minutes
   return {
      enabled: enabled !== false,
      minutes: minutes > 0 ? Math.floor(minutes) : DEFAULT_SESSION_SETTINGS.minutes,
   }
}

const loadSessionSettings = () => {
   if (typeof window === "undefined") return DEFAULT_SESSION_SETTINGS
   try {
      const raw = localStorage.getItem("systemSettings")
      if (!raw) return DEFAULT_SESSION_SETTINGS
      return normalizeSessionSettings(JSON.parse(raw))
   } catch {
      return DEFAULT_SESSION_SETTINGS
   }
}

const initial_state = {
   // user: localStorage.getItem("user") !== undefined ? JSON.stringify(localStorage.getItem("user")) : null,
   // user: localStorage.getItem("user") !== undefined ? localStorage.getItem("user") : null,
   user: loadStoredUser(),
   loading: false,
   error: null
}


export const AuthContext = createContext(initial_state)

const AuthReducer = (state, action) => {
   switch (action.type) {
      case 'LOGIN_START':
         return {
            user: null,
            loading: true,
            error: null
         }
      case 'LOGIN_SUCCESS':
         return {
            user: action.payload,
            loading: false,
            error: null
         }
      case 'LOGIN_FAILURE':
         return {
            user: null,
            loading: false,
            error: action.payload
         }
      case 'REGISTER_SUCCESS':
         return {
            user: null,
            loading: false,
            error: null
         }
      case 'LOGOUT':
         return {
            user: null,
            loading: false,
            error: null
         }

      default:
         return state
   }
}


export const AuthContextProvider = ({ children }) => {

   const [state, dispatch] = useReducer(AuthReducer, initial_state)
   const [sessionSettings, setSessionSettings] = useState(loadSessionSettings)
   const idleTimerRef = useRef(null)
   const fetchRef = useRef(null)
   const inflightRef = useRef(new Map())

   useEffect(() => {
      if (typeof window === "undefined") return
      if (!state.user) {
         localStorage.removeItem(USER_STORAGE_KEY)
         sessionStorage.removeItem(USER_STORAGE_KEY)
         return
      }
      const payload = JSON.stringify(state.user)
      const stayLoggedIn = localStorage.getItem(STAY_LOGGED_IN_KEY) === "1"
      if (stayLoggedIn) {
         localStorage.setItem(USER_STORAGE_KEY, payload)
         sessionStorage.removeItem(USER_STORAGE_KEY)
      } else {
         sessionStorage.setItem(USER_STORAGE_KEY, payload)
         localStorage.removeItem(USER_STORAGE_KEY)
      }
   }, [state.user])

   useEffect(() => {
      if (typeof window === "undefined") return
      if (!fetchRef.current) fetchRef.current = window.fetch.bind(window)

      const getActor = () =>
         state.user?.data?.email ||
         state.user?.email ||
         state.user?.data?.username ||
         state.user?.username ||
         "";

      window.fetch = (input, init = {}) => {
         const headers = new Headers(init.headers || {})
         const bearer = state.user?.token
         if (bearer && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${bearer}`)
         }
         const nextInit = {
            ...init,
            credentials: init.credentials || "include",
            headers,
         }
         const method = (init.method || "GET").toUpperCase()
         const url = typeof input === "string" ? input : input?.url || ""
         const hasSignal = Boolean(
            init?.signal || (typeof input === "object" && input?.signal)
         )

         if (
            process.env.NODE_ENV !== "production" &&
            method === "GET" &&
            !hasSignal
         ) {
            const key = `${method}:${url}`
            const now = Date.now()
            const existing = inflightRef.current.get(key)
            if (existing && now - existing.startedAt < 1000) {
               if (existing.baseResponse) {
                  return Promise.resolve(existing.baseResponse.clone())
               }
               return existing.promise.then((res) => res.clone())
            }

            const entry = { promise: null, startedAt: now, baseResponse: null }
            const promise = fetchRef.current(input, nextInit).then((res) => {
               entry.baseResponse = res
               return res
            })
            entry.promise = promise
            inflightRef.current.set(key, entry)

            promise.finally(() => {
               const current = inflightRef.current.get(key)
               if (current?.promise === promise) inflightRef.current.delete(key)
            })

            return promise.then((res) => res.clone())
         }

         return fetchRef.current(input, nextInit)
      }

      return () => {
         if (fetchRef.current) window.fetch = fetchRef.current
      }
   }, [state.user])

   useEffect(() => {
      if (typeof window === "undefined") return
      const handleUpdate = (event) => {
         const detail = event?.detail
         setSessionSettings(normalizeSessionSettings(detail))
      }
      window.addEventListener("settings:session-timeout", handleUpdate)
      return () => window.removeEventListener("settings:session-timeout", handleUpdate)
   }, [])

   useEffect(() => {
      if (!state.user) return

      const enabled = sessionSettings?.enabled !== false
      const minutes = Number(sessionSettings?.minutes || 0)
      const idleMs =
         enabled && Number.isFinite(minutes) && minutes > 0
            ? minutes * 60 * 1000
            : 0

      const clearIdleTimer = () => {
         if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      }

      const startIdleTimer = () => {
         clearIdleTimer()
         if (!idleMs) return
         idleTimerRef.current = setTimeout(() => {
            localStorage.removeItem(USER_STORAGE_KEY)
            sessionStorage.removeItem(USER_STORAGE_KEY)
            dispatch({ type: "LOGOUT" })
         }, idleMs)
      }

      const handleActivity = () => {
         if (!idleMs) return
         startIdleTimer()
      }

      startIdleTimer()
      const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
      if (idleMs) {
         events.forEach((event) =>
            window.addEventListener(event, handleActivity, { passive: true })
         )
      }

      return () => {
         clearIdleTimer()
         events.forEach((event) => window.removeEventListener(event, handleActivity))
      }
   }, [state.user, sessionSettings])

   return <AuthContext.Provider value={{
      user: state.user,
      loading: state.loading,
      error: state.error,
      dispatch,
   }}>
      {children}
   </AuthContext.Provider>
}
