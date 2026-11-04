FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER node
CMD ["npm", "start"]
