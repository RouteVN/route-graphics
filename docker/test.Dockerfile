# The environment CI runs the unit and CLI tests in: Linux, Node, Bun and the
# Playwright Chromium the CLI render specs launch. See scripts/testInContainer.mjs.
FROM node:22-bookworm

ARG BUN_VERSION=1.3.5
ARG PLAYWRIGHT_VERSION

RUN npm install -g bun@${BUN_VERSION} \
  && apt-get update \
  && apt-get install -y --no-install-recommends libexpat1 fontconfig \
  && npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/*
