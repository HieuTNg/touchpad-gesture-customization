import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {SwipeGestureType} from '../common/settings.js';
import {WIDGET_SHOWING_DURATION} from '../constants.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {easeActor} from './utils/environment.js';
import {getVirtualKeyboard, IVirtualKeyboard} from './utils/keyboard.js';

const END_OPACITY = 0;
const END_SCALE = 0.5;

enum CloseWindowGestureState {
    SWIPE = -1,
    DEFAULT = 0,
}

export class CloseWindowSwipeExtension implements ISubExtension {
    private _closeType:
        | SwipeGestureType.CLOSE_DOCUMENT
        | SwipeGestureType.CLOSE_WINDOW;
    private _keyboard: IVirtualKeyboard;
    private _swipeTracker: typeof SwipeTracker.prototype;
    private _preview: St.Widget;
    private _focusWindow?: Meta.Window | null;
    private _connectors: number[] = [];

    constructor(
        nfingers: number[],
        orientation: Clutter.Orientation,
        closeType:
            | SwipeGestureType.CLOSE_DOCUMENT
            | SwipeGestureType.CLOSE_WINDOW
    ) {
        this._closeType = closeType;
        this._keyboard = getVirtualKeyboard();

        this._preview = new St.Widget({
            reactive: false,
            style_class: 'gie-close-window-preview',
            visible: false,
        });

        this._preview.set_pivot_point(0.5, 0.5);
        Main.layoutManager.uiGroup.add_child(this._preview);

        this._swipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL,
            orientation,
            false,
            1,
            {allowTouch: false}
        );
    }

    apply(): void {
        this._connectors.push(
            this._swipeTracker.connect('begin', this.gestureBegin.bind(this))
        );
        this._connectors.push(
            this._swipeTracker.connect('update', this.gestureUpdate.bind(this))
        );
        this._connectors.push(
            this._swipeTracker.connect('end', this.gestureEnd.bind(this))
        );
    }

    destroy(): void {
        this._connectors.forEach(connector =>
            this._swipeTracker.disconnect(connector)
        );
        this._connectors = [];
        this._swipeTracker.destroy();
        this._preview.destroy();
    }

    gestureBegin(tracker: typeof SwipeTracker.prototype, monitor: number) {
        if (this._focusWindow) return;

        let win = global.display.get_focus_window() as Meta.Window | null;

        if (!win) {
            const workspace = global.workspace_manager.get_active_workspace();
            const windows = workspace.list_windows();
            win = windows.find(w => w.has_focus()) || null;

            if (!win && windows.length > 0) {
                win = windows[0];
            }
        }

        if (win && win.get_window_type() === Meta.WindowType.DESKTOP) {
            win = null as Meta.Window | null;
        }

        this._focusWindow = win;
        if (!this._focusWindow) return;

        const monitorArea = global.display.get_monitor_geometry(monitor);

        tracker.confirmSwipe(
            monitorArea.height, // distance
            [CloseWindowGestureState.SWIPE, CloseWindowGestureState.DEFAULT],
            CloseWindowGestureState.DEFAULT,
            CloseWindowGestureState.DEFAULT
        );

        const frame = this._focusWindow.get_frame_rect();
        this._preview.set_position(frame.x, frame.y);
        this._preview.set_size(frame.width, frame.height);

        // animate showing widget
        this._preview.opacity = 0;
        this._preview.show();
        easeActor(this._preview, {
            opacity: 255,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: WIDGET_SHOWING_DURATION,
        });
    }

    gestureUpdate(_tracker: unknown, progress: number): void {
        // progress goes from 0 (DEFAULT) to -1 (SWIPE)
        const normalizedProgress = CloseWindowGestureState.DEFAULT - progress;
        const scale = Util.lerp(1, END_SCALE, normalizedProgress);
        this._preview.set_scale(scale, scale);
        this._preview.opacity = Util.lerp(255, END_OPACITY, normalizedProgress);
    }

    gestureEnd(
        _tracker: unknown,
        duration: number,
        progress: CloseWindowGestureState
    ) {
        switch (progress) {
            case CloseWindowGestureState.DEFAULT:
                this._animatePreview(false, duration);
                break;
            case CloseWindowGestureState.SWIPE:
                this._animatePreview(
                    true,
                    duration,
                    this._invokeGestureCompleteAction.bind(this)
                );
        }
    }

    private _invokeGestureCompleteAction() {
        switch (this._closeType) {
            case SwipeGestureType.CLOSE_WINDOW:
                this._focusWindow?.delete?.(global.get_current_time());
                break;
            case SwipeGestureType.CLOSE_DOCUMENT:
                this._keyboard.sendKeys([Clutter.KEY_Control_L, Clutter.KEY_w]);
                break;
        }
    }

    private _animatePreview(
        gestureCompleted: boolean,
        duration: number,
        callback?: () => void
    ) {
        easeActor(this._preview, {
            opacity: gestureCompleted ? END_OPACITY : 255,
            scaleX: gestureCompleted ? END_SCALE : 1,
            scaleY: gestureCompleted ? END_SCALE : 1,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (callback) callback();
                this._gestureAnimationDone();
            },
        });
    }

    private _gestureAnimationDone() {
        this._preview.hide();
        this._preview.opacity = 255;
        this._preview.set_scale(1, 1);

        this._focusWindow = undefined;
    }
}
