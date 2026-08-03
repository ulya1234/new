import { Env, SendRichMessagePayload } from "./types";

export async function callTelegramApi(
  token: string,
  method: string,
  payload: Record<string, any>
): Promise<any> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  console.log(`[Telegram API] Sending POST request to method: ${method}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: any;
    };

    if (!data.ok) {
      console.error(`[Telegram API Error] Method: ${method} failed | Reason: ${data.description}`);
      throw new Error(data.description || "Telegram API call failed");
    }

    console.log(`[Telegram API] Method ${method} completed successfully`);
    return data.result;
  } catch (error) {
    console.error(`[Telegram API Exception] Exception in method ${method}:`, error);
    throw error;
  }
}

export async function sendTextMessage(
  env: Env,
  chatId: number,
  text: string,
  replyMarkup?: Record<string, any>
): Promise<void> {
  await callTelegramApi(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
  });
}

export async function sendRichMessage(
  env: Env,
  payload: SendRichMessagePayload
): Promise<void> {
  console.log(`[Telegram API] Dispatching Rich Article to chat ${payload.chat_id}`);
  await callTelegramApi(env.TELEGRAM_BOT_TOKEN, "sendRichMessage", {
    chat_id: payload.chat_id,
    rich_message: payload.rich_message,
    disable_notification: payload.disable_notification,
    protect_content: payload.protect_content,
  });
}

export async function answerCallbackQuery(
  env: Env,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await callTelegramApi(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text,
  });
}