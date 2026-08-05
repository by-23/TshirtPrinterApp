; Tshirt Printer - unified installer (Operator or Kiosk)
; Embeds both electron-builder NSIS setups and runs the chosen one.
;
; Defines:
;   OPERATOR_SETUP  - path to Operator NSIS .exe
;   KIOSK_SETUP     - path to Kiosk NSIS .exe
;   OUT_FILE        - output combined setup.exe
;   PRODUCT_VER     - version label

Unicode true
CRCCheck on
SetCompressor /SOLID lzma
SetCompressorDictSize 64
RequestExecutionLevel user
ManifestDPIAware true

!ifndef OPERATOR_SETUP
  !error "OPERATOR_SETUP is required"
!endif
!ifndef KIOSK_SETUP
  !error "KIOSK_SETUP is required"
!endif
!ifndef OUT_FILE
  !error "OUT_FILE is required"
!endif
!ifndef PRODUCT_VER
  !define PRODUCT_VER "1.0.0"
!endif

!define PRODUCT_NAME "Tshirt Printer"

Name "${PRODUCT_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$TEMP\TshirtPrinterSetup"
BrandingText "${PRODUCT_NAME} ${PRODUCT_VER}"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "FileFunc.nsh"

Var SelectedApp
Var RadioHWND

!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Прервать установку ${PRODUCT_NAME}?"

!define MUI_WELCOMEPAGE_TITLE "Установка ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT "Этот установщик содержит оба приложения:$\r$\n$\r$\n• Operator — ПК оператора (сервер точки + интерфейс)$\r$\n• Kiosk — клиент киоска (подключается к Operator по сети)$\r$\n$\r$\nНа следующем шаге выберите, какое приложение установить.$\r$\n$\r$\nВерсия: ${PRODUCT_VER}"

!define MUI_FINISHPAGE_TITLE "Установка завершена"
!define MUI_FINISHPAGE_TEXT "Приложение установлено. На рабочем столе создан ярлык."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!define MUI_FINISHPAGE_RUN_TEXT "Запустить приложение"

!insertmacro MUI_PAGE_WELCOME
Page custom AppChoicePageCreate AppChoicePageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Требуется 64-разрядная Windows."
    Abort
  ${EndIf}
  StrCpy $SelectedApp "operator"
  InitPluginsDir
FunctionEnd

Function AppChoicePageCreate
  !insertmacro MUI_HEADER_TEXT "Выбор приложения" "Что установить на этот компьютер?"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 36u "Выберите одно приложение. Обычно Operator ставят на ПК у принтера, а Kiosk — на отдельный ПК киоска."
  Pop $0

  ${NSD_CreateRadioButton} 0 48u 100% 16u "Operator — ПК оператора (полное приложение точки)"
  Pop $RadioHWND
  ${NSD_Check} $RadioHWND
  ${NSD_OnClick} $RadioHWND OnChooseOperator

  ${NSD_CreateRadioButton} 0 72u 100% 16u "Kiosk — клиент киоска (подключение к Operator по LAN)"
  Pop $1
  ${NSD_OnClick} $1 OnChooseKiosk

  ${If} $SelectedApp == "kiosk"
    ${NSD_Uncheck} $RadioHWND
    ${NSD_Check} $1
  ${EndIf}

  ${NSD_CreateLabel} 0 104u 100% 28u "После установки на рабочем столе появится ярлык."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function OnChooseOperator
  StrCpy $SelectedApp "operator"
FunctionEnd

Function OnChooseKiosk
  StrCpy $SelectedApp "kiosk"
FunctionEnd

Function AppChoicePageLeave
  ${If} $SelectedApp != "kiosk"
    StrCpy $SelectedApp "operator"
  ${EndIf}
FunctionEnd

Function LaunchApp
  ; Nested electron-builder installers put apps under %LOCALAPPDATA%\Programs\...
  ${If} $SelectedApp == "kiosk"
    IfFileExists "$LOCALAPPDATA\Programs\Tshirt Printer Kiosk\Tshirt Printer Kiosk.exe" 0 +2
      Exec '"$LOCALAPPDATA\Programs\Tshirt Printer Kiosk\Tshirt Printer Kiosk.exe"'
  ${Else}
    IfFileExists "$LOCALAPPDATA\Programs\Tshirt Printer Operator\Tshirt Printer Operator.exe" 0 +2
      Exec '"$LOCALAPPDATA\Programs\Tshirt Printer Operator\Tshirt Printer Operator.exe"'
  ${EndIf}
FunctionEnd

Section "Install"
  SetOutPath "$PLUGINSDIR"

  ; Both setups are packed into this one EXE at compile time.
  File "/oname=operator-setup.exe" "${OPERATOR_SETUP}"
  File "/oname=kiosk-setup.exe" "${KIOSK_SETUP}"

  ${If} $SelectedApp == "kiosk"
    DetailPrint "Установка Tshirt Printer Kiosk..."
    ; /S = silent NSIS (electron-builder oneClick). Creates desktop shortcut itself.
    ExecWait '"$PLUGINSDIR\kiosk-setup.exe" /S' $0
  ${Else}
    DetailPrint "Установка Tshirt Printer Operator..."
    ExecWait '"$PLUGINSDIR\operator-setup.exe" /S' $0
  ${EndIf}

  ${If} $0 != 0
    DetailPrint "Код выхода установщика: $0"
    MessageBox MB_ICONEXCLAMATION "Установка завершилась с кодом $0. Если ярлыка нет — запустите установщик выбранного приложения ещё раз."
  ${EndIf}

  Delete "$PLUGINSDIR\operator-setup.exe"
  Delete "$PLUGINSDIR\kiosk-setup.exe"
SectionEnd
