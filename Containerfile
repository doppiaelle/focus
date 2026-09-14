FROM node:20-alpine

WORKDIR /app

# Backend dependencies
COPY backend/package.json backend/
RUN cd backend && npm install --omit=dev

# Backend code
COPY backend/ backend/

# Frontend → dist (server.js serves from ../dist relative to __dirname)
COPY index.html dist/
COPY manifest.json dist/
COPY sw.js dist/
COPY css/ dist/css/
COPY js/ dist/js/
COPY icons/ dist/icons/

RUN mkdir -p /app/data

ENV PORT=3001
ENV DB_PATH=/app/data/focus.db

EXPOSE 3001

VOLUME /app/data

WORKDIR /app/backend
CMD ["node", "server.js"]
