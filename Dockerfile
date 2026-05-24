FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Install Bun (unzip required by the Bun installer)
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ ./src/
COPY tsconfig.json ./

# Playwright browsers are pre-installed in the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
