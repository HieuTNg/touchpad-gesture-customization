import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {PinchGestureType} from '../../common/settings.js';
import {WIDGET_SHOWING_DURATION} from '../../constants.js';
import {TouchpadPinchGesture} from './pinchTracker.js';
import {easeActor} from '../utils/environment.js';
import {getVirtualKeyboard, IVirtualKeyboard} from '../utils/keyboard.js';

const END_OPACITY = 0;
const PINCH_THRESHOLD = 0.02;

enum CloseWindowGestureState {
    PINCH_IN = -1,
    DEFAULT = 0,
    PINCH_OUT = 1,
}

const PINCH_IN_ANIMATION = {
    style: 'gie-close-window-preview',
    start: 1,
    end: 0.5,
} as const;
const PINCH_OUT_ANIMATION = {
    style: 'gie-open-window-preview',
    start: 0.5,
    end: 1,
} as const;

declare type Type_TouchpadPinchGesture = typeof TouchpadPinchGesture.prototype;

export class CloseWindowExtension implements ISubExtension {
    private _closeType:
        | PinchGestureType.CLOSE_DOCUMENT
        | PinchGestureType.CLOSE_WINDOW;
    private _keyboard: IVirtualKeyboard;
    private _pinchTracker: Type_TouchpadPinchGesture;
    private _preview: St.Widget;
    private _focusWindow?: Meta.Window | null;
    private _activePinchAnimation:
        | typeof PINCH_IN_ANIMATION
        | typeof PINCH_OUT_ANIMATION
        | null = null;

    constructor(
        nfingers: number[],
        closeType:
            | PinchGestureType.CLOSE_DOCUMENT
            | PinchGestureType.CLOSE_WINDOW
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

        this._pinchTracker = new TouchpadPinchGesture({
            nfingers: nfingers,
            allowedModes: Shell.ActionMode.NORMAL,
            pinchSpeed: 0.25,
        });

        this._pinchTracker.connect('begin', this.gestureBegin.bind(this));
        this._pinchTracker.connect('update', this.gestureUpdate.bind(this));
        this._pinchTracker.connect('end', this.gestureEnd.bind(this));
    }

    destroy(): void {
        this._pinchTracker.destroy();
        this._preview.destroy();
    }

    gestureBegin(tracker: Type_TouchpadPinchGesture) {
        this._activePinchAnimation = null;

        // if we are currently in middle of animations, ignore this event
        if (this._focusWindow) return;

        this._focusWindow =
            global.display.get_focus_window() as Meta.Window | null;
        if (!this._focusWindow) return;

        tracker.confirmPinch(
            0,
            [
                CloseWindowGestureState.PINCH_IN,
                CloseWindowGestureState.DEFAULT,
                CloseWindowGestureState.PINCH_OUT,
            ],
            CloseWindowGestureState.DEFAULT
        );

        const frame = this._focusWindow.get_frame_rect();
        this._preview.set_position(frame.x, frame.y);
        this._preview.set_size(frame.width, frame.height);
    }

    gestureUpdate(_tracker: unknown, progress: number): void {
        progress = CloseWindowGestureState.DEFAULT - progress;
        let startAnimation: boolean = false;

        if (this._activePinchAnimation == null) {
            if (Math.abs(progress) > PINCH_THRESHOLD) {
                this._activePinchAnimation =
                    progress > 0 ? PINCH_IN_ANIMATION : PINCH_OUT_ANIMATION;
                this._preview.set_style_class_name(
                    this._activePinchAnimation.style
                );
                startAnimation = true;
            } else {
                return;
            }
        }

        progress = Math.abs(progress);
        const scale = Util.lerp(
            this._activePinchAnimation.start,
            this._activePinchAnimation.end,
            progress
        );
        this._preview.set_scale(scale, scale);
        this._preview.opacity = Util.lerp(255, END_OPACITY, progress);

        if (startAnimation) {
            // animate showing widget
            this._preview.show();
            easeActor(this._preview, {
                opacity: 255,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                duration: WIDGET_SHOWING_DURATION,
            });
        }
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
            case CloseWindowGestureState.PINCH_IN:
                this._animatePreview(
                    this._activePinchAnimation == PINCH_IN_ANIMATION,
                    duration,
                    this._invokeGestureCompleteAction.bind(this, progress)
                );
                break;
            case CloseWindowGestureState.PINCH_OUT:
                this._animatePreview(
                    this._activePinchAnimation == PINCH_OUT_ANIMATION,
                    duration,
                    this._invokeGestureCompleteAction.bind(this, progress)
                );
                break;
        }
    }

    private _invokeGestureCompleteAction(progress: CloseWindowGestureState) {
        switch (this._closeType) {
            case PinchGestureType.CLOSE_WINDOW:
                if (
                    progress == CloseWindowGestureState.PINCH_OUT &&
                    this._activePinchAnimation == PINCH_OUT_ANIMATION
                ) {
                    if (this._focusWindow) {
                        const windowTracker = Shell.WindowTracker.get_default();
                        const focusApp = windowTracker.get_window_app(
                            this._focusWindow
                        );

                        if (focusApp) {
                            focusApp.open_new_window(-1);
                        }
                    }
                } else if (
                    progress == CloseWindowGestureState.PINCH_IN &&
                    this._activePinchAnimation == PINCH_IN_ANIMATION
                ) {
                    this._focusWindow?.delete?.(global.get_current_time());
                }

                break;

            case PinchGestureType.CLOSE_DOCUMENT:
                if (
                    progress == CloseWindowGestureState.PINCH_OUT &&
                    this._activePinchAnimation == PINCH_OUT_ANIMATION
                ) {
                    this._keyboard.sendKeys([
                        Clutter.KEY_Control_L,
                        Clutter.KEY_t,
                    ]);
                } else if (
                    progress == CloseWindowGestureState.PINCH_IN &&
                    this._activePinchAnimation == PINCH_IN_ANIMATION
                ) {
                    this._keyboard.sendKeys([
                        Clutter.KEY_Control_L,
                        Clutter.KEY_w,
                    ]);
                }
        }
    }

    private _animatePreview(
        gestureCompleted: boolean,
        duration: number,
        callback?: () => void
    ) {
        easeActor(this._preview, {
            opacity: gestureCompleted ? END_OPACITY : 255,
            scaleX: gestureCompleted
                ? this._activePinchAnimation?.end
                : this._activePinchAnimation?.start,
            scaleY: gestureCompleted
                ? this._activePinchAnimation?.end
                : this._activePinchAnimation?.start,
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
        this._preview.opacity = 0;
        this._preview.set_scale(1, 1);

        this._focusWindow = undefined;
    }
}
