# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired (still Node 16)
ARG NODE_VERSION=16.20.2
FROM node:${NODE_VERSION}-bullseye-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# ---------- Build stage ----------
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential pkg-config python3 && \
    rm -rf /var/lib/apt/lists/*

# Install node modules
COPY --link package-lock.json package.json ./
RUN npm ci

# Copy application code
COPY --link . .

# ---------- Final runtime image ----------
FROM base

# Copy built application from build stage
COPY --from=build /app /app

# Your app should listen on process.env.PORT inside the code,
# but EXPOSE is fine to keep at 4000 (or change to whatever you use)
EXPOSE 4000

# Start the server by default, this can be overwritten at runtime
CMD [ "npm", "start" ]
