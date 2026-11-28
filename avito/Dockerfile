FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium git xvfb x11vnc novnc websockify xauth \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.9.26

WORKDIR /app
COPY search-photos.patch /tmp/search-photos.patch
RUN git init . \
    && git fetch --depth=1 https://github.com/ermizin/avito-mcp.git 99a37a0497088d8f5ae73d19694f92568b18350f \
    && git checkout FETCH_HEAD \
    && git apply /tmp/search-photos.patch \
    && uv sync --locked --no-dev \
    && rm -rf .git \
    && useradd --create-home avito \
    && install -d -o avito -g avito /data

COPY start.sh /usr/local/bin/avito-start
USER avito
ENV AVITO_MCP_HOME=/data AVITO_MCP_CHROME=/usr/bin/chromium DISPLAY=:91
ENTRYPOINT ["/bin/sh", "/usr/local/bin/avito-start"]
