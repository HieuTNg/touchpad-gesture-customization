import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {CustomEventType} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {TouchpadConstants} from '../constants.js';

enum State {
    NONE = 0,
    PENDING = 1,
    HANDLING = 2,
    IGNORED = 3,
}

/**
 * Drags the focused window with a swipe. The swipe has to start horizontally;
 * once detected the window follows the fingers in both directions until they
 * are lifted, so this does not use SwipeTracker (which is single-axis).
 */
export class WindowDragGestureExtension implements ISubExtension {
    private _nfingers: number[];
    private _captureId = 0;
    private _state = State.NONE;
    private _window?: Meta.Window;
    private _pendingX = 0;
    private _pendingY = 0;
    private _startX = 0;
    private _startY = 0;
    private _dragX = 0;
    private _dragY = 0;
    private _scale = 1;

    constructor(nfingers: number[]) {
        this._nfingers = nfingers;
    }

    apply() {
        this._captureId = global.stage.connect(
            'captured-event::touchpad',
            this._handleEvent.bind(this)
        );
    }

    destroy() {
        if (this._captureId) {
            global.stage.disconnect(this._captureId);
            this._captureId = 0;
        }
        this._window = undefined;
    }

    private _handleEvent(
        _actor: Clutter.Actor | undefined,
        event: CustomEventType
    ): boolean {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return Clutter.EVENT_PROPAGATE;

        const phase = event.get_gesture_phase();
        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._state = State.NONE;
            this._window = undefined;
        }

        if (this._state === State.IGNORED) return Clutter.EVENT_PROPAGATE;

        if (
            !this._nfingers.includes(
                event.get_touchpad_gesture_finger_count()
            ) ||
            (Main.actionMode & Shell.ActionMode.NORMAL) === 0
        ) {
            this._state = State.IGNORED;
            return Clutter.EVENT_PROPAGATE;
        }

        const [dx, dy] = event.get_gesture_motion_delta_unaccelerated();
        const multiplier = TouchpadConstants.SWIPE_MULTIPLIER;

        if (this._state === State.NONE) {
            if (dx === 0 && dy === 0) return Clutter.EVENT_PROPAGATE;
            this._pendingX = 0;
            this._pendingY = 0;
            this._state = State.PENDING;
        }

        if (this._state === State.PENDING) {
            this._pendingX += dx * multiplier;
            this._pendingY += dy * multiplier;
            if (
                Math.hypot(this._pendingX, this._pendingY) <
                TouchpadConstants.DRAG_THRESHOLD_DISTANCE
            )
                return Clutter.EVENT_PROPAGATE;

            // only a horizontal start begins the drag; vertical swipes belong to other gestures
            if (
                Math.abs(this._pendingX) <= Math.abs(this._pendingY) ||
                !this._beginDrag()
            ) {
                this._state = State.IGNORED;
                return Clutter.EVENT_PROPAGATE;
            }
            this._state = State.HANDLING;
        }

        switch (phase) {
            case Clutter.TouchpadGesturePhase.BEGIN:
            case Clutter.TouchpadGesturePhase.UPDATE: {
                const speed =
                    multiplier *
                    this._scale *
                    TouchpadConstants.WINDOW_DRAG_MULTIPLIER;
                this._dragX += dx * speed;
                this._dragY += dy * speed;
                this._moveWindow();
                break;
            }
            case Clutter.TouchpadGesturePhase.END:
            case Clutter.TouchpadGesturePhase.CANCEL:
                this._state = State.NONE;
                this._window = undefined;
                break;
        }
        return Clutter.EVENT_STOP;
    }

    private _beginDrag(): boolean {
        const window = global.display.get_focus_window() as Meta.Window | null;

        // maximized/fullscreen windows can't be moved
        if (
            !window ||
            window.is_fullscreen() ||
            window.is_maximized() ||
            !window.allows_move()
        )
            return false;

        const rect = window.get_frame_rect();
        this._window = window;
        this._startX = rect.x;
        this._startY = rect.y;
        this._dragX = 0;
        this._dragY = 0;
        // same speed on both axes: a full touchpad width moves the window one monitor width
        this._scale =
            global.display.get_monitor_geometry(window.get_monitor()).width /
            TouchpadConstants.TOUCHPAD_BASE_WIDTH;
        return true;
    }

    private _moveWindow() {
        const window = this._window;
        if (!window) return;

        const rect = window.get_frame_rect();
        const area = Main.layoutManager.getWorkAreaForMonitor(
            window.get_monitor()
        );

        // keep the window inside the work area (if it is larger, pin it to the top-left)
        const maxX = Math.max(area.x, area.x + area.width - rect.width);
        const maxY = Math.max(area.y, area.y + area.height - rect.height);
        const x = Math.min(Math.max(this._startX + this._dragX, area.x), maxX);
        const y = Math.min(Math.max(this._startY + this._dragY, area.y), maxY);

        // store the clamped offset so reversing direction responds immediately
        this._dragX = x - this._startX;
        this._dragY = y - this._startY;
        window.move_frame(true, Math.round(x), Math.round(y));
    }
}
