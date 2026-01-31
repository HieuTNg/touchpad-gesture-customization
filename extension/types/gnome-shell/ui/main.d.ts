declare module 'resource:///org/gnome/shell/ui/main.js' {
    import Meta from 'gi://Meta';
    import Clutter from 'gi://Clutter';
    import St from 'gi://St';
    import Shell from 'gi://Shell';
    import Gio from 'gi://Gio';

    import {ControlsManager} from 'resource:///org/gnome/shell/ui/overviewControls.js';
    import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
    import {WindowManager} from 'resource:///org/gnome/shell/ui/windowManager.js';
    import {WorkspaceAnimationController} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';

    const brightnessManager: {
        _globalScale: {
            _value: number;
            _setValue(value: number): void;
        };
        connect(signal: string, callback: () => void): number;
        disconnect(id: number): void;
    };

    const actionMode: Shell.ActionMode;
    export function activateWindow(
        window: Meta.Window,
        time?: number,
        workspaceNum?: number
    ): void;

    const panel: {
        addToStatusArea(
            role: string,
            indicator: Clutter.Actor,
            position?: number,
            box?: string
        ): void;
    } & Clutter.Actor;

    const overview: {
        dash: {
            showAppsButton: St.Button;
        };
        searchEntry: St.Entry;
        shouldToggleByCornerOrButton(): boolean;
        visible: boolean;
        show(): void;
        hide(): void;
        showApps(): void;
        connect(
            signal: 'showing' | 'hiding' | 'hidden' | 'shown',
            callback: () => void
        ): number;
        disconnect(id: number): void;
        _overview: {
            _controls: ControlsManager;
        } & St.Widget;
        _gestureBegin(tracker: {
            confirmSwipe: typeof SwipeTracker.prototype.confirmSwipe;
        }): void;
        _gestureUpdate(tracker: SwipeTracker, progress: number): void;
        _gestureEnd(
            tracker: SwipeTracker,
            duration: number,
            endProgress: number
        ): void;

        _swipeTracker: SwipeTracker;
    };

    const wm: WindowManager & {
        skipNextEffect(actor: Meta.WindowActor): void;
        _workspaceAnimation: WorkspaceAnimationController;
    };

    const osdWindowManager: {
        showAll(
            icon: Gio.Icon,
            label: string | null,
            level: number,
            maxlevel: number
        ): void;
        hideAll(): void;
    };
}
