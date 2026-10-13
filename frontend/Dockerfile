# Steg 1: installera paket och bygg sajten
FROM node:24-slim AS build

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Adressen till backend inuti Docker-nätverket. Behövs redan när sajten byggs,
# eftersom Next.js "bakar in" vidarekopplingen (rewrites) i bygget.
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=$BACKEND_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Steg 2: en liten image som bara innehåller den färdiga servern.
# node_modules och källkoden från steg 1 följer inte med, så imagen
# blir några hundra MB i stället för över en GB.
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
