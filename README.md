# AutoBilans

Polska aplikacja na Androida do prowadzenia garażu i śledzenia kosztów samochodu. Działa offline i przechowuje dane na urządzeniu. Wymaga Androida 8.0 lub nowszego.

- Samochody, wydatki, warsztaty i statystyki.
- Tankowania, zużycie paliwa oraz koszt paliwa na 100 km.
- Terminy przeglądu, OC i serwisu według daty lub przebiegu.
- Karty paliwowe, widżet i kopia zapasowa przez systemowy wybór plików.
- Wyszukiwanie pobliskich stacji z dołączonej bazy po udzieleniu dostępu do lokalizacji.

## Instalacja

Pobierz podpisany APK z sekcji **Releases** i otwórz plik na telefonie. Przy aktualizacji zainstaluj go na dotychczasowej wersji, aby zachować dane. APK w pierwszym wydaniu GitHub `v1.0.0` zachowuje numer aplikacji **1.7.1** i identyfikator `pl.autobilans.app`, żeby obsłużyć aktualizację istniejących instalacji.

## Budowanie

- **Windows** — zobacz [instrukcję](WINDOWS.md) i uruchom `build-windows.ps1`.
- **Linux** — zainstaluj JDK 21, Android SDK Platform 35, Android SDK Build-Tools i ZIP. Ustaw zmienne `JAVA_HOME`, `ANDROID_JAR`, `BUILD_TOOLS`, `ZXING_JAR` (ZXing Core 3.5.3) i `SIGNING_KEYSTORE`. W razie potrzeby ustaw `R8_JAR` (D8 8.9.35). Uruchom `./build.sh AutoBilans.apk`.

Do aktualizacji potrzebujesz tego samego klucza, którym podpisano zainstalowaną wersję. Trzymaj magazyn klucza i hasło poza repozytorium.

## Automatyczne wydania

GitHub Actions buduje i podpisuje APK oraz publikuje je w **Releases** po wysłaniu zatwierdzonego tagu, np. `v1.0.1`. Zwykły push na gałąź nie uruchamia wydania.

Do automatycznego podpisu repozytorium potrzebuje dwóch sekretów w **Settings → Secrets and variables → Actions**:

- `AUTOBILANS_KEYSTORE_BASE64` — oryginalny magazyn podpisu zakodowany w Base64.
- `AUTOBILANS_KEYSTORE_PASSWORD` — hasło magazynu.

Workflow sprawdza podpis przed publikacją. Tag wydania w GitHubie i numer wersji Androida w `AndroidManifest.xml` są niezależne. Przed wydaniem zmian aplikacji zwiększ `versionCode`, aby Android zaakceptował APK jako aktualizację.

## Licencja i źródła danych

Kod AutoBilansu jest dostępny na licencji [MIT](LICENSE).

- [ZXing](https://github.com/zxing/zxing), używany do kodów kreskowych i QR, jest na licencji [Apache 2.0](assets/zxing-LICENSE.txt).
- Źródło bazy stacji: [BenzynaMAPA.pl](https://benzynamapa.pl/api-docs/) + [OpenStreetMap](https://www.openstreetmap.org/copyright). Baza podlega [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Szczegóły pochodzenia i atrybucji zawiera dokumentacja źródła.
