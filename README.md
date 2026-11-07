# Media Bar

GNOME Shell top-bar media controls for any MPRIS player (Spotify, browsers, VLC, ...).

- Previous / play-pause / next buttons
- Album art, song title and artist (long names scroll on hover)
- Click-to-seek progress bar
- Dimmed look while paused

Tested target: GNOME Shell 50 (Wayland).

## Install

```bash
git clone https://github.com/furkancol10/gnome-mediabar.git \
  ~/.local/share/gnome-shell/extensions/mediabar@pcf.local
gnome-extensions enable mediabar@pcf.local
```

On Wayland, log out and back in once so GNOME discovers the extension.

## Customize

- Width of the title / artist areas: `stylesheet.css` (`.mediabar-title`, `.mediabar-artist`)
- Opacity while paused: `DIM` at the top of `extension.js`

## License

MIT
