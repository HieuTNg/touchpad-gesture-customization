# 3 and 4 Finger Taps on GNOME 45–51

Which GNOME versions the extension can offer tap gestures on, what counts as
a tap, and why a quick 3-finger tap stays a middle click. Checked against the
mutter 45.0–51.0 and libinput 1.31.1 source. See
[`implementation-notes.md`](./implementation-notes.md) for the code-level
details.

## Support by GNOME version

The extension sees taps as touchpad *hold* gestures. Whether those reach an
extension while the pointer is over an app window depends on how mutter
(GNOME's compositor) routes them, and that changed twice.

| GNOME | Published for | Tap support | Reason |
|---|---|---|---|
| 45 | Yes (branch `48`) | Possible, not built | Mutter sends touchpad gestures over windows to both the app and the shell (`bypass_clutter = !IS_GESTURE_EVENT`), so hold events reach the extension everywhere. It shares a branch with 46–48, so it would need its own version check. Out of scope for now. |
| 46–48 | Yes (branch `48`) | **Not supported** | Mutter hands hold events to the app under the pointer and reports them as handled whenever an app window has pointer focus. The shell never receives them, so taps would only work over the top panel and overview. The README already warns about the same bug for hold-and-swipe and pinch. |
| 49 | Yes (branch `main`) | Supported | Mutter 49 changed the pointer code to always pass hold and pinch events on to the shell after delivering them to the app. The extension as a whole needs 49.3 or newer (see README). |
| 50 | Yes (branch `main`) | Supported | Same routing as 49. Tap support was developed and tested on 50. |
| 51 | Not yet (`metadata.json` lists 49, 50) | Would work | Mutter 51.0 keeps the 49 routing. Taps would work once the extension adds 51 to its supported versions. |

Tap support is only added on `main`, which publishes for 49 and 50. Both are
fully supported, so the code needs no version check.

## What counts as a tap

**The fingers have to lift.** A system tap-to-click fires when the fingers
come up, not while they rest on the pad, and the extension does the same.
Fingers that touch and stay never trigger anything.

The movement rule matches the system too: move the fingers and it stops being
a tap. The one difference is timing. The system claims every contact shorter
than 180 ms, before the extension can see anything, so the extension's tap
starts where the system's ends:

| Time from the last finger touching down to all fingers lifting | 3 fingers | 4 fingers |
|---|---|---|
| Under 180 ms | Middle click (system tap-to-click) | Nothing |
| 180–480 ms | Extension action | Extension action |
| Over 480 ms | Nothing | Nothing |

The action fires at the moment the fingers lift, wherever that falls in the
180–480 ms window. 480 ms is a cutoff for what still counts as a tap, not a
delay.

| | System tap-to-click (1–3 fingers) | Extension tap (3–4 fingers) |
|---|---|---|
| Fires when | The fingers lift | The fingers lift (libinput's `HOLD END`) |
| Contact time | Under 180 ms | About 180–480 ms: libinput starts a hold after 180 ms, and the extension accepts a lift up to 300 ms after that (`TapConstants.MAX_HOLD_DURATION`) |
| Movement allowed | Under 1.3 mm | Until libinput starts a swipe or pinch, roughly 1–2.5 mm depending on finger count |
| Fingers rest, don't lift | Becomes a hold, no click | Nothing happens until they lift; past 480 ms, nothing happens at all |
| Fingers move | No click | The hold is cancelled before the swipe starts, so no action |

Because the time windows don't overlap, a 3-finger contact is either a middle
click or the extension's action, never both.

## Why the 3-finger middle click can't be overridden

A quick 3-finger tap becomes a middle click inside libinput, and it reaches
the app before any extension code runs. Here is the path it takes:

1. libinput recognizes the tap and emits a middle-button press the moment the
   fingers lift. Its only tap setting, `tap-button-map`, chooses between `lrm`
   and `lmr` (whether 2 or 3 fingers means middle). Neither turns the 3-finger
   tap off.
2. Mutter runs its own event filter first. Filters run in the order they were
   added, and mutter adds its filter at startup, before any extension loads.
3. That filter delivers the button to the app under the pointer and marks it
   handled. The shell's `captured-event` signal never fires for it, so the
   extension never sees the click, let alone gets a chance to cancel it.
4. There is no earlier warning to act on. During the first 180 ms of a
   3-finger touch, libinput sends no events at all, so the extension can't
   tell that fingers are down in time to intervene.

### The one route that would work, and why it's not used

GNOME 50 and newer load libinput Lua plugins from
`~/.config/libinput/plugins/`. A plugin sees the raw finger contacts before
tap-to-click runs, so it could hold back the lift of a quick tap until libinput
reports a hold. That would remove the middle click and let quick 3- and
4-finger taps fire the action, about 180 ms after touchdown.

- Ubuntu's libinput is built without Lua support, so the plugin would be
  ignored there.
- Plugins load only when GNOME Shell starts, so turning it on or off needs a
  log out.
- The file would outlive the extension. After an uninstall it would keep
  swallowing quick 3-finger taps with nothing listening.
- extensions.gnome.org reviewers may object to an extension writing code into
  another program's config folder.

## Sources

- [mutter 45.0, `events.c:478`](https://gitlab.gnome.org/GNOME/mutter/-/blob/45.0/src/core/events.c#L478):
  gesture events over windows are not kept from the shell
- [mutter 48.0, `meta-wayland-pointer.c:930`](https://gitlab.gnome.org/GNOME/mutter/-/blob/48.0/src/wayland/meta-wayland-pointer.c#L930):
  hold result returned as handled (same in 46.0 and 47.0)
- [mutter 49.0, `meta-wayland-pointer.c:954`](https://gitlab.gnome.org/GNOME/mutter/-/blob/49.0/src/wayland/meta-wayland-pointer.c#L954):
  hold always passed on to the shell
- [mutter 50.1, `events.c:304`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.1/src/core/events.c#L304):
  events delivered to an app stop there
- [mutter 50.1, `clutter-event.c:1294`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.1/clutter/clutter/clutter-event.c#L1294):
  event filters are appended, so mutter's runs first
- [mutter 50.1, `meta-seat-impl.c:3097`](https://gitlab.gnome.org/GNOME/mutter/-/blob/50.1/src/backends/native/meta-seat-impl.c#L3097):
  libinput plugins loaded from the user config folder
- [libinput 1.31.1, `evdev-mt-touchpad-gestures.c`](https://gitlab.freedesktop.org/libinput/libinput/-/blob/1.31.1/src/evdev-mt-touchpad-gestures.c#L37):
  180 ms hold timeout, hold cancelled when a swipe or pinch starts
- [libinput 1.31.1, `evdev-mt-touchpad-tap.c`](https://gitlab.freedesktop.org/libinput/libinput/-/blob/1.31.1/src/evdev-mt-touchpad-tap.c#L32):
  180 ms tap timeout, 1.3 mm move threshold, taps of 4+ fingers dropped
- [libinput Lua plugin documentation](https://gitlab.freedesktop.org/libinput/libinput/-/blob/1.31.1/doc/user/lua-plugins.rst)
