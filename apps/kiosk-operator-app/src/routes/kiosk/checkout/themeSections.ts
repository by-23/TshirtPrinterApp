import { settingsSectionId } from "../../../components/settingsPanelUi.js";
import { themeSectionProps } from "../../../lib/themePick.js";

export const CHECKOUT_THEME_SECTIONS = {
  spacing: settingsSectionId("Отступы между блоками"),
  header: settingsSectionId("Шапка"),
  preview: settingsSectionId("Превью дизайна (левая колонка)"),
  summary: settingsSectionId("Сводка заказа (ВАШ ЗАКАЗ)"),
  paymentTitle: settingsSectionId("Способ оплаты — заголовок"),
  qrCard: settingsSectionId("Карточка «Оплата по QR»"),
  cashCard: settingsSectionId("Карточка «Оплата в кассу»"),
  steps: settingsSectionId("Шаги «КАК ОПЛАТИТЬ ПО QR»"),
  infoBar: settingsSectionId("Инфо-бар"),
  footerHelp: settingsSectionId("Футер — «Нужна помощь?»"),
  footerPromo: settingsSectionId("Футер — «Поделись результатом»"),
  accepted: settingsSectionId("Плашка «Заказ принят»"),
} as const;

export function checkoutThemeSection(key: keyof typeof CHECKOUT_THEME_SECTIONS) {
  return themeSectionProps(CHECKOUT_THEME_SECTIONS[key]);
}
