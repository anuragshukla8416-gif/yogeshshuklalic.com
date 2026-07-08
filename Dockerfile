# ============================================================
# Yogesh Shukla Advisory — Backend Dockerfile
# ============================================================
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
