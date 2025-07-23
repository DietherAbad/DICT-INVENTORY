import React from "react";
import ReactDOM from "react-dom";
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

ReactDOM.render(
  <React.StrictMode>
    <AuthContextProvider>
    <Router>
      <App />
    </Router>
    </AuthContextProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
