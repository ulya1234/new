import { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  APP_URL: string; 
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
  };
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InputRichMessage {
  markdown?: string;
  html?: string;
  is_rtl?: boolean;
  skip_entity_detection?: boolean;
}

export interface SendRichMessagePayload {
  chat_id: number | string;
  rich_message: InputRichMessage;
  disable_notification?: boolean;
  protect_content?: boolean;
}