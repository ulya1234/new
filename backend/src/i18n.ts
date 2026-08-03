import en from "./locales/en.json";
import id from "./locales/id.json";

export type LocaleKey = keyof typeof en | keyof typeof id;

export function t(lang: string, key: string): string {
  const translations: Record<string, string> = lang === "id" ? id : en;
  const fallbackTranslations: Record<string, string> = en;
  return translations[key] || fallbackTranslations[key] || key;
}