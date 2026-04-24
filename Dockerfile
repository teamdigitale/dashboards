# Minimal image that runs the stats exporter as a cron-triggered job.
FROM denoland/deno:alpine-2.7.13@sha256:6fa741b10c9519dc8305f115356b0c7dc2782a8ec8fa1d14579dd2e9d1385721

WORKDIR /app

# Cache dependencies first for better layer reuse.
COPY deno.json ./
COPY src ./src
RUN deno cache src/main.ts

# Runs as non-root by default in the denoland image.
USER deno

ENV DATA_DIR=/data
VOLUME ["/data"]

ENTRYPOINT ["deno", "run", "-P", "src/main.ts"]
CMD ["--data-dir", "/data"]
