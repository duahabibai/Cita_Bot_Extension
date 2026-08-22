import { loadFastDb, saveFastDb } from './db.js';
import TelegramBot from 'node-telegram-bot-api';
// We will export a function to just save whatever was scraped during the regular flow,
// Or we can create a dedicated scrapper. Since they want to "click through", we can just 
// hook into the existing save mechanism and inject saving to DB.
