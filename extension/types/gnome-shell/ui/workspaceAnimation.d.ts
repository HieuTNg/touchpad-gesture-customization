declare module 'resource:///org/gnome/shell/ui/workspaceAnimation.js' {
    import Clutter from 'gi://Clutter';
    import Meta from 'gi://Meta';

    import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';

    export class WorkspaceAnimationController {
        _swipeTracker: SwipeTracker;

        _switchWorkspaceBegin(
            tracker: {
                orientation: Clutter.Orientation;
                confirmSwipe: typeof SwipeTracker.prototype.confirmSwipe;
            },
            monitor: number
        ): void;

        _switchWorkspaceUpdate(tracker: SwipeTracker, progress: number): void;

        _switchWorkspaceEnd(
            tracker: SwipeTracker,
            duration: number,
            endProgress: number
        ): void;

        _movingWindow: Meta.Window;
    }
}
