import client from "prom-client";

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
});

register.registerMetric(httpRequestDuration);

export const observeHttpDuration = (method, route, statusCode, seconds) => {
  httpRequestDuration.labels(method, route, String(statusCode)).observe(seconds);
};

export const metricsRegistry = register;
