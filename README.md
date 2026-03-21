# PDF Kaşe

PDF Kaşe, Expo development build tabanlı, local-first belge tarama ve sonuçlandırma uygulamasıdır.

Ana akış:
1. Belgeyi al
2. Düzelt
3. Kaşe / imza ekle
4. OCR / dönüştür
5. Kaydet / paylaş

## Ürün odağı

PDF Kaşe bir “araçlar kataloğu” değil, belgeyi baştan sona sonuçlandıran tek akış ürünüdür.

Mevcut odak modüller:
- Kamera ile tarama
- PDF / görsel içe aktarma
- Belge düzenleme
- Kaşe / imza
- OCR
- Word çıktısı
- Excel çıktısı
- QR tarama
- Sayfa bazlı akıllı silme

## Teknik temel

- Expo SDK 55
- React Native + TypeScript
- Expo development build
- React Navigation
- App.tsx + RootNavigator
- Expo Router yok
- Local DB: expo-sqlite
- Dosya sistemi: expo-file-system
- Secure local persistence: expo-secure-store
- PDF üretimi: pdf-lib
- OCR: ML Kit tabanlı local OCR
- Thumbnail / PDF render: react-native-pdf-jsi

## Proje yapısı

- Giriş noktası: `App.tsx`
- Navigasyon: `src/navigation/RootNavigator.tsx`
- Veri katmanı: `src/modules`
- Ekranlar: `src/screens`
- Ortak bileşenler: `src/components`

## Çalıştırma

```bash
npm install
npx expo prebuild
npx expo run:android
```

## Runtime env örneği

Çeviri için resmi provider seçimi env üzerinden yapılır. `auto` modunda öncelik sırası:
DeepL API Free -> Azure Translator -> LibreTranslate.

```bash
EXPO_PUBLIC_TRANSLATION_PROVIDER=auto
EXPO_PUBLIC_TRANSLATION_TIMEOUT_MS=15000

# DeepL API Free
EXPO_PUBLIC_DEEPL_API_KEY=
EXPO_PUBLIC_DEEPL_API_BASE_URL=https://api-free.deepl.com

# Azure Translator
EXPO_PUBLIC_AZURE_TRANSLATOR_KEY=
EXPO_PUBLIC_AZURE_TRANSLATOR_REGION=
EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com

# Self-host LibreTranslate
EXPO_PUBLIC_LIBRETRANSLATE_BASE_URL=
EXPO_PUBLIC_LIBRETRANSLATE_API_KEY=
```
