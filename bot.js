const { chromium } = require('playwright');

const LOGIN = process.env.LOGIN;
const PASSWORD = process.env.PASSWORD;
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT = process.env.TG_CHAT;
const SITE_URL = 'https://pm.by/ru/';

const CONFIG = {
    odd: { enabled: 1, streak: 4 }
};

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getParity(num) {
    if (num === 0) return null;
    return num % 2 === 0 ? 'even' : 'odd';
}

async function sendTelegram(text) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT, text })
        });
        console.log('📨', text);
    } catch (e) {
        console.error('❌ Telegram ошибка:', e.message);
    }
}

async function main() {
    const browser = await chromium.launch({ 
        headless: false,  // Важно: false
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    console.log('🌐 Открываем сайт...');
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('🔐 Кликаем кнопку Войти...');
    
    // Ждём 5 секунд для ручного входа (опционально)
    await page.waitForTimeout(5000);
    
    // Пробуем найти и кликнуть кнопку
    try {
        await page.click('span:has-text("Войти")', { timeout: 5000 });
    } catch(e) {
        console.log('Кнопка не найдена, возможно уже залогинены');
    }
    
    console.log('⏳ Ждём рулетку...');
    await page.waitForTimeout(10000);
    
    console.log('✅ Скрипт запущен');

    let history = [];
    let lastAlertOdd = false;

    await sendTelegram('✅ Запущен на VPS');

    setInterval(async () => {
        try {
            const frames = page.frames();
            const frame = frames.find(f => f.url().includes('roulette-frontend'));
            if (!frame) return;

            const numbers = await frame.$$eval('p', els =>
                els.map(el => parseInt(el.textContent?.trim() || ''))
                   .filter(n => !isNaN(n) && n >= 0 && n <= 36)
            );

            if (!numbers.length) return;
            const latest = numbers[0];
            if (history[0] === latest) return;
            history = numbers;
            console.log('🎯', latest);

            if (CONFIG.odd.enabled && numbers.length >= CONFIG.odd.streak) {
                const parities = numbers.slice(0, CONFIG.odd.streak).map(getParity);
                if (parities.every(p => p === 'odd')) {
                    if (!lastAlertOdd) {
                        lastAlertOdd = true;
                        await sendTelegram('EVEN');
                    }
                } else {
                    lastAlertOdd = false;
                }
            }
        } catch (e) {
            console.error('❌ Ошибка:', e.message);
        }
    }, 3000);
}

main().catch(console.error);
