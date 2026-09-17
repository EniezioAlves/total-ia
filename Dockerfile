FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Mesma origem que o Nginx (:8080). Não bakear VITE_GATEWAY_URL do .env local
# (127.0.0.1 vs localhost dispara CORS e o browser mostra "não foi possível conectar").
RUN VITE_GATEWAY_URL= npm run build

FROM nginx:1.27-alpine
COPY nginx.spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
