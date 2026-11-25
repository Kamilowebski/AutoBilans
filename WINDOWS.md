# AutoBilans 1.7.1 na Windowsie

## Otwórz projekt lokalnie

Rozpakuj ZIP, a następnie otwórz folder `AutoBilans` w Codexie albo w VS Code z rozszerzeniem Codex. Wybierz pracę lokalną. Otwórz nową rozmowę w tym folderze i napisz „Kontynuujemy AutoBilans 1.7.1 z lokalnych plików”. Do pracy nad kodem wystarczą pliki z ZIP-a.

## Zbuduj APK

1. Zainstaluj [Android Studio](https://developer.android.com/studio). W **SDK Manager** doinstaluj **Android SDK Platform 35** i **Android SDK Build-Tools 35.0.0**. W zakładce SDK Tools zaznacz **Show Package Details**, żeby wybrać wersję.
2. Użyj JDK 21. Jeśli Android Studio ma JBR 21 w folderze `C:\Program Files\Android\Android Studio\jbr`, użyj tej ścieżki. Skrypt wymaga plików `java.exe`, `javac.exe` i `jar.exe`.
3. Otwórz PowerShell w folderze projektu. Podaj ścieżkę do oryginalnego magazynu klucza podpisującego APK. Hasło wpisz w monicie narzędzia podpisującego.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-windows.ps1 -SigningKeystore 'C:\Klucze\AutoBilans.p12' -Output .\AutoBilans.apk
```

Ustaw ścieżkę `-AndroidSdk`, jeśli SDK jest poza `%LOCALAPPDATA%\Android\Sdk`. Skrypt pobiera ZXing 3.5.3 i D8 8.9.35 z oficjalnych repozytoriów, weryfikuje ich sumy SHA-256 i zapisuje wynik po sprawdzeniu podpisu. Parametr `-ExecutionPolicy Bypass` dotyczy tylko tego uruchomienia PowerShella.

## Zachowaj możliwość aktualizacji

Oryginalny magazyn klucza i jego hasło trzeba przenieść osobnym, bezpiecznym kanałem. Android zaakceptuje APK jako aktualizację po podpisaniu tym samym kluczem. Trzymaj magazyn i hasło poza folderem projektu oraz GitHubem.
