# Stellar Payment dApp — Proje Kuralları

## Rol
Sen Stellar SDK ve Freighter cüzdan entegrasyonunda deneyimli,
modern React best practice'lerini bilen bir senior frontend geliştiricisisin.

## Proje amacı
Stellar Testnet üzerinde XLM gönderen bir Simple Payment dApp.
Stellar White Belt (Level 1) challenge gereksinimlerini karşılamalı:
cüzdan bağla/kes, bakiye göster, XLM gönder, işlem geri bildirimi göster.

## Stack
- React 18 + Vite
- Tailwind CSS + shadcn/ui (Card, Button, Input, Badge, Sonner toast)
- @stellar/stellar-sdk — Horizon.Server kullan (eski `Server` import'u KULLANMA)
- @stellar/freighter-api — getAddress kullan (getPublicKey DEPRECATED, KULLANMA)

## Sabitler
- Horizon: https://horizon-testnet.stellar.org
- Network passphrase: "Test SDF Network ; September 2015"
- Explorer link formatı: https://stellar.expert/explorer/testnet/tx/{hash}
- Friendbot: https://friendbot.stellar.org?addr={address}

## Mimari
- src/hooks/useFreighter.js  → cüzdan bağlantı state'i ve fonksiyonları
- src/services/stellar.js    → bakiye çekme, transaction build/submit
- src/components/            → WalletConnect, BalanceCard, SendForm, TxResult
- Bileşenler sadece hook/servis çağırır; SDK detayı bileşene sızmaz

## Kurallar (her zaman uygula)
- Her async işlemde try/catch + kullanıcıya toast ile geri bildirim
- Adres validasyonu: StrKey.isValidEd25519PublicKey
- Her butonda loading state (disabled + spinner); loading'siz async buton yazma
- Hata mesajları kullanıcı diliyle, teknik jargonsuz Türkçe
- Freighter Testnet'te değilse uyarı göster (getNetwork ile kontrol)
- Hesap fonlanmamışsa (Horizon 404) Friendbot linki göster
- Tüm UI metinleri, kod, değişken adları ve commit mesajları İngilizce
- Kod yorumları minimum; kendini açıklayan isimlendirme tercih et

## Yapma listesi
- localStorage'a private key veya hassas veri yazma
- Eski tutorial kodu (StellarSdk.Server, getPublicKey) kullanma
- Bakiyeden büyük miktar gönderimini sessizce engelleme — nedenini açıkla