# Media Bar

[English](#english) · [Türkçe](#türkçe)

---

## English

Top-bar media controls for GNOME Shell. Works with any player that implements MPRIS
(Spotify, browsers, VLC, ...).

### Features

- Previous / play-pause / next buttons
- Album art (local files and `http(s)` URLs, cached in `~/.cache/mediabar/`)
- Song title and artist, each in a small fixed-width area; long names scroll on hover
- Thin progress bar under the controls; click it to seek
- Everything dims while playback is paused
- Bar hides itself when no player is running; if several players run, the one that is playing is shown

### Requirements

- GNOME Shell 50 (see `shell-version` in `metadata.json`)
- A player that exposes MPRIS over D-Bus

### Install

```bash
git clone https://github.com/furkancol10/gnome-mediabar.git \
  ~/.local/share/gnome-shell/extensions/mediabar@pcf.local
gnome-extensions enable mediabar@pcf.local
```

On Wayland, log out and back in once so GNOME discovers the extension. After you edit
the code, log out and in again as well; GNOME keeps extension code in memory for the session.

### Customize

| What | Where |
| --- | --- |
| Title area width | `.mediabar-title { width }` in `stylesheet.css` |
| Artist area width and color | `.mediabar-artist`, `.mediabar-artist-text` in `stylesheet.css` |
| Album art size | `.mediabar-art` in `stylesheet.css` |
| Opacity while paused (0–255) | `DIM` at the top of `extension.js` |
| Scroll speed on hover | `dist * 25` in `_marquee()` in `extension.js` (smaller = faster) |
| Bar position | `Main.panel.addToStatusArea('mediabar', ..., 1, 'center')` in `enable()` |

### Troubleshooting

- Bar does not appear: make sure a player is running, then watch for errors with
  `journalctl -f -o cat /usr/bin/gnome-shell`.
- No album art: the player may not publish `mpris:artUrl`, or the download failed
  (the error is logged as `MediaBar: art download failed`).
- Progress bar stays empty: some sources (live streams) do not report a track length.

### Status

Early version. It was developed for GNOME Shell 50 on Wayland (Ubuntu); the album art,
artist and seek features have had little testing. Issues and pull requests are welcome.

### License

MIT

---

## Türkçe

GNOME Shell için üst panelde medya kontrol çubuğu. MPRIS destekleyen her oynatıcıyla
çalışır (Spotify, tarayıcılar, VLC, ...).

### Özellikler

- Önceki / oynat-duraklat / sonraki butonları
- Albüm kapağı (yerel dosyalar ve `http(s)` adresleri, `~/.cache/mediabar/` içinde saklanır)
- Şarkı adı ve sanatçı, her biri küçük sabit genişlikli bir alanda; uzun isimler üstüne gelince kayar
- Kontrollerin altında ince ilerleme çubuğu; tıklayınca şarkı o noktaya atlar
- Müzik duraklayınca her şey soluklaşır
- Oynatıcı yoksa çubuk kendini gizler; birden fazla oynatıcı varsa çalan gösterilir

### Gereksinimler

- GNOME Shell 50 (`metadata.json` içindeki `shell-version`)
- D-Bus üzerinden MPRIS sunan bir oynatıcı

### Kurulum

```bash
git clone https://github.com/furkancol10/gnome-mediabar.git \
  ~/.local/share/gnome-shell/extensions/mediabar@pcf.local
gnome-extensions enable mediabar@pcf.local
```

Wayland'de GNOME'un eklentiyi tanıması için oturumu bir kez kapatıp açman gerekir. Kodu
değiştirdikten sonra da aynısını yap; GNOME eklenti kodunu oturum boyunca bellekte tutar.

### Özelleştirme

| Ne | Nerede |
| --- | --- |
| Şarkı adı alanının genişliği | `stylesheet.css` içinde `.mediabar-title { width }` |
| Sanatçı alanı genişliği ve rengi | `stylesheet.css` içinde `.mediabar-artist`, `.mediabar-artist-text` |
| Kapak boyutu | `stylesheet.css` içinde `.mediabar-art` |
| Duraklayınca solukluk (0–255) | `extension.js` başındaki `DIM` |
| Üstüne gelince kayma hızı | `extension.js` içinde `_marquee()` altındaki `dist * 25` (küçük sayı = hızlı) |
| Çubuğun konumu | `enable()` içinde `Main.panel.addToStatusArea('mediabar', ..., 1, 'center')` |

### Sorun giderme

- Çubuk görünmüyor: bir oynatıcının açık olduğundan emin ol, hataları
  `journalctl -f -o cat /usr/bin/gnome-shell` ile izle.
- Kapak yok: oynatıcı `mpris:artUrl` yayınlamıyor olabilir veya indirme başarısız olmuştur
  (hata `MediaBar: art download failed` olarak kaydedilir).
- İlerleme çubuğu boş kalıyor: bazı kaynaklar (canlı yayınlar) şarkı süresi bildirmez.

### Durum

Erken sürüm. GNOME Shell 50 / Wayland (Ubuntu) için geliştirildi; kapak, sanatçı ve
şarkıyı sarma özellikleri az test edildi. Issue ve pull request'ler açıktır.

### Lisans

MIT
