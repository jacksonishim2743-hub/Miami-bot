FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY dist ./dist
COPY assets ./assets

ENV NODE_ENV=production

CMD ["npm", "start"]
