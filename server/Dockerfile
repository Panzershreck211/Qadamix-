FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
EXPOSE 4000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
