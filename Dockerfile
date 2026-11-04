# Production image: one container with the ASP.NET Core server serving the built web UI. The SQLite database, the keys and (by default)
# the backups live in /data.
#   docker build -t app:local .                       (the build arguments below are optional; start.ps1 and the CI workflow pass them)
#   docker run -p 8080:8080 -v appdata:/data app:local

FROM node:26-alpine AS frontend
WORKDIR /src
# The product name and the logo come from the brand files next to frontend/
COPY branding.json ./
COPY branding ./branding
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-fund --no-audit --ignore-scripts
COPY frontend ./frontend
RUN cd frontend && npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
# Directory.Build.props reads the product name from branding.json
COPY global.json Directory.Build.props Directory.Packages.props branding.json ./
COPY src/Cv.Server/Cv.Server.csproj ./src/Cv.Server/
RUN dotnet restore src/Cv.Server/Cv.Server.csproj
COPY src/Cv.Server ./src/Cv.Server
RUN dotnet publish src/Cv.Server/Cv.Server.csproj -c Release -o /app --no-restore -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# Version of the built commit: APP_VERSION = line 1 of version.txt (v2026.11.12), APP_VERSION_DETAIL = line 2 (the build id with the two
# counters). The app turns them into the readable form together with the channel ("dev", "beta", "release"). IMAGE_TAG is the technical
# tag (no spaces or parentheses) and becomes the OCI version label; empty = APP_VERSION.
ARG APP_VERSION=v0.0.0
ARG APP_VERSION_DETAIL=
ARG APP_CHANNEL=release
ARG APP_TITLE=App
ARG IMAGE_TAG=
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="${APP_TITLE}" \
      org.opencontainers.image.version="${IMAGE_TAG:-$APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/SushifluxDevelop/Vitafolio" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.vendor="SushiFlux Develop"
WORKDIR /app
COPY --from=backend /app ./
COPY --from=frontend /src/frontend/dist ./wwwroot
COPY LICENSE ./LICENSE
# The entrypoint starts as root only to hand /data to PUID/PGID, then drops to that user (setpriv, util-linux) - the app never runs as
# root. Carriage returns are stripped in case of a CRLF checkout. tzdata makes the TZ variable work (backup schedule, activity log);
# the last check fails the build if a future base image no longer ships setpriv or the time zone database.
COPY deploy/docker-entrypoint.sh deploy/healthcheck.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh /usr/local/bin/healthcheck.sh \
    && chmod 755 /usr/local/bin/docker-entrypoint.sh /usr/local/bin/healthcheck.sh \
    && printf '%s\n%s\n' "$APP_VERSION" "${APP_VERSION_DETAIL:-$APP_VERSION}" > /app/version.txt \
    && mkdir -p /data \
    && test -x /usr/bin/setpriv \
    && test -e /usr/share/zoneinfo/Europe/Berlin
# DOTNET_EnableDiagnostics=0: no diagnostic IPC sockets (dotnet-trace, dumps) in a production container
ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0 \
    DATA_DIR=/data \
    APP_CHANNEL=${APP_CHANNEL} \
    PUID=99 \
    PGID=100
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD ["/usr/local/bin/healthcheck.sh"]
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
