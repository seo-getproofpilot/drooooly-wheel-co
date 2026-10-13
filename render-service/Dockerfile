# Studio shot render service. Build context is the REPO ROOT:
#   docker build -f render-service/Dockerfile -t droooly-render .
# Railway: rootDirectory "/", dockerfilePath "render-service/Dockerfile".
#
# node:22 slim plus Playwright's Chromium headless shell only (the official
# Playwright image also carries Firefox and WebKit, about 1 GB we never run),
# plus Blender 5.2 LTS for Cycles on the CPU. Blender ships x64 Linux builds
# only, so the platform is pinned (Railway is amd64; an Apple-silicon Mac
# builds and runs it under emulation).
FROM --platform=linux/amd64 node:22-bookworm-slim

ARG BLENDER_VERSION=5.2.2
ARG BLENDER_SHA256=84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production

# Blender runtime libraries, fonts for the credit line, and the tools to fetch Blender.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils \
      libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 libice6 libegl1 libgomp1 \
      fonts-dejavu-core fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Blender, checksum-pinned. Docs and the bundled Python's test suite are dropped.
RUN curl -fsSL -o /tmp/blender.tar.xz \
      "https://download.blender.org/release/Blender${BLENDER_VERSION%.*}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
    && echo "${BLENDER_SHA256}  /tmp/blender.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm -rf /tmp/blender.tar.xz \
    && find /opt/blender -type d -path "*/python/lib/python*/test" -prune -exec rm -rf {} + \
    && /opt/blender/blender --version > /tmp/blender-version \
    && head -1 /tmp/blender-version && rm /tmp/blender-version

WORKDIR /app/render-service
COPY render-service/package.json render-service/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm /root/.cache

COPY render-service/src ./src
COPY tools/3d/render-offline.py /app/tools/3d/render-offline.py
# The baked configurator (built by `npm run build` in configurator/). It also
# carries hdri/ and textures/, which render-offline.py reads via DROOOLY_ASSET_ROOT.
COPY visualize /app/visualize

ENV PORT=8080 \
    RENDER_SAMPLES=32 \
    RENDER_LONG_SIDE=1400 \
    RENDER_DEVICE=CPU \
    RENDER_CACHE_DIR=/data/stills \
    BLENDER_BIN=/opt/blender/blender \
    VISUALIZE_DIR=/app/visualize \
    RENDER_SCRIPT=/app/tools/3d/render-offline.py

EXPOSE 8080
CMD ["node", "src/server.js"]
