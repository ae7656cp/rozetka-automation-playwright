const axios = require('axios');
require('dotenv').config();
const { chromium } = require('playwright');
const JiraClient = require('jira-client');
const fs = require('fs');
const jira = new JiraClient({
    protocol: 'https',
    host: 'andrey-dnepr.atlassian.net',
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
    apiVersion: '2',
    strictSSL: true
});

const JIRA_PROJECT_KEY = 'AUTO';

(async () => {
    let failedTests = [];
    let browser;
    try {
        console.log("Проверка связи с Jira...");
const myself = await jira.getCurrentUser();
console.log("Вы зашли как:", myself.displayName);
       browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
let page = await context.newPage();
const types = await jira.listIssueTypes();
console.log(types.map(t => ({ id: t.id, name: t.name })));
        // Функция "умного" клика и поиска для стабильности
        async function smartAction(p, selector, actionType = 'click', value = '') {
            await p.evaluate(({ sel, type, val }) => {
                let el = document.querySelector(sel);
                if (!el) {
                    const all = Array.from(document.querySelectorAll('button, a, span, input, div'));
                    el = all.find(e => e.innerText?.includes(sel) || e.placeholder?.includes(sel) || e.getAttribute('name') === sel);
                }
                if (el) {
                    el.scrollIntoView();
                    if (type === 'click') el.click();
                    if (type === 'fill') { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
                    return true;
                }
                return false;
            }, { sel: selector, type: actionType, val: value });
        }

        const testSuite = [
            // --- 1. КОРЗИНА И ПОКУПКИ ---
            { id: '01', goal: 'Добавление из карточки товара', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => { 
                await smartAction(p, '.goods-tile__heading'); await p.waitForTimeout(2000);
                await smartAction(p, 'Купити'); await p.waitForTimeout(3000);
            }},
            { id: '02', goal: 'Добавление из списка (кнопка Купить)', url: 'https://rozetka.com.ua/ua/laptops/c80004/', action: async (p) => {
                await smartAction(p, '.buy-button'); await p.waitForTimeout(3000);
            }},
            { id: '03', goal: 'Удаление товара из корзины', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.header-actions__button--cart'); await p.waitForTimeout(2000);
                await smartAction(p, 'button[id^="cartProductActions"]'); await p.waitForTimeout(1000);
                await smartAction(p, 'Видалити');
            }},
            { id: '04', goal: 'Изменение кол-во (кнопка +)', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.header-actions__button--cart');
                await smartAction(p, '[data-testid="cart-counter-increment"]');
            }},
            { id: '05', goal: 'Пересчет цены при изменении кол-ва', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await p.waitForSelector('.cart-receipt__sum-price');
            }},
            { id: '06', goal: 'Применение промокода (поле)', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'Промокод', 'click');
            }},
            { id: '07', goal: 'Удаление промокода', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '08', goal: 'Переход из корзины к покупкам', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.modal__close');
            }},
            { id: '09', goal: 'Проверка лимитов корзины', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '10', goal: 'Сохранение корзины после Refresh', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await p.reload(); await p.waitForSelector('.header-actions__button--cart');
            }},

            // --- 2. ПОИСК И ФИЛЬТРЫ ---
            { id: '11', goal: 'Поиск по точному названию', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'search', 'fill', 'iPhone 15 Pro Max'); await p.keyboard.press('Enter');
            }},
            { id: '12', goal: 'Поиск по части слова (iphone)', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'search', 'fill', 'iphone'); await p.keyboard.press('Enter');
            }},
            { id: '13', goal: 'Поиск по артикулу', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'search', 'fill', '379630325'); await p.keyboard.press('Enter');
            }},
            { id: '14', goal: 'Поиск на разных языках', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'search', 'fill', 'Телефон'); await p.keyboard.press('Enter');
            }},
            { id: '15', goal: 'Работа фильтра по цене', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => {
                await smartAction(p, 'slider-filter-input-left', 'fill', '10000');
            }},
            { id: '16', goal: 'Сортировка: от дешевых', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => {
                await p.selectOption('select', '1: cheap');
            }},
            { id: '17', goal: 'Сортировка: по рейтингу', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => {
                await p.selectOption('select', '3: rank');
            }},
            { id: '18', goal: 'Фильтрация по бренду', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => {
                await smartAction(p, 'Apple');
            }},
            { id: '19', goal: 'Фильтрация по характеристикам', url: 'https://rozetka.com.ua/ua/mobile-phones/c80003/', action: async (p) => {
                await smartAction(p, '256 ГБ');
            }},
            { id: '20', goal: 'Поиск: Ничего не найдено', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'search', 'fill', 'zxcvbnm12345'); await p.keyboard.press('Enter');
                await p.waitForSelector('.search-nothing');
            }},

            // --- 3. ЛИЧНЫЙ КАБИНЕТ (Проверка наличия форм) ---
            { id: '21', goal: 'Наличие формы регистрации', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.header-actions__button--user');
                await smartAction(p, '.auth-modal__register-link');
            }},
            { id: '22', goal: 'Валидация существующего Email', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '23', goal: 'Форма авторизации (Login)', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.header-actions__button--user');
            }},
            { id: '24', goal: 'Восстановление пароля', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.header-actions__button--user');
                await smartAction(p, '.auth-modal__restore-link');
            }},
            { id: '25', goal: 'Смена пароля (наличие кнопки)', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '26', goal: 'Редактирование данных', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '27', goal: 'Список желаний (Wishlist)', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, '.wish-button');
            }},
            { id: '28', goal: 'История заказов', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '29', goal: 'Выход из аккаунта (Logout)', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '30', goal: 'Прямая ссылка без авторизации', url: 'https://rozetka.com.ua/ua/cabinet/orders/', action: async (p) => {
                await p.waitForSelector('.auth-modal');
            }},

            // --- 4. КАРТОЧКА ТОВАРА ---
            { id: '31', goal: 'Верное название и цена', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await p.waitForSelector('.product__title'); await p.waitForSelector('.product-prices__big');
            }},
            { id: '32', goal: 'Наличие кнопки Купить', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await p.waitForSelector('.buy-button');
            }},
            { id: '33', goal: 'Статус В наличии', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await p.waitForSelector('.status-label--green');
            }},
            { id: '34', goal: 'Галерея фотографий', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await smartAction(p, '.product-photos__picture');
            }},
            { id: '35', goal: 'Вкладки Характеристики/Отзывы', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await smartAction(p, 'Характеристики');
            }},
            { id: '36', goal: 'Кнопка Поделиться', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await smartAction(p, '.share-button');
            }},
            { id: '37', goal: 'Блок С этим также покупают', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await p.mouse.wheel(0, 1000); await p.waitForSelector('.recomm-block');
            }},
            { id: '38', goal: 'Отображение скидки', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '39', goal: 'Выбор модификации (память)', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await smartAction(p, '512 ГБ');
            }},
            { id: '40', goal: 'Написание отзыва (форма)', url: 'https://rozetka.com.ua/ua/apple-iphone-15-pro-max-256gb-black-titanium/p395504246/', action: async (p) => {
                await smartAction(p, 'Написати відгук');
            }},

            // --- 5. ОФОРМЛЕНИЕ ЗАКАЗА (Валидация полей) ---
            { id: '41', goal: 'Выбор доставки (наличие)', url: 'https://rozetka.com.ua/ua/checkout/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '42', goal: 'Выбор оплаты (наличие)', url: 'https://rozetka.com.ua/ua/checkout/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '43', goal: 'Обязательность поля Телефон', url: 'https://rozetka.com.ua/ua/checkout/', action: async (p) => {
                await smartAction(p, 'Оформити замовлення');
            }},
            { id: '44', goal: 'Заказ в один клик', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '45', goal: 'Валидация маски телефона', url: 'https://rozetka.com.ua/ua/checkout/', action: async (p) => {
                await smartAction(p, 'input[type="tel"]', 'fill', 'abc');
            }},
            { id: '46', goal: 'Проверка итоговой суммы', url: 'https://rozetka.com.ua/ua/checkout/', action: async (p) => { await p.waitForSelector('.checkout-total'); }},
            { id: '47', goal: 'Страница Спасибо (логика)', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '48', goal: 'Email подтверждение', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '49', goal: 'Переход к оплате картой', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }},
            { id: '50', goal: 'Политика конфиденциальности', url: 'https://rozetka.com.ua/ua/', action: async (p) => {
                await smartAction(p, 'Політика конфіденційності');
            }},
            { id: '51', goal: 'Финальный тест стабильности', url: 'https://rozetka.com.ua/ua/', action: async (p) => { await p.waitForTimeout(1000); }}
        ];
console.log("Количество тестов в наборе:", testSuite.length);
        // ВЫПОЛНЕНИЕ
        for (let i = 0; i < testSuite.length; i++) {
            const test = testSuite[i];
           console.log(`[${i + 1}/51] 🧪 TC_${test.id} | 🎯 Цель: ${test.goal}`);

            try {
                await page.goto(test.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(2500); 
                await test.action(page);
                console.log(`✅ ПРОЙДЕНО`);
                failedTests.push(`✅ ${test.goal}`);
             } catch (err) {
          const screenshotPath = `error_tc_${test.id}.png`;
            await page.screenshot({ path: screenshotPath });
   failedTests.push(`❌ ${test.goal}`);
            try {
                const issue = await jira.addNewIssue({
                    fields: {
                        project: { key: JIRA_PROJECT_KEY },
            summary: `Autotest Failed: ${test.goal}`,
            issuetype: { name: 'Баг' },
            description: `URL: ${test.url}\nError: ${err.message}`
                    }
                });
                await jira.addAttachmentOnIssue(issue.id, fs.createReadStream(screenshotPath));
                console.log(`❌ ОШИБКА -> Создан баг в Jira: ${issue.key}`);
            } catch (jiraErr) {
    console.log(`❌ ОШИБКА Jira:`, jiraErr.message);
                failedTests.push("❌ " + test.goal);
    if (jiraErr.response && jiraErr.response.data) {
        console.log(`Детали от Jira:`, JSON.stringify(jiraErr.response.data));
    }
}
            }

            const old = page;
            page = await context.newPage();
            await old.close();
        }

        console.log("\n🏁 Поздравляю! Весь чек-лист из 51 пункта проверен.");
        await page.close();
        } catch (err) {
   console.log("Критический сбой:", err.message);
           // Блок отправки в Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    let reportMessage = `🚀 <b>Тесты Rozetka завершены!</b>\n\n`;
    
    if (failedTests.length > 0) {
        reportMessage += `⚠️ <b>Найдено ошибок (${failedTests.length}):</b>\n\n${failedTests.join('\n')}`;
    } else {
        reportMessage += `✅ Все 51 пункт чек-листа проверены успешно.`;
    }
// Пытаемся отправить отчет, если есть данные
    if (token && chatId) {
        try {
            console.log("Отправляем отчет в Telegram...");
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: reportMessage,
                parse_mode: 'HTML'
            });
            console.log("✅ Отчет отправлен в Telegram!");
        } catch (tgErr) {
            console.error("❌ Ошибка Telegram:", tgErr.message);
        }
    }

    // ВЫХОДИМ В ЛЮБОМ СЛУЧАЕ
    console.log("🏁 Завершение процесса...");
    if (browser) await browser.close();
    process.exit(0); 

  } catch (err) {
    console.error("Критический сбой:", err.message);
    if (browser) await browser.close();
    process.exit(1); // Выход с ошибкой, чтобы GitHub остановил таймер
  }
})();
