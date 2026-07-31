# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY --chmod=755 configure-runtime.sh /usr/local/bin/configure-runtime.sh
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 --from=builder /app/dist /usr/share/nginx/html

# COPY --chown owns the files, but the destination directory comes from the
# base image and remains root-owned. The unprivileged entrypoint needs to create
# temporary files alongside the static assets before atomically replacing them.
USER root
RUN chown 101:101 /usr/share/nginx/html
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/configure-runtime.sh"]
CMD ["nginx", "-g", "daemon off;"]
