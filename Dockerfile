FROM mcr.microsoft.com/playwright:v1.60.0-jammy

RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install
COPY bot.js .

# Устанавливаем DISPLAY переменную
ENV DISPLAY=:99

# Запускаем виртуальный дисплей и скрипт
CMD Xvfb :99 -screen 0 1280x720x16 & \
    fluxbox & \
    x11vnc -display :99 -forever -nopw -shared & \
    node bot.js
