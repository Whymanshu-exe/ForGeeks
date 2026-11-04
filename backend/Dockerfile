FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER node
CMD ["npm", "start"]
