const { chromium } = require('playwright');

const LOGIN = process.env.LOGIN;
const PASSWORD = process.env.PASSWORD;
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT = process.env.TG_CHAT;
const SITE_URL = 'https://azures.cloud';

const CONFIG = {
    color: { enabled: 1, streak: 4 },
    even:  { enabled: 0, streak: 5 },
    odd:   { enabled: 1, streak: 3 },
};

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(num) {
    if (num === 0) return 'green';
    if (RED.has(num)) return 'red';
    return 'black';
}

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
        const data = await res.json();
        console.log('📨', data.ok);
    } catch (e) {
        console.error('❌ Telegram ошибка:', e.message);
    }
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🌐 Открываем сайт...');
    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    console.log('🔐 Кликаем кнопку входа...');
    await page.click('a.tb--access-btn[href*="login"]');
    await page.waitForTimeout(3000);

    console.log('🔐 Ищем iframe логина...');
    await page.waitForSelector('iframe[src*="login.html"]', { timeout: 15000 });

    const loginFrameHandle = await page.$('iframe[src*="login.html"]');
    const loginFrame = await loginFrameHandle.contentFrame();

    if (!loginFrame) {
        await sendTelegram('❌ iframe логина не найден!');
        return;
    }

    console.log('🔐 Вводим данные...');
    await loginFrame.waitForSelector('input', { timeout: 10000 });
    const inputs = await loginFrame.$$('input');
    await inputs[0].fill(LOGIN);
    await inputs[1].fill(PASSWORD);

    const submitBtn = await loginFrame.$('button[type="submit"], button:has-text("Войти"), input[type="submit"]');
    if (submitBtn) {
        await submitBtn.click();
    } else {
        const btns = await loginFrame.$$('button');
        await btns[btns.length - 1].click();
    }

    await page.waitForTimeout(5000);
    console.log('✅ Вошли в аккаунт');

    console.log('⏳ Ждём рулетку...');
    try {
        await page.waitForSelector('iframe[src*="roulette-frontend"]', { timeout: 60000 });
        console.log('✅ Рулетка найдена');
    } catch (e) {
        console.error('❌ Рулетка не найдена:', e.message);
        await sendTelegram('❌ Рулетка не найдена, нужна помощь!');
        return;
    }

    let history = [];
    let lastAlertColor = null;
    let lastAlertEven = false;
    let lastAlertOdd = false;

    await sendTelegram('✅ Запущен на VPS');

    setInterval(async () => {
        try {
            const frame = page.frames().find(f => f.url().includes('roulette-frontend'));
            if (!frame) return;

            const numbers = await frame.$$eval('p', els =>
                els.map(el => parseInt(el.textContent.trim()))
                   .filter(n => Number.isInteger(n) && n >= 0 && n <= 36)
            );

            if (!numbers.length) return;
            const latest = numbers[0];
            if (history.length && history[0] === latest) return;
            history = numbers;
            console.log('🎯', latest, '| история:', numbers.slice(0, 5));

            if (CONFIG.color.enabled && numbers.length >= CONFIG.color.streak) {
                const colors = numbers.slice(0, CONFIG.color.streak).map(getColor);
                const first = colors[0];
                if (first !== 'green' && colors.every(c => c === first)) {
                    if (lastAlertColor !== first) {
                        lastAlertColor = first;
                        await sendTelegram(first === 'red' ? '⚫' : '🔴');
                    }
                } else {
                    lastAlertColor = null;
                }
            }

            if (CONFIG.even.enabled && numbers.length >= CONFIG.even.streak) {
                const parities = numbers.slice(0, CONFIG.even.streak).map(getParity);
                if (parities.every(p => p === 'even')) {
                    if (!lastAlertEven) { lastAlertEven = true; await sendTelegram('ODD'); }
                } else { lastAlertEven = false; }
            }

            if (CONFIG.odd.enabled && numbers.length >= CONFIG.odd.streak) {
                const parities = numbers.slice(0, CONFIG.odd.streak).map(getParity);
                if (parities.every(p => p === 'odd')) {
                    if (!lastAlertOdd) { lastAlertOdd = true; await sendTelegram('EVEN'); }
                } else { lastAlertOdd = false; }
            }

        } catch (e) {
            console.error('❌ Ошибка трекера:', e.message);
        }
    }, 3000);
}

main().catch(async (e) => {
    console.error('❌ Фатальная ошибка:', e.message);
    process.exit(1);
});
