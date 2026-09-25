import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {showScreenshotUI} from 'resource:///org/gnome/shell/ui/screenshot.js';
import {CustomEventType} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {TapGestureType} from '../common/settings.js';
import {TapConstants} from '../constants.js';
import {getVirtualKeyboard} from './utils/keyboard.js';

const ALLOWED_MODES = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;

/**
 * Minimizes and restores the windows on the active workspace. Follows the
 * rules of the pinch Show Desktop (pinchGestures/showDesktop.ts): only
 * minimizable windows are hidden, switching workspace, opening a window or
 * disabling the extension restores them, and restoring a window by hand
 * ends the toggle.
 */
class ShowDesktopToggle {
    private _hiddenWindows: Meta.Window[] = [];
    private _workspace?: Meta.Workspace;
    private _workspaceChangedId = 0;
    private _windowAddedId = 0;
    private _windowUnMinimizedId = 0;

    constructor() {
        this._workspaceChangedId = global.workspace_manager.connect(
            'active-workspace-changed',
            this._workspaceChanged.bind(this)
        );
        this._windowUnMinimizedId = global.window_manager.connect(
            'unminimize',
            this._windowUnMinimized.bind(this)
        );
        this._workspaceChanged();
    }

    destroy() {
        this._restore();

        if (this._windowAddedId)
            this._workspace?.disconnect(this._windowAddedId);

        global.workspace_manager.disconnect(this._workspaceChangedId);
        global.window_manager.disconnect(this._windowUnMinimizedId);
    }

    toggle() {
        if (this._hiddenWindows.length) {
            this._restore();
            return;
        }

        this._hiddenWindows = (this._workspace?.list_windows() ?? []).filter(
            window =>
                window.get_window_type() === Meta.WindowType.NORMAL &&
                !window.is_skip_taskbar() &&
                !window.minimized &&
                window.can_minimize()
        );
        this._hiddenWindows.forEach(window => window.minimize());
    }

    private _restore() {
        const windows = this._workspace?.list_windows() ?? [];
        const hiddenWindows = this._hiddenWindows;

        this._hiddenWindows = [];
        hiddenWindows
            .filter(window => windows.includes(window))
            .forEach(window => window.unminimize());
    }

    private _workspaceChanged() {
        if (this._windowAddedId)
            this._workspace?.disconnect(this._windowAddedId);

        this._restore();
        this._workspace = global.workspace_manager.get_active_workspace();
        this._windowAddedId = this._workspace.connect(
            'window-added',
            this._windowAdded.bind(this)
        );
    }

    private _windowAdded(_workspace: unknown, window: Meta.Window) {
        if (!window.is_skip_taskbar()) this._restore();
    }

    private _windowUnMinimized(_wm: Shell.WM, actor: Meta.WindowActor) {
        if (actor.meta_window?.get_workspace() === this._workspace)
            this._hiddenWindows = [];
    }
}

/**
 * Detects 3 and 4 finger taps from touchpad hold gestures.
 *
 * libinput emits HOLD BEGIN once n fingers rest on the touchpad without
 * moving, and HOLD END (not cancelled) when they are all lifted. If the
 * fingers move enough to start a swipe or pinch, libinput first emits a
 * cancelled HOLD END (CANCEL phase). So a tap is a hold that ends cleanly
 * within TapConstants.MAX_HOLD_DURATION, and the action fires on that END
 * event, i.e. as soon as the fingers are lifted.
 *
 * Limitations (see docs/tap-gestures):
 * - libinput only starts a 3/4 finger hold after the fingers rested for
 *   ~180ms, so quicker taps produce no hold and cannot be observed.
 * - A quick 3 finger tap is turned into a middle click by libinput's
 *   tap-to-click, which is delivered to the focused client and cannot be
 *   suppressed from an extension.
 */
export class TapGestureExtension implements ISubExtension {
    private _actions: Map<number, TapGestureType>;
    private _stageCaptureEvent = 0;
    private _holdFingers = 0;
    private _holdBeginTime = 0;
    private _showDesktop?: ShowDesktopToggle;

    constructor(actions: Map<number, TapGestureType>) {
        this._actions = actions;
        if ([...actions.values()].includes(TapGestureType.SHOW_DESKTOP))
            this._showDesktop = new ShowDesktopToggle();

        this._stageCaptureEvent = global.stage.connect(
            'captured-event::touchpad',
            this._handleEvent.bind(this)
        );
    }

    destroy(): void {
        if (this._stageCaptureEvent) {
            global.stage.disconnect(this._stageCaptureEvent);
            this._stageCaptureEvent = 0;
        }

        this._showDesktop?.destroy();
        this._showDesktop = undefined;
    }

    private _handleEvent(
        _actor: undefined | Clutter.Actor,
        event: CustomEventType
    ): boolean {
        const eventType = event.type();

        // any swipe or pinch means the fingers moved, so it's not a tap
        if (
            eventType === Clutter.EventType.TOUCHPAD_SWIPE ||
            eventType === Clutter.EventType.TOUCHPAD_PINCH
        ) {
            this._reset();
            return Clutter.EVENT_PROPAGATE;
        }

        if (eventType !== Clutter.EventType.TOUCHPAD_HOLD)
            return Clutter.EVENT_PROPAGATE;

        const fingers = event.get_touchpad_gesture_finger_count();

        switch (event.get_gesture_phase()) {
            case Clutter.TouchpadGesturePhase.BEGIN:
                this._holdFingers = this._actions.has(fingers) ? fingers : 0;
                this._holdBeginTime = event.get_time();
                break;
            case Clutter.TouchpadGesturePhase.END:
                if (
                    this._holdFingers !== 0 &&
                    this._holdFingers === fingers &&
                    event.get_time() - this._holdBeginTime <=
                        TapConstants.MAX_HOLD_DURATION
                )
                    this._onTap(fingers);
                this._reset();
                break;
            default:
                this._reset();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    private _reset() {
        this._holdFingers = 0;
        this._holdBeginTime = 0;
    }

    private _onTap(fingers: number) {
        if ((Main.actionMode & ALLOWED_MODES) === 0) return;

        switch (this._actions.get(fingers)) {
            case TapGestureType.TOGGLE_OVERVIEW:
                Main.overview.toggle();
                break;
            case TapGestureType.SHOW_DESKTOP:
                if (Main.overview.visible) Main.overview.hide();
                this._showDesktop?.toggle();
                break;
            case TapGestureType.SHOW_NOTIFICATION_LIST:
                Main.panel.toggleCalendar();
                break;
            case TapGestureType.CLOSE_WINDOW:
                this._closeFocusedWindow();
                break;
            case TapGestureType.PLAY_PAUSE:
                getVirtualKeyboard().sendKeys([Clutter.KEY_AudioPlay]);
                break;
            case TapGestureType.NEXT_TRACK:
                getVirtualKeyboard().sendKeys([Clutter.KEY_AudioNext]);
                break;
            case TapGestureType.PREVIOUS_TRACK:
                getVirtualKeyboard().sendKeys([Clutter.KEY_AudioPrev]);
                break;
            case TapGestureType.MUTE:
                getVirtualKeyboard().sendKeys([Clutter.KEY_AudioMute]);
                break;
            case TapGestureType.SCREENSHOT:
                if (Main.overview.visible) Main.overview.hide();
                showScreenshotUI();
                break;
        }
    }

    private _closeFocusedWindow() {
        const window = global.display.get_focus_window();
        if (window?.can_close()) window.delete(global.get_current_time());
    }
}
