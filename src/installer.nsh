!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"

Function CreateDesktopShortcut
  # Verificar se o atalho existe e deletá-lo
  ${If} ${FileExists} "$DESKTOP\PasswordTesting.lnk"
    Delete "$DESKTOP\PasswordTesting.lnk"
  ${EndIf}

  # Criar um novo atalho
  CreateShortCut "$DESKTOP\PasswordTesting.lnk" "$INSTDIR\PasswordTesting.exe"
FunctionEnd

Section "Instalar"
  # Chama a função para criar o atalho
  Call CreateDesktopShortcut
SectionEnd
