import { Env, TelegramUpdate, SendRichMessagePayload } from "./types";
import { getUserLanguage, setUserLanguage } from "./db";
import { t } from "./i18n";
import { sendTextMessage, sendRichMessage, answerCallbackQuery } from "./telegram";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/publish") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (request.method === "POST") {
        try {
          const body = (await request.json()) as any;
          if (body.chat_id && body.markdown) {
            const payload: SendRichMessagePayload = {
              chat_id: body.chat_id,
              rich_message: { markdown: body.markdown },
            };
            await sendRichMessage(env, payload);
            return new Response(JSON.stringify({ ok: true }), {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
              },
            });
          }
          return new Response(JSON.stringify({ error: "Missing payload" }), {
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        } catch (error) {
          console.error("[API Error] Failed to parse request");
          return new Response(JSON.stringify({ error: "Internal Error" }), {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }
      }
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secretHeader !== env.WEBHOOK_SECRET) {
        console.error("[Security Warning] Unauthorized Webhook signature rejected");
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const update: TelegramUpdate = await request.json();
        console.log(`[Webhook] Received update ID: ${update.update_id}`);
        await handleUpdate(env, update, request);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("[Webhook Error] Exception processing update:", error);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleUpdate(env: Env, update: TelegramUpdate, request: Request): Promise<void> {
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
      
      const appUrl = new URL(env.APP_URL);
      const host = request.headers.get("host") || "";
      appUrl.searchParams.set("api", `https://${host}/api/publish`);

      await sendTextMessage(env, chatId, text, {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: {
                url: appUrl.toString(),
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