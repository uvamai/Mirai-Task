# Build context must be the monorepo root (see docker-compose.yml).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm ci && npm run build -w @mirai/web

FROM nginx:alpine
COPY apps/web/nginx.docker.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
