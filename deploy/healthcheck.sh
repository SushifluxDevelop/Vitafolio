#!/bin/bash
# Container health check: GET /api/health on the app's own port. The runtime image has no curl or wget, so this uses bash's /dev/tcp.
set -eu
port="${ASPNETCORE_HTTP_PORTS:-8080}"
port="${port%%;*}"
exec 3<>"/dev/tcp/127.0.0.1/${port}"
printf 'GET /api/health HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
response="$(cat <&3)"
case "$response" in
    *'"status":"ok"'*) exit 0 ;;
    *)
        echo "Health-Check fehlgeschlagen: $response" >&2
        exit 1
        ;;
esac
