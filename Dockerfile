FROM oven/bun:1.1.34

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY config.example.yaml ./config.example.yaml

RUN bun install --frozen-lockfile

CMD ["bun", "run", "src/index.ts"]
