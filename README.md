# SkyStream TR Eklentileri

Türkçe kaynaklar için hazırlanmış SkyStream eklenti deposu.

## Kurulum

SkyStream içinde `Settings > Extensions > Add Repository` alanına şu repo adresini ekleyin:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

Bu adres doğrudan çalışan depo adresidir. Cuttly veya başka bir kısaltma servisine bağlı değildir.

## Aktif Eklentiler

- **DiziPal**: film, dizi, anime, kategori listeleri, arama, detay, bölüm ve yayın akışı.
- **DiziBox**: dizi listeleri, bölümler, arama, detay ve OK.ru üzerinden doğrulanmış yayın akışları.

`dist/plugins.json` aktif olarak yalnızca testten geçen eklentileri listeler. Çalışması doğrulanmayan kaynaklar aktif listeye eklenmez.

## Kısa Kod

Doğrulanmış kısa URL:

```text
https://cutt.ly/egici
```

Bu adres repo manifestine yönlenir ve SkyStream'e tam URL olarak eklenebilir.

SkyStream resmi uygulamasında kısa kodlar Cuttly üzerinden çözülür. Uygulama `egici` girildiğinde şu adrese bakar:

```text
https://cutt.ly/sky-egici
```

Bu nedenle sadece `egici` yazılarak kullanılacak resmi shortcode için `https://cutt.ly/sky-egici` adresinin repo URL'sine yönlenmesi gerekir:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

Cuttly erişilemiyorsa resmi SkyStream uygulamasında kısa kod da çalışmaz. Bu durumda repo URL'sini doğrudan ekleyin.

Kısa kodu Cuttly API ile oluşturmak veya yenilemek için:

```powershell
$env:CUTTLY_API_KEY = "API_KEY"
npm run shortcode:create
Remove-Item Env:\CUTTLY_API_KEY
```

API anahtarı repoya yazılmaz; sadece geçici ortam değişkeni olarak kullanılır.

## Doğrulama

Tüm aktif eklentileri canlı kaynaklara karşı test etmek için:

```powershell
npm test
```

Tek tek test etmek için:

```powershell
npm run test:dizipal
npm run test:dizibox
```

Test kapsamı:

- DiziPal kategori sayıları ve poster URL'leri.
- DiziPal arama, detay, bölüm ve m3u8 yayın akışı.
- DiziBox ana sayfa listeleri, detay ve OK.ru m3u8 manifesti.
- Paket JSON'ları ve `.sky` arşiv içerikleri.

## Durum Notları

- **HDFilmCehennemi** aktif listede yoktur. Doğrulamada mevcut yayın hostları kullanılamaz endpointlere çözüldüğü için paketlenmedi.
- **UğurFilm** aktif listede yoktur. Güncel public domainler bağlantı/DNS testlerini geçmediği için eklenmedi.

## Proje Yapısı

- `dizipal/`: DiziPal eklenti kaynağı.
- `dizibox/`: DiziBox eklenti kaynağı.
- `dist/`: Paketlenmiş `.sky` dosyaları ve aktif plugin listesi.
- `tools/`: Canlı testler ve yardımcı scriptler.
- `domains.txt`: Değişen domainler için uzak domain ipuçları.
