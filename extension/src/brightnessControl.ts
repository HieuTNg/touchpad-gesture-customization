import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {
    ExtSettings,
    OSD_FRAMETIME_CAP_MS,
    TouchpadConstants,
} from '../constants.js';

export class BrightnessControlGestureExtension implements ISubExtension {
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _lastOsdShowTimestamp: number = 0;
    private _originalOsdShow: typeof Main.osdWindowManager.show | null = null;

    apply() {
        this._patchShowOsd();
    }

    destroy(): void {
        this._restoreShowOsd();

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
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER,
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
            TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER,
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

    // Changing brightness in Gnome 49+ is done via Main.brightnessManager._globalScale, which triggers an OSD
    // This OSD has an animation that causes lag when the OSD is triggered frequently
    // This patch allows to temporarily mute the stock OSD
    // Muting is done via a flag instead of an empty lambda to prevent memory allocations and keep osdWindowManager shape optimization
    private _patchShowOsd(): void {
        const originalShow = Main.osdWindowManager.show;
        Main.osdWindowManager._touchpadGestureCustomizationMuteShow = false;

        Main.osdWindowManager.show = function (
            this: typeof Main.osdWindowManager,
            ...args: Parameters<typeof originalShow>
        ): void {
            if (this._touchpadGestureCustomizationMuteShow) {
                return;
            }

            originalShow.apply(this, args);
        };

        this._originalOsdShow = originalShow;
    }

    private _restoreShowOsd(): void {
        if (this._originalOsdShow) {
            Main.osdWindowManager.show = this._originalOsdShow;
            this._originalOsdShow = null;
        }

        delete Main.osdWindowManager._touchpadGestureCustomizationMuteShow;
    }

    _showOsd(level: number) {
        // If osd is updated too frequently, it may lag or freeze, so cap it to 30 fps
        const nowTimestamp = Date.now();

        if (nowTimestamp - this._lastOsdShowTimestamp < OSD_FRAMETIME_CAP_MS) {
            return;
        }

        this._lastOsdShowTimestamp = nowTimestamp;

        const icon = Gio.Icon.new_for_string('display-brightness-symbolic');

        Main.osdWindowManager.showAll(icon, null, level, 1);
    }

    // Read current global brightness as 0..1
    get _brightness() {
        return Main.brightnessManager._globalScale._value;
    }

    // Set global brightness using manager; accepts 0..1
    // No need to clamp as BrightnessScale already does that internally
    set _brightness(value: number) {
        Main.brightnessManager._globalScale._setValue(value);
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        _tracker.confirmSwipe(
            global.screen_height,
            [0, 1], // no snapping is needed as brightness change is continuous, but this will automatically clamp progress to [0, 1]
            this._brightness, // current brightness
            0 // can be whatever
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        Main.osdWindowManager._touchpadGestureCustomizationMuteShow = true;
        this._brightness = progress;
        Main.osdWindowManager._touchpadGestureCustomizationMuteShow = false;

        this._showOsd(progress);
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: number
    ): void {}
}
