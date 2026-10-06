# Веб-версия приложения водителя (для демо в браузере; на телефоны — через Expo Go / EAS Build)
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API на том же адресе, что и приложение: nginx проксирует /api на сервер
ENV EXPO_PUBLIC_API_URL=same-origin
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
