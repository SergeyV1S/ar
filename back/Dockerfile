FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY tsconfig*.json ./
COPY src ./src
RUN yarn build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY --from=build /app/dist ./dist
COPY certs ./certs
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
