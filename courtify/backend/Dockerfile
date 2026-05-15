FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache python3 make g++

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile
COPY packages/types packages/types
COPY backend backend
RUN pnpm --filter @courtify/backend run build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY backend/package.json backend/
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/backend/dist ./backend/dist
RUN mkdir -p /app/data /app/uploads/avatars
EXPOSE 5000
CMD ["node", "backend/dist/server.js"]
