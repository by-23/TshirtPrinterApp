/**
 * Custom RU/EN layouts for `react-simple-keyboard` — the package ships no
 * bundled language layouts, only the default QWERTY row set. KK/ZH are
 * intentionally not covered here (see `KioskKeyboardOverlay.tsx`): the
 * kiosk falls back to Windows' own touch keyboard for those two languages.
 */
export interface KioskKeyboardLayout {
  default: string[];
  shift: string[];
  numbers: string[];
  /** Matches `react-simple-keyboard`'s `KeyboardLayoutObject` shape (arbitrary named layouts). */
  [key: string]: string[];
}

const NUMBERS_ROW = ["1 2 3 4 5 6 7 8 9 0", "@ # $ _ & - + ( ) /", "* \" ' : ; ! ? %", "{numbers} , {space} . {enter}"];

export const KEYBOARD_LAYOUTS: Record<"ru" | "en", KioskKeyboardLayout> = {
  en: {
    default: [
      "q w e r t y u i o p",
      "a s d f g h j k l",
      "{shift} z x c v b n m {bksp}",
      "{numbers} , {space} . {enter}",
    ],
    shift: [
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "{shift} Z X C V B N M {bksp}",
      "{numbers} , {space} . {enter}",
    ],
    numbers: NUMBERS_ROW,
  },
  ru: {
    default: [
      "й ц у к е н г ш щ з х ъ",
      "ф ы в а п р о л д ж э",
      "{shift} я ч с м и т ь б ю {bksp}",
      "{numbers} , {space} . {enter}",
    ],
    shift: [
      "Й Ц У К Е Н Г Ш Щ З Х Ъ",
      "Ф Ы В А П Р О Л Д Ж Э",
      "{shift} Я Ч С М И Т Ь Б Ю {bksp}",
      "{numbers} , {space} . {enter}",
    ],
    numbers: NUMBERS_ROW,
  },
};

export const KEYBOARD_BUTTON_DISPLAY: Record<string, string> = {
  "{bksp}": "⌫",
  "{enter}": "↵",
  "{space}": " ",
  "{shift}": "⇧",
  "{numbers}": "123",
};
