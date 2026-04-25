import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';

export class MinimizeAllWindowsExtension implements ISubExtension {
    private _swipeTracker: typeof SwipeTracker.prototype;
    private _connectors: number[] = [];
    private _minimizedWindows: Set<Meta.Window> = new Set();

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
        this._minimizedWindows.clear();
        this._swipeTracker.destroy();
    }

    private _getValidWindows(): Meta.Window[] {
        const workspace = global.workspace_manager.get_active_workspace();
        return workspace.list_windows().filter(win => {
            return (
                win.get_window_type() !== Meta.WindowType.DESKTOP &&
                win.get_window_type() !== Meta.WindowType.DOCK &&
                !win.is_always_on_all_workspaces()
            );
        });
    }

    /**
     * Check the REAL state of windows on the workspace right now.
     * Returns true if all valid windows are currently minimized.
     */
    private _areAllWindowsMinimized(): boolean {
        const windows = this._getValidWindows();
        if (windows.length === 0) return false;
        return windows.every(win => win.minimized);
    }

    private _onBegin(
        tracker: typeof SwipeTracker.prototype,
        monitor: number
    ): void {
        // Determine starting state from ACTUAL window states, not a boolean toggle
        const allMinimized = this._areAllWindowsMinimized();
        const progress = allMinimized ? 1 : 0;
        const snapPoints = [0, 1]; // 0 = normal, 1 = all minimized

        const monitorArea = global.display.get_monitor_geometry(monitor);

        tracker.confirmSwipe(
            monitorArea.height,
            snapPoints,
            progress,
            progress
        );
    }

    private _onUpdate(_tracker: never, _progress: number): void {
        // No visual preview for this action.
    }

    private _onEnd(
        _tracker: never,
        _duration: number,
        endProgress: number
    ): void {
        const windows = this._getValidWindows();

        if (endProgress === 1) {
            // Minimize all visible windows
            this._minimizedWindows.clear();
            windows.forEach(win => {
                if (!win.minimized) {
                    this._minimizedWindows.add(win);
                    win.minimize();
                }
            });
        } else if (endProgress === 0) {
            // Restore windows we previously minimized
            this._minimizedWindows.forEach(win => {
                win.unminimize();
            });
            this._minimizedWindows.clear();
        }
    }
}
