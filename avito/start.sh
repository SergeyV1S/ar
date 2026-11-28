#!/bin/sh
set -eu
exec 9>/data/.profile.lock
flock -n 9
rm -f /data/chrome-profile/SingletonLock /data/chrome-profile/SingletonSocket /data/chrome-profile/SingletonCookie
Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp &
x11vnc -display "$DISPLAY" -rfbport 5900 -localhost -forever -shared -nopw -wait 50 &
websockify --web=/usr/share/novnc 6080 127.0.0.1:5900 &
exec /app/.venv/bin/python -m avito_mcp
