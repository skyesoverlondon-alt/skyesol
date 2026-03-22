FROM node:20-alpine

RUN apk add --no-cache postgresql16-client bash
WORKDIR /app

COPY services/runner/package.json ./package.json
COPY services/runner/package-lock.json* ./
RUN npm install --omit=dev

COPY services/runner/src ./src
COPY database /database

CMD ["node", "src/index.js"]
