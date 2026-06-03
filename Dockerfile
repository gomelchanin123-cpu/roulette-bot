FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package.json .
RUN npm install
COPY bot.js .
CMD ["node", "bot.js"]
