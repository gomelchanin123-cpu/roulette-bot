FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app
COPY package.json .
RUN npm install
COPY bot.js .
CMD ["node", "bot.js"]
