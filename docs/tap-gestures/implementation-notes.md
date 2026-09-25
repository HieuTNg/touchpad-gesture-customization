# 3 & 4 Finger Tap Gestures: Implementation Notes

**Date:** 2026-09-22. Verified against the libinput 1.31.1 and mutter
45.0–50.1 sources. This replaces the earlier research linked from #30.

## How taps are detected

`src/tapGestures.ts` listens to `captured-event::touchpad` on
`global.stage` and treats a `TOUCHPAD_HOLD` gesture as a tap when:

1. `HOLD BEGIN` has 3 or 4 fingers and a tap action is configured for that
   count,
2. the gesture finishes with `HOLD END` (not `CANCEL`) with the same finger
   count,
3. no `TOUCHPAD_SWIPE` / `TOUCHPAD_PINCH` event arrived in between, and
4. `END` arrives at most `TapConstants.MAX_HOLD_DURATION` (300ms) after
   `BEGIN`.

The action fires while handling `HOLD END`, which libinput emits the moment
the last finger lifts. A swipe cannot turn into a tap: once the fingers move
≥1mm, libinput cancels the hold (`HOLD END cancelled` → Clutter `CANCEL`)
before emitting `SWIPE BEGIN`/`PINCH BEGIN`.

## Why taps seemed to depend on where the pointer was

The earlier research found taps worked over the top panel but not over app
windows. That difference comes from mutter's event routing, not from
libinput:

- `meta_display_handle_event()` (`src/core/events.c`) calls
  `meta_wayland_compositor_handle_event()`; if that returns TRUE, the event
  filter returns `CLUTTER_EVENT_STOP` and the stage **never emits
  `captured-event`** for it.
- `meta_wayland_pointer_handle_event()` (`src/wayland/meta-wayland-pointer.c`)
  returns STOP for **button** events whenever a Wayland surface has pointer
  focus. So the middle click synthesized for a quick 3 finger tap only
  reaches the extension over shell chrome (panel, overview), never over app
  windows.
- For **hold and pinch** events the return value depends on the version:

  | mutter / GNOME | `TOUCHPAD_HOLD` over an app window |
  |---|---|
  | 45 | propagates to the stage |
  | 46, 47, 48 | `return meta_wayland_pointer_gesture_hold_handle_event()`, which is TRUE when a client has pointer focus → **consumed, never reaches extensions** |
  | 49, 50 | handled, then `return CLUTTER_EVENT_PROPAGATE` → reaches extensions |

  Swipe events propagate on all versions, which is why swipe gestures work
  everywhere.

Extension event filters (`Clutter.Event.add_filter`) are appended after
mutter's own filter, so they can't get in front of this either.

## Remaining limitations

- **GNOME 46–48:** taps are only detected over shell UI (top panel, overview,
  and the desktop when no window is under the pointer). Over app windows,
  mutter consumes the hold events and nothing reaches the extension.
- **Minimum contact time (~180ms):** libinput emits a 3+ finger hold only
  after the fingers rested for `DEFAULT_GESTURE_HOLD_TIMEOUT` (180ms, measured
  from the last finger landing; with tap-to-click, 3 fingers use the tap
  timeout, also 180ms). Taps shorter than that produce no hold event.
- **Quick 3 finger taps are middle clicks:** a 3 finger tap shorter than the
  tap timeout becomes `BTN_MIDDLE` via tap-to-click, which goes to the focused
  client and can't be suppressed. A 3 finger contact that lasts past the tap
  timeout becomes a hold (and no middle click), so the two never fire together.
- **Quick 4 finger taps are dropped:** libinput's tap state machine goes to
  `TAP_STATE_DEAD` on a 4th finger, so a 4 finger tap under 180ms produces no
  event at all.

## References

- libinput `src/evdev-mt-touchpad-gestures.c`: `tp_gesture_use_hold_timer()`,
  `DEFAULT_GESTURE_HOLD_TIMEOUT`, `tp_gesture_handle_event_on_state_hold()`,
  `tp_gesture_update_finger_state()`
- libinput `src/evdev-mt-touchpad-tap.c`: `tp_tap_touch3_handle_event()`,
  `tp_tap_touch3_release2_handle_event()`
- mutter `src/core/events.c`, `src/wayland/meta-wayland-pointer.c`,
  `src/wayland/meta-wayland-pointer-gesture-hold.c`,
  `src/backends/native/meta-seat-impl.c` (`HOLD_END` → `CANCEL` when
  `libinput_event_gesture_get_cancelled()`)
