import { settingsSectionId } from "../../../components/settingsPanelUi.js";
import { themeSectionProps } from "../../../lib/themePick.js";

export const AI_THEME_SECTIONS = {
  header: settingsSectionId("Шапка"),
  back: settingsSectionId("Кнопка «Назад»"),
  sourceTitle: settingsSectionId("Заголовок экрана"),
  sourceGrid: settingsSectionId("Сетка карточек"),
  cameraCard: settingsSectionId("Карточка «Камера» — фон и рамка"),
  phoneCard: settingsSectionId("Карточка «Телефон» — фон и рамка"),
  qrScreen: settingsSectionId("QR — экран"),
  qrHeader: settingsSectionId("QR — заголовок"),
  qrCard: settingsSectionId("QR — карточка"),
  qrCode: settingsSectionId("QR — код"),
  qrTimer: settingsSectionId("QR — таймер"),
  qrWaiting: settingsSectionId("QR — ожидание"),
  qrSteps: settingsSectionId("QR — инструкция (шаги 1-2-3)"),
  qrCameraLink: settingsSectionId("QR — ссылка на камеру"),
  styleScreen: settingsSectionId("Стиль — экран"),
  styleHeader: settingsSectionId("Стиль — заголовок"),
  stylePhoto: settingsSectionId("Стиль — превью фото"),
  styleBadge: settingsSectionId("Стиль — бейдж «Фото загружено»"),
  styleBgOption: settingsSectionId("Стиль — галочка «Вырезать фон»"),
  styleCards: settingsSectionId("Стиль — карточки (общие)"),
  styleButtons: settingsSectionId("Стиль — кнопки"),
  styleError: settingsSectionId("Стиль — сообщение об ошибке"),
  resultScreen: settingsSectionId("Результат — экран"),
  resultHeader: settingsSectionId("Результат — заголовок"),
  resultPreview: settingsSectionId("Результат — превью"),
  resultToggle: settingsSectionId("Результат — переключатель До/После"),
  resultStatus: settingsSectionId("Результат — карточка статуса"),
  resultButtons: settingsSectionId("Результат — кнопки"),
  resultInfo: settingsSectionId("Результат — инфо-бар"),
} as const;

export function aiThemeSection(key: keyof typeof AI_THEME_SECTIONS) {
  return themeSectionProps(AI_THEME_SECTIONS[key]);
}
