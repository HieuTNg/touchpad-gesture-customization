import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getVirtualKeyboard, IVirtualKeyboard} from './utils/keyboard.js';

/**
 * Expert GNOME Shell Extension Implementation for 2-Finger Navigation
 */

// Sensitivity constants calibrated for modern Wayland scroll deltas
const SCROLL_THRESHOLD = 0.4; // Extremely sensitive for testing
const GESTURE_LOCK_TIMEOUT_MS = 500;
const VERTICAL_LOCK_THRESHOLD = 1.0;

export class TwoFingerNavExtension implements ISubExtension {
    private _keyboard: IVirtualKeyboard;
    private _stageCaptureId = 0;
    private _accumulatedX = 0;
    private _lockTimeoutId = 0;
    private _triggered = false;
    private _verticalLock = false;
    private _reverseDirection: boolean;

    constructor(reverseDirection: boolean) {
        this._keyboard = getVirtualKeyboard();
        this._reverseDirection = reverseDirection;
    }

    apply(): void {
        this._stageCaptureId = global.stage.connect(
            'captured-event',
            this._onCapturedEvent.bind(this)
        );
    }

    destroy(): void {
        if (this._stageCaptureId) {
            global.stage.disconnect(this._stageCaptureId);
            this._stageCaptureId = 0;
        }

        this._clearLock();
    }

    private _clearLock() {
        this._accumulatedX = 0;
        this._triggered = false;
        this._verticalLock = false;

        if (this._lockTimeoutId) {
            GLib.source_remove(this._lockTimeoutId);
            this._lockTimeoutId = 0;
        }
    }

    private _onCapturedEvent(
        _actor: Clutter.Actor,
        event: Clutter.Event
    ): boolean {
        const type = event.type();
        
        if (type !== Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;

        const source = event.get_scroll_source();
        
        // Ensure it's a touchpad finger scroll
        if (source !== Clutter.ScrollSource.FINGER)
            return Clutter.EVENT_PROPAGATE;

        if (event.get_scroll_direction() !== Clutter.ScrollDirection.SMOOTH)
            return Clutter.EVENT_PROPAGATE;

        const [dx, dy] = event.get_scroll_delta();
        if (isNaN(dx) || isNaN(dy)) return Clutter.EVENT_PROPAGATE;

        // log(`[TouchpadGesture] Scroll: dx=${dx.toFixed(3)}, dy=${dy.toFixed(3)}`);

        if (this._triggered) {
            this._refreshLock();
            return Clutter.EVENT_STOP;
        }

        if (this._verticalLock) {
            this._refreshLock();
            return Clutter.EVENT_PROPAGATE;
        }

        if (Math.abs(dy) > Math.abs(dx) * VERTICAL_LOCK_THRESHOLD) {
            this._verticalLock = true;
            this._refreshLock();
            return Clutter.EVENT_PROPAGATE;
        }

        this._accumulatedX += dx;
        this._refreshLock();

        if (Math.abs(this._accumulatedX) >= SCROLL_THRESHOLD) {
            const scrollRight = this._accumulatedX > 0;
            const isForward = this._reverseDirection
                ? !scrollRight
                : scrollRight;
            const navKey = isForward ? Clutter.KEY_Right : Clutter.KEY_Left;

            log(
                `[TouchpadGesture] TRIGGER: isForward=${isForward}, accumulatedX=${this._accumulatedX.toFixed(2)}`
            );
            Main.notify(`Gesture: ${isForward ? 'Forward' : 'Back'}`);

            this._keyboard.sendKeys([Clutter.KEY_Alt_L, navKey]);

            this._triggered = true;
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    private _refreshLock() {
        if (this._lockTimeoutId) GLib.source_remove(this._lockTimeoutId);
        this._lockTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            GESTURE_LOCK_TIMEOUT_MS,
            () => {
                this._clearLock();
                return GLib.SOURCE_REMOVE;
            }
        );
    }
}
