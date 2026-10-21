FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

RUN npm rebuild better-sqlite3 --build-from-source

COPY . .
RUN npm run build

ENV NODE_ENV=production

CMD ["sh", "-c", "node_modules/.bin/next start -p ${PORT:-3000} -H 0.0.0.0"]
