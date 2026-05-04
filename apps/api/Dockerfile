FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json tsconfig.build.json jest.config.cjs jest.integration.config.cjs .eslintrc.cjs .sequelizerc ./
COPY config ./config
COPY migrations ./migrations
COPY src ./src
RUN npm run build

FROM node:20-alpine
RUN addgroup -g 1001 mirai && adduser -D -u 1001 -G mirai mirai
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY config ./config
COPY migrations ./migrations
COPY .sequelizerc ./
USER mirai
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node dist/server.js"]
