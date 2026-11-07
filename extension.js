import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const PREFIX = 'org.mpris.MediaPlayer2.';
const OBJ = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const DIM = 110; // opacity when paused

export default class MediaBar extends Extension {
    enable() {
        this._bus = Gio.DBus.session;
        this._player = null;
        this._ids = [];
        this._refreshId = 0;
        this._tickId = 0;
        this._playing = false;
        this._len = 0;      // microseconds
        this._pos = 0;      // microseconds
        this._trackId = null;
        this._artUrl = null;
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'mediabar']);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._indicator = new PanelMenu.Button(0.0, 'MediaBar', true);
        const vbox = new St.BoxLayout({vertical: true});
        const box = new St.BoxLayout({style_class: 'mediabar-box', y_align: Clutter.ActorAlign.CENTER, y_expand: true});

        // album art
        this._art = new St.Widget({style_class: 'mediabar-art', y_align: Clutter.ActorAlign.CENTER, visible: false});

        this._prev = this._makeBtn('media-skip-backward-symbolic', () => this._call('Previous'));
        this._play = this._makeBtn('media-playback-start-symbolic', () => this._call('PlayPause'));
        this._next = this._makeBtn('media-skip-forward-symbolic', () => this._call('Next'));

        this._title = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._title.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._titleBox = new St.Widget({
            style_class: 'mediabar-title',
            layout_manager: new Clutter.FixedLayout(),
            clip_to_allocation: true,
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._titleBox.add_child(this._title);
        this._titleBox.connect('notify::hover', () => this._marquee(this._title, this._titleBox));

        this._artist = new St.Label({style_class: 'mediabar-artist-text', y_align: Clutter.ActorAlign.CENTER});
        this._artist.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._artistBox = new St.Widget({
            style_class: 'mediabar-artist',
            layout_manager: new Clutter.FixedLayout(),
            clip_to_allocation: true,
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._artistBox.add_child(this._artist);
        this._artistBox.connect('notify::hover', () => this._marquee(this._artist, this._artistBox));

        box.add_child(this._art);
        box.add_child(this._prev);
        box.add_child(this._play);
        box.add_child(this._next);
        box.add_child(this._titleBox);
        box.add_child(this._artistBox);

        // progress bar (click to seek)
        this._track = new St.Widget({
            style_class: 'mediabar-track',
            layout_manager: new Clutter.FixedLayout(),
            reactive: true,
            x_expand: true,
        });
        this._fill = new St.Widget({style_class: 'mediabar-fill'});
        this._track.add_child(this._fill);
        this._track.connect('button-press-event', (_a, ev) => {
            this._seekTo(ev.get_coords()[0]);
            return Clutter.EVENT_STOP;
        });
        this._track.connect('notify::width', () => this._updateBar());

        vbox.add_child(box);
        vbox.add_child(this._track);
        this._indicator.add_child(vbox);
        Main.panel.addToStatusArea('mediabar', this._indicator, 1, 'center');

        this._ids.push(this._bus.signal_subscribe(
            null, 'org.freedesktop.DBus.Properties', 'PropertiesChanged', OBJ,
            null, Gio.DBusSignalFlags.NONE, () => this._scheduleRefresh()));
        this._ids.push(this._bus.signal_subscribe(
            null, PLAYER_IFACE, 'Seeked', OBJ,
            null, Gio.DBusSignalFlags.NONE, () => this._scheduleRefresh()));
        this._ids.push(this._bus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged', null,
            null, Gio.DBusSignalFlags.NONE, () => this._scheduleRefresh()));

        this._tickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    disable() {
        for (const id of this._ids)
            this._bus.signal_unsubscribe(id);
        this._ids = [];
        for (const k of ['_refreshId', '_tickId']) {
            if (this[k]) {
                GLib.source_remove(this[k]);
                this[k] = 0;
            }
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._player = null;
    }

    _marquee(label, container) {
        label.remove_all_transitions();
        if (container.hover) {
            const dist = label.width - container.width;
            if (dist > 0) {
                label.ease({
                    translation_x: -dist,
                    duration: dist * 25,
                    mode: Clutter.AnimationMode.LINEAR,
                });
            }
        } else {
            label.ease({
                translation_x: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    _makeBtn(icon, cb) {
        const btn = new St.Button({
            style_class: 'mediabar-btn',
            can_focus: true,
            reactive: true,
            child: new St.Icon({icon_name: icon, icon_size: 16}),
        });
        btn.connect('clicked', cb);
        return btn;
    }

    _scheduleRefresh() {
        if (this._refreshId)
            return;
        this._refreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._refreshId = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _call(method) {
        if (!this._player)
            return;
        this._bus.call(this._player, OBJ, PLAYER_IFACE, method, null, null,
            Gio.DBusCallFlags.NONE, -1, null, null);
    }

    // ---- progress bar ----
    _updateBar() {
        if (!this._fill)
            return;
        const frac = this._len > 0 ? Math.min(1, Math.max(0, this._pos / this._len)) : 0;
        this._fill.set_size(Math.round(this._track.width * frac), this._track.height);
    }

    _tick() {
        if (!this._indicator || !this._player || !this._playing)
            return;
        const player = this._player;
        this._bus.call(player, OBJ, 'org.freedesktop.DBus.Properties', 'Get',
            new GLib.Variant('(ss)', [PLAYER_IFACE, 'Position']), null,
            Gio.DBusCallFlags.NONE, 500, null,
            (conn, r) => {
                try {
                    const v = conn.call_finish(r).recursiveUnpack()[0];
                    if (player === this._player) {
                        this._pos = Number(v);
                        this._updateBar();
                    }
                } catch (_e) { /* ignore */ }
            });
    }

    _seekTo(stageX) {
        if (!this._player || this._len <= 0)
            return;
        const [tx] = this._track.get_transformed_position();
        const frac = Math.min(1, Math.max(0, (stageX - tx) / this._track.width));
        const target = Math.round(frac * this._len);
        let sent = false;
        if (this._trackId) {
            try {
                this._bus.call(this._player, OBJ, PLAYER_IFACE, 'SetPosition',
                    new GLib.Variant('(ox)', [this._trackId, target]), null,
                    Gio.DBusCallFlags.NONE, -1, null, null);
                sent = true;
            } catch (_e) { /* invalid track id, fall back to Seek */ }
        }
        if (!sent) {
            this._bus.call(this._player, OBJ, PLAYER_IFACE, 'Seek',
                new GLib.Variant('(x)', [target - this._pos]), null,
                Gio.DBusCallFlags.NONE, -1, null, null);
        }
        this._pos = target;
        this._updateBar();
    }

    // ---- album art ----
    _setArt(url) {
        if (url === this._artUrl)
            return;
        this._artUrl = url;
        if (!url) {
            this._art.hide();
            return;
        }
        if (url.startsWith('file://')) {
            this._applyArt(Gio.File.new_for_uri(url).get_path());
            return;
        }
        if (!/^https?:\/\//.test(url)) {
            this._art.hide();
            return;
        }
        const name = GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, url, -1);
        const dest = Gio.File.new_for_path(GLib.build_filenamev([this._cacheDir, name]));
        if (dest.query_exists(null)) {
            this._applyArt(dest.get_path());
            return;
        }
        this._art.hide();
        Gio.File.new_for_uri(url).copy_async(dest, Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT, null, null, (src, r) => {
                try {
                    src.copy_finish(r);
                    if (this._artUrl === url && this._indicator)
                        this._applyArt(dest.get_path());
                } catch (e) {
                    console.error(`MediaBar: art download failed: ${e.message}`);
                }
            });
    }

    _applyArt(path) {
        if (!path || !this._art)
            return;
        this._art.set_style(`background-image: url("${path.replace(/"/g, '%22')}");`);
        this._art.show();
    }

    // ---- D-Bus helpers ----
    async _getAll(name) {
        const res = await new Promise((resolve, reject) => {
            this._bus.call(name, OBJ, 'org.freedesktop.DBus.Properties', 'GetAll',
                new GLib.Variant('(s)', [PLAYER_IFACE]), null,
                Gio.DBusCallFlags.NONE, 500, null,
                (conn, r) => {
                    try { resolve(conn.call_finish(r)); } catch (e) { reject(e); }
                });
        });
        return res.recursiveUnpack()[0];
    }

    async _refresh() {
        try {
            const names = await new Promise((resolve, reject) => {
                this._bus.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
                    'org.freedesktop.DBus', 'ListNames', null, null,
                    Gio.DBusCallFlags.NONE, 500, null,
                    (conn, r) => {
                        try { resolve(conn.call_finish(r).recursiveUnpack()[0]); } catch (e) { reject(e); }
                    });
            });
            let best = null;
            for (const n of names.filter(n => n.startsWith(PREFIX))) {
                try {
                    const props = await this._getAll(n);
                    const playing = props.PlaybackStatus === 'Playing';
                    if (!best || (playing && !best.playing))
                        best = {name: n, props, playing};
                } catch (_e) { /* player vanished */ }
            }
            if (!this._indicator)
                return;
            if (!best) {
                this._player = null;
                this._playing = false;
                this._indicator.hide();
                return;
            }
            this._player = best.name;
            this._playing = best.playing;
            const md = best.props.Metadata ?? {};
            const title = md['xesam:title'] ?? '';
            const artist = Array.isArray(md['xesam:artist']) ? md['xesam:artist'].join(', ')
                : String(md['xesam:artist'] ?? '');
            if (this._artist.text !== artist) {
                this._artist.remove_all_transitions();
                this._artist.translation_x = 0;
                this._artist.text = artist;
            }
            this._artistBox.visible = artist !== '';
            if (this._title.text !== title) {
                this._title.remove_all_transitions();
                this._title.translation_x = 0;
                this._title.text = title;
            }
            this._len = Number(md['mpris:length'] ?? 0);
            this._trackId = md['mpris:trackid'] ? String(md['mpris:trackid']) : null;
            this._pos = Number(best.props.Position ?? 0);
            this._updateBar();
            this._setArt(md['mpris:artUrl'] ?? null);

            this._play.child.icon_name = best.playing
                ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
            const op = best.playing ? 255 : DIM;
            for (const a of [this._art, this._titleBox, this._artistBox, this._fill]) {
                a.ease({opacity: op, duration: 200, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            }
            this._indicator.show();
        } catch (e) {
            console.error(`MediaBar: ${e}`);
        }
    }
}
