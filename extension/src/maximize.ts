import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';

export class MaximizeWindowExtension implements ISubExtension {
    private _swipeTracker: typeof SwipeTracker.prototype;
    private _connectors: number[] = [];

    constructor(nfingers: number[], orientation: Clutter.Orientation) {
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
            this._swipeTracker.connect('begin', this._onBegin.bind(this))
        );
        this._connectors.push(
            this._swipeTracker.connect('update', this._onUpdate.bind(this))
        );
        this._connectors.push(
            this._swipeTracker.connect('end', this._onEnd.bind(this))
        );
    }

    destroy(): void {
        this._connectors.forEach(connector =>
            this._swipeTracker.disconnect(connector)
        );
        this._connectors = [];
        this._swipeTracker.destroy();
    }

    private _getFocusedWindow(): Meta.Window | null {
        let win = global.display.get_focus_window() as Meta.Window | null;

        if (!win) {
            const workspace = global.workspace_manager.get_active_workspace();
            const windows = workspace.list_windows();
            win = windows.find(w => w.has_focus()) || null;

            if (!win && windows.length > 0) {
                // Fallback to top-most window
                win = windows[0];
            }
        }

        if (win && win.get_window_type() === Meta.WindowType.DESKTOP) {
            return null; // Ignore desktop icons/background
        }

        return win;
    }

    private _onBegin(
        tracker: typeof SwipeTracker.prototype,
        monitor: number
    ): void {
        const window = this._getFocusedWindow();

        if (!window || !window.can_maximize()) {
            return;
        }

        const isMaximized = window.is_maximized();

        // snapPoints: 0 for normal, 1 for maximized
        const progress = isMaximized ? 1 : 0;
        const snapPoints = [0, 1];

        const monitorArea = global.display.get_monitor_geometry(monitor);

        tracker.confirmSwipe(
            monitorArea.height,
            snapPoints,
            progress,
            progress
        );
    }

    private _onUpdate(_tracker: never, _progress: number): void {
        // We could implement visual preview here, but simple maximize/unmaximize toggle works well.
    }

    private _onEnd(
        _tracker: never,
        _duration: number,
        endProgress: number
    ): void {
        const window = this._getFocusedWindow();
        if (!window) return;

        if (endProgress === 1) {
            window.maximize();
        } else {
            window.unmaximize();
        }
    }
}
