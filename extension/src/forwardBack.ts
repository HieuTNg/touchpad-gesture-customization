import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {ExtSettings} from '../constants.js';
import {ArrowIconAnimation} from './animations/arrow.js';
import {createSwipeTracker} from './swipeTracker.js';
import {getVirtualKeyboard, IVirtualKeyboard} from './utils/keyboard.js';
import {ForwardBackKeyBinds} from '../common/settings.js';

enum AnimationState {
    WAITING = 0, // waiting to cross threshold
    DEFAULT = WAITING,
    LEFT = -1,
    RIGHT = 1,
}

enum SwipeGestureDirection {
    LeftToRight = 1,
    RightToLeft = 2,
}

const SnapPointThreshold = 0.1;

export type AppForwardBackKeyBinds = Record<
    string,
    [ForwardBackKeyBinds, boolean]
>;

export class ForwardBackGestureExtension implements ISubExtension {
    private _connectHandlers: number[];
    private _swipeTracker: SwipeTracker;
    private _keyboard: IVirtualKeyboard;
    private _arrowIconAnimation: typeof ArrowIconAnimation.prototype;
    private _animationState = AnimationState.WAITING;
    private _appForwardBackKeyBinds: AppForwardBackKeyBinds;
    private _windowTracker: Shell.WindowTracker;
    private _focusWindow?: Meta.Window | null;

    constructor(
        appForwardBackKeyBinds: AppForwardBackKeyBinds,
        extensionPath: string,
        enableVerticalSwipe: boolean
    ) {
        this._appForwardBackKeyBinds = appForwardBackKeyBinds;
        this._windowTracker = Shell.WindowTracker.get_default();
        this._keyboard = getVirtualKeyboard();

        this._swipeTracker = createSwipeTracker(
            global.stage,
            [4, 3], //TODO: add support for vertical hold and swipe without disabling 3/4-fingers vertical swipe
            Shell.ActionMode.NORMAL,
            enableVerticalSwipe
                ? Clutter.Orientation.VERTICAL
                : Clutter.Orientation.HORIZONTAL,
            false,
            1,
            {allowTouch: false}
        );

        this._connectHandlers = [
            this._swipeTracker.connect('begin', this._gestureBegin.bind(this)),
            this._swipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._swipeTracker.connect('end', this._gestureEnd.bind(this)),
        ];

        this._arrowIconAnimation = new ArrowIconAnimation(extensionPath);
        this._arrowIconAnimation.hide();
        Main.layoutManager.uiGroup.add_child(this._arrowIconAnimation);
    }

    destroy(): void {
        this._connectHandlers.forEach(handle =>
            this._swipeTracker.disconnect(handle)
        );
        this._connectHandlers = [];
        this._swipeTracker.destroy();
        this._arrowIconAnimation.destroy();
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        this._focusWindow =
            global.display.get_focus_window() as Meta.Window | null;
        if (!this._focusWindow) return;
        this._animationState = AnimationState.WAITING;
        _tracker.confirmSwipe(
            global.screen_width,
            [AnimationState.LEFT, AnimationState.DEFAULT, AnimationState.RIGHT],
            AnimationState.DEFAULT,
            AnimationState.DEFAULT
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        switch (this._animationState) {
            case AnimationState.WAITING:
                if (
                    Math.abs(progress - AnimationState.DEFAULT) <
                    SnapPointThreshold
                )
                    return;
                this._showArrow(progress);
                break;
            case AnimationState.RIGHT:
                progress =
                    (progress - SnapPointThreshold) /
                    (AnimationState.RIGHT - SnapPointThreshold);
                this._arrowIconAnimation.gestureUpdate(
                    Math.clamp(progress, 0, 1)
                );
                break;
            case AnimationState.LEFT:
                progress =
                    (progress + SnapPointThreshold) /
                    (AnimationState.LEFT + SnapPointThreshold);
                this._arrowIconAnimation.gestureUpdate(
                    Math.clamp(progress, 0, 1)
                );
        }
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: AnimationState
    ): void {
        if (this._animationState === AnimationState.WAITING) {
            if (progress === AnimationState.DEFAULT) return;
            this._showArrow(progress);
        }

        switch (this._animationState) {
            case AnimationState.RIGHT:
                progress =
                    (progress - SnapPointThreshold) /
                    (AnimationState.RIGHT - SnapPointThreshold);
                progress = Math.clamp(progress, 0, 1);
                this._arrowIconAnimation.gestureEnd(duration, progress, () => {
                    if (progress !== 0) {
                        // bring left page to right
                        const keys = this._getClutterKeyForFocusedApp(
                            SwipeGestureDirection.LeftToRight
                        );
                        this._keyboard.sendKeys(keys);
                    }
                });

                break;
            case AnimationState.LEFT:
                progress =
                    (progress + SnapPointThreshold) /
                    (AnimationState.LEFT + SnapPointThreshold);
                progress = Math.clamp(progress, 0, 1);
                this._arrowIconAnimation.gestureEnd(duration, progress, () => {
                    if (progress !== 0) {
                        // bring right page to left
                        const keys = this._getClutterKeyForFocusedApp(
                            SwipeGestureDirection.RightToLeft
                        );
                        this._keyboard.sendKeys(keys);
                    }
                });
        }
    }

    _showArrow(progress: number) {
        const [height, width] = [
            this._arrowIconAnimation.height,
            this._arrowIconAnimation.width,
        ];
        const workArea = this._getWorkArea();

        if (progress > AnimationState.DEFAULT) {
            this._animationState = AnimationState.RIGHT;
            this._arrowIconAnimation.gestureBegin(
                'arrow1-left-symbolic.svg',
                true
            );
            this._arrowIconAnimation.set_position(
                workArea.x + width,
                workArea.y + Math.round((workArea.height - height) / 2)
            );
        } else {
            this._animationState = AnimationState.LEFT;
            this._arrowIconAnimation.gestureBegin(
                'arrow1-right-symbolic.svg',
                false
            );
            this._arrowIconAnimation.set_position(
                workArea.x + workArea.width - 2 * width,
                workArea.y + Math.round((workArea.height - height) / 2)
            );
        }
    }

    _getWorkArea() {
        const window = this._focusWindow;
        if (window) return window.get_frame_rect();
        return Main.layoutManager.getWorkAreaForMonitor(
            Main.layoutManager.currentMonitor?.index ?? 0
        );
    }

    /**
     * @param gestureDirection direction of swipe gesture left to right or right to left
     */
    _getClutterKeyForFocusedApp(gestureDirection: SwipeGestureDirection) {
        const focusApp = this._windowTracker.focus_app as Shell.App | null;
        const keyBind = focusApp
            ? this._appForwardBackKeyBinds[focusApp.get_id()]
            : null;

        if (keyBind) {
            // if keyBind[1] is true => reverse order or keys
            const returnBackKey =
                (gestureDirection === SwipeGestureDirection.LeftToRight) !==
                keyBind[1];

            switch (keyBind[0]) {
                case ForwardBackKeyBinds['Forward/Backward']:
                    return [
                        returnBackKey ? Clutter.KEY_Back : Clutter.KEY_Forward,
                    ];
                case ForwardBackKeyBinds['Page Up/Down']:
                    return [
                        returnBackKey
                            ? Clutter.KEY_Page_Up
                            : Clutter.KEY_Page_Down,
                    ];
                case ForwardBackKeyBinds['Right/Left']:
                    return [
                        returnBackKey ? Clutter.KEY_Left : Clutter.KEY_Right,
                    ];
                case ForwardBackKeyBinds['Audio Next/Prev']:
                    return [
                        returnBackKey
                            ? Clutter.KEY_AudioPrev
                            : Clutter.KEY_AudioNext,
                    ];
                case ForwardBackKeyBinds['Tab Next/Prev']:
                    return [
                        Clutter.KEY_Control_L,
                        returnBackKey
                            ? Clutter.KEY_Page_Up
                            : Clutter.KEY_Page_Down,
                    ];
            }
        }

        // default key bind
        return [
            gestureDirection === SwipeGestureDirection.LeftToRight
                ? Clutter.KEY_Back
                : Clutter.KEY_Forward,
        ];
    }
}
