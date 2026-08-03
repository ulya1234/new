import { Env, TelegramUpdate, SendRichMessagePayload } from "./types";
import { getUserLanguage, setUserLanguage } from "./db";
import { t } from "./i18n";
import { sendTextMessage, sendRichMessage, answerCallbackQuery } from "./telegram";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/webhook") {
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secretHeader !== env.WEBHOOK_SECRET) {
        console.error("[Security Warning] Unauthorized Webhook signature rejected");
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const update: TelegramUpdate = await request.json();
        console.log(`[Webhook] Received update ID: ${update.update_id}`);
        await handleUpdate(env, update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("[Webhook Error] Exception processing update:", error);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      console.error("[Handler Error] Received message without valid User ID");
      return;
    }

    const userLang = await getUserLanguage(env.DB, userId);

    if (message.text === "/start") {
      console.log(`[Handler] Command /start executed by user ${userId}`);
      const text = t(userLang, "welcome");
      const buttonText = t(userLang, "open_editor");

      await sendTextMessage(env, chatId, text, {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: {
                url: env.MINIAPP_URL,
              },
            },
          ],
        ],
      });
      return;
    }

    if (message.text === "/lang") {
      console.log(`[Handler] Command /lang executed by user ${userId}`);
      const text = t(userLang, "choose_language");

      await sendTextMessage(env, chatId, text, {
        inline_keyboard: [
          [
            { text: "English", callback_data: "set_lang_en" },
            { text: "Bahasa Indonesia", callback_data: "set_lang_id" },
          ],
        ],
      });
      return;
    }

    if ((message as any).web_app_data) {
      console.log(`[Handler] Web App data payload received from user ${userId}`);
      const rawData = (message as any).web_app_data.data;
      console.log(`[Handler] Raw payload: ${rawData}`);

      try {
        const parsed = JSON.parse(rawData);
        if (parsed.markdown) {
          console.log("[Handler] Sending Rich Message via Telegram Bot API 10.1/10.2");
          const payload: SendRichMessagePayload = {
            chat_id: chatId,
            rich_message: {
              markdown: parsed.markdown,
            },
          };

          await sendRichMessage(env, payload);
          await sendTextMessage(env, chatId, t(userLang, "article_sent"));
          console.log(`[Handler] Rich Article delivered successfully to chat ${chatId}`);
        }
      } catch (error: any) {
        console.error("[Handler Error] Failed to publish Rich Article:", error);
        const errDetail = error?.message || "Unknown error";
        await sendTextMessage(env, chatId, `⚠️ Delivery failed: ${errDetail}`);
      }
      return;
    }
  }

  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;

    console.log(`[Handler] Callback Query '${data}' from user ${userId}`);

    if (chatId && data && data.startsWith("set_lang_")) {
      const selectedLang = data.replace("set_lang_", "");
      await setUserLanguage(env.DB, userId, selectedLang);
      const newText = t(selectedLang, "language_updated");

      await answerCallbackQuery(env, callbackQuery.id, newText);
      await sendTextMessage(env, chatId, newText);
    }
  }
}