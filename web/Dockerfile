FROM node:22-alpine
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web .
ENV PORT=2327
EXPOSE 2327
CMD ["npm", "run", "dev"]
