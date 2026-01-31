FROM oven/bun:1.3-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY config.example.yaml ./config.example.yaml

RUN bun install --frozen-lockfile

CMD ["bun", "run", "src/index.ts"]
