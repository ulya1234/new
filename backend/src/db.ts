import { D1Database } from "@cloudflare/workers-types";

export async function getUserLanguage(db: D1Database, userId: number): Promise<string> {
  try {
    const result = await db
      .prepare("SELECT language FROM users WHERE user_id = ?")
      .bind(userId)
      .first<{ language: string }>();

    if (!result) {
      console.log(`[DB] User ${userId} not found in database, defaulting to 'en'`);
      return "en";
    }

    console.log(`[DB] Retrieved language '${result.language}' for user ${userId}`);
    return result.language;
  } catch (error) {
    console.error("[DB] Failed to get user language:", error);
    return "en";
  }
}

export async function setUserLanguage(db: D1Database, userId: number, language: string): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO users (user_id, language) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language"
      )
      .bind(userId, language)
      .run();

    console.log(`[DB] Updated language to '${language}' for user ${userId}`);
  } catch (error) {
    console.error("[DB] Failed to update user language:", error);
    throw error;
  }
}