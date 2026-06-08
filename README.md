# SkyStream TR Eklentileri

SkyStream için hazırlanmış Türkçe kaynak eklenti deposu.

## Kurulum

SkyStream içinde `Settings > Extensions > Add Repository` alanına şu repo adresini ekleyin:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

Bu adres doğrudan çalışan depo manifestidir. Kısaltma servislerine bağlı değildir.

## Aktif Eklentiler

- **DiziPal**: film, dizi, anime, kategori listeleri, arama, detay, bölüm ve HLS yayın akışı.
- **DiziBox**: dizi listeleri, bölümler, arama, detay ve OK.ru kaynakları. İndirilebilir MP4 kaynakları HLS kaynağından önce listelenir.
- **FilmModu**: film listeleri, arama, detay ve FilmModu/Vidlop HLS yayın akışı.

`dist/plugins.json` sadece canlı testten geçen eklentileri listeler. Oynatma akışı doğrulanmayan kaynaklar aktif depoya eklenmez.

## İndirme Durumu

SkyStream indirme ekranı, seçilen stream URL'sinden dosya boyutu alabilmelidir. Bu nedenle doğrudan MP4 veren kaynaklar indirilebilir, sadece HLS manifesti veren kaynaklar genelde indirilemez.

- **DiziBox**: OK.ru MP4 kalite seçenekleri indirme için uygundur.
- **DiziPal**: mevcut yayınlar HLS olduğu için oynatma desteklenir, indirme beklenmez.
- **FilmModu**: mevcut yayınlar HLS olduğu için oynatma desteklenir, indirme beklenmez.

## Kısa Kod

Doğrulanmış kısa URL:

```text
https://cutt.ly/egici
```

SkyStream kısa kod alanı `egici` yazıldığında Cuttly tarafında `https://cutt.ly/sky-egici` adresini çözmeye çalışır. Bu nedenle resmi kısa kodun çalışması için `sky-egici` kısa bağlantısının repo manifestine yönlenmesi gerekir:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

Cuttly erişilemiyorsa kısa kod da çalışmaz. Bu durumda repo URL'sini doğrudan ekleyin.

Kısa kodu Cuttly API ile oluşturmak veya yenilemek için komutları proje klasöründe çalıştırın:

```powershell
cd C:\Users\qwe\Desktop\skystream-dizipal-plugin
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
npm run test:filmmodu
```

Test kapsamı:

- DiziPal kategori sayıları, poster URL'leri, arama, detay, bölüm ve çalışan HLS manifesti.
- DiziBox ana sayfa, detay, OK.ru HLS manifesti ve indirme uyumlu MP4 Range kontrolü.
- FilmModu ana sayfa, poster filtreleme, arama, detay ve çalışan HLS manifesti.

## Durum Notları

- **HDFilmCehennemi** şu an aktif listede değildir. Canlı testte oynatma zinciri kullanılamayan HLS endpointlerine, indirme sayfası ise ek doğrulama ekranına düştüğü için paketlenmedi.
- **UğurFilm** şu an aktif listede değildir. Güncel public domain gerçek içerik yerine park/koruma sayfası döndürdüğü için paketlenmedi.

## Proje Yapısı

- `dizipal/`: DiziPal eklenti kaynağı.
- `dizibox/`: DiziBox eklenti kaynağı.
- `filmmodu/`: FilmModu eklenti kaynağı.
- `dist/`: Paketlenmiş `.sky` dosyaları ve aktif plugin listesi.
- `tools/`: Canlı testler ve yardımcı scriptler.
- `domains.txt`: Değişen domainler için uzak domain ipuçları.
