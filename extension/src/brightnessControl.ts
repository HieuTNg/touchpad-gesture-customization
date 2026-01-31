import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {ExtSettings, TouchpadConstants} from '../constants.js';

const BRIGHTNESS_OSD_FPS_CAP_MS = 1000 / 30;

export class BrightnessControlGestureExtension implements ISubExtension {
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _manager?: typeof Main.brightnessManager;
    private _lastOsdShowTimestamp: number = 0;
    private _managerChangedId: number | null = null;

    apply() {
        this._manager = Main.brightnessManager;

        // Keep in sync if manager changes (defensive)
        if (this._manager) {
            this._managerChangedId = this._manager.connect('changed', () => {
                // no-op: we read manager state when gestures start/update
            });
        }
    }

    destroy(): void {
        if (this._manager && this._managerChangedId !== null) {
            this._manager.disconnect(this._managerChangedId);

            this._managerChangedId = null;
        }

        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalSwipeTracker?.disconnect(handle)
        );
        this._verticalConnectHandlers = undefined;
        this._verticalSwipeTracker?.destroy();

        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();
    }

    setVerticalSwipeTracker(nfingers: number[]) {
        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            !ExtSettings.INVERT_BRIGHTNESS_DIRECTION,
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER * 100,
            {allowTouch: false}
        );

        this._verticalConnectHandlers = [
            this._verticalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    setHorizontalSwipeTracker(nfingers: number[]) {
        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            !ExtSettings.INVERT_BRIGHTNESS_DIRECTION,
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER * 100,
            {allowTouch: false}
        );

        this._horizontalConnectHandlers = [
            this._horizontalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    _showOsd(brightness: number) {
        // If osd is updated too frequently, it may lag or freeze, so cap it to 30 fps
        const nowTimestamp = Date.now();

        if (
            nowTimestamp - this._lastOsdShowTimestamp <
            BRIGHTNESS_OSD_FPS_CAP_MS
        ) {
            return;
        }

        this._lastOsdShowTimestamp = nowTimestamp;

        const level = brightness / 100;

        const icon = Gio.Icon.new_for_string('display-brightness-symbolic');

        Main.osdWindowManager.showAll(icon, null, level, 1);
    }

    // Read current global brightness as 0..100
    get _brightness() {
        if (!this._manager) return 0;

        // globalScale is a scale object; its value is 0..1
        const gs = this._manager._globalScale;
        return gs ? Math.round(gs._value * 100) : 0;
    }

    // Set global brightness using manager; accepts 0..100
    set _brightness(value) {
        if (!this._manager) return;
        const clamped = Math.max(0, Math.min(100, Math.round(value)));
        this._manager._globalScale._setValue(clamped / 100);
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        _tracker.confirmSwipe(
            global.screen_height,
            [0, 100], // no snapping is needed as brightness change is continuous, but this will automatically clamp progress to [0, 100]
            this._brightness, // current brightness
            0 // can be whatever
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        // Round instead of truncating so that brightness changes sync exactly with extensions like "OSD Volume Number"
        const brightness = Math.round(progress);
        this._brightness = brightness;
        this._showOsd(brightness);
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: number
    ): void {}
}
