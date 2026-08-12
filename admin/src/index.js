import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthContextProvider } from "./context/AuthContext";
import {
  Chart,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  LineController,
  BarController,
  PieController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip,
} from "chart.js";
import { HashRouter as Router } from "react-router-dom";
import { setupApiClient } from "./utils/api";

Chart.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  LineController,
  BarController,
  PieController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip
);

setupApiClient({ retries: 2, retryDelayMs: 400 });

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthContextProvider>
    <Router>
      <App />
    </Router>
    </AuthContextProvider>
  </React.StrictMode>,
  document.getElementById("root")
);

if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const waitForActivation = (worker) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              window.location.reload();
            }
          });
        };

        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent("pwa:update-ready"));
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(new CustomEvent("pwa:update-ready"));
            }
          });
        });

        window.addEventListener("pwa:refresh", () => {
          if (!registration.waiting) return;
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          waitForActivation(registration.waiting);
        });
      })
      .catch(() => {
        // no-op: SW registration failure should not block the app
      });
  });
}
