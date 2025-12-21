import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {OverviewAdjustment} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {OverviewNavigationState} from '../common/settings.js';
import {ExtSettings, OverviewControlsState} from '../constants.js';

enum ExtensionState {
    // DISABLED = 0,
    DEFAULT = 1,
    CUSTOM = 2,
}

export class OverviewRoundTripGestureExtension implements ISubExtension {
    private _stateAdjustment: OverviewAdjustment;
    private _oldGetStateTransitionParams: typeof OverviewAdjustment.prototype.getStateTransitionParams;
    private _progress = 0;
    private _extensionState = ExtensionState.DEFAULT;
    private _shownEventId = 0;
    private _hiddenEventId = 0;
    private _navigationStates: OverviewNavigationState;
    private _verticalSwipeTracker?: typeof SwipeTracker.prototype;
    private _horizontalSwipeTracker?: typeof SwipeTracker.prototype;
    private _verticalConnectors?: number[];
    private _horizontalConnectors?: number[];

    constructor(navigationStates: OverviewNavigationState) {
        this._navigationStates = navigationStates;
        this._stateAdjustment =
            Main.overview._overview._controls._stateAdjustment;
        this._oldGetStateTransitionParams =
            this._stateAdjustment.getStateTransitionParams;
        this._progress = 0;
    }

    _getStateTransitionParams(): typeof OverviewAdjustment.prototype.getStateTransitionParams.prototype {
        if (this._extensionState <= ExtensionState.DEFAULT) {
            return this._oldGetStateTransitionParams.call(
                this._stateAdjustment
            );
        } else if (this._extensionState === ExtensionState.CUSTOM) {
            const currentState = this._stateAdjustment.value;
            const initialState = OverviewControlsState.HIDDEN;
            const finalState = OverviewControlsState.APP_GRID;

            const length = Math.abs(finalState - initialState);
            const progress = Math.abs((currentState - initialState) / length);

            return {
                transitioning: true,
                currentState,
                initialState,
                finalState,
                progress,
            };
        }
    }

    setVerticalSwipeTracker(nfingers: number[]) {
        this._verticalConnectors?.forEach(connector =>
            this._verticalSwipeTracker?.disconnect(connector)
        );
        this._verticalSwipeTracker?.destroy();

        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            ExtSettings.DEFAULT_OVERVIEW_GESTURE_DIRECTION
        );

        this._verticalConnectors = [
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
        this._horizontalConnectors?.forEach(connector =>
            this._horizontalSwipeTracker?.disconnect(connector)
        );
        this._horizontalSwipeTracker?.destroy();

        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            ExtSettings.DEFAULT_OVERVIEW_GESTURE_DIRECTION
        );

        this._horizontalConnectors = [
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

    apply(): void {
        Main.overview._swipeTracker.enabled = false;

        // override 'getStateTransitionParams' function
        this._stateAdjustment.getStateTransitionParams =
            this._getStateTransitionParams.bind(this);

        this._extensionState = ExtensionState.DEFAULT;
        this._progress = 0;

        // reset extension state to default, when overview is shown and hidden (not showing/hidding event)
        this._shownEventId = Main.overview.connect(
            'shown',
            () => (this._extensionState = ExtensionState.DEFAULT)
        );
        this._hiddenEventId = Main.overview.connect(
            'hidden',
            () => (this._extensionState = ExtensionState.DEFAULT)
        );
    }

    destroy(): void {
        this._verticalConnectors?.forEach(connector =>
            this._verticalSwipeTracker?.disconnect(connector)
        );
        this._verticalSwipeTracker?.destroy();
        this._verticalConnectors = undefined;
        this._verticalSwipeTracker = undefined;

        this._horizontalConnectors?.forEach(connector =>
            this._horizontalSwipeTracker?.disconnect(connector)
        );
        this._horizontalSwipeTracker?.destroy();
        this._horizontalConnectors = undefined;
        this._horizontalSwipeTracker = undefined;

        Main.overview._swipeTracker.enabled = true;
        this._stateAdjustment.getStateTransitionParams =
            this._oldGetStateTransitionParams.bind(this._stateAdjustment);
        Main.overview.disconnect(this._shownEventId);
        Main.overview.disconnect(this._hiddenEventId);
    }

    _gestureBegin(tracker: typeof SwipeTracker.prototype): void {
        const _tracker = {
            confirmSwipe: (
                distance: number,
                _snapPoints: number[],
                currentProgress: number,
                cancelProgress: number
            ) => {
                tracker.confirmSwipe(
                    distance,
                    this._getGestureSnapPoints(),
                    currentProgress,
                    cancelProgress
                );
            },
        };

        Main.overview._gestureBegin(_tracker);
        this._progress = this._stateAdjustment.value;
        this._extensionState = ExtensionState.DEFAULT;
    }

    _gestureUpdate(
        tracker: typeof SwipeTracker.prototype,
        progress: number
    ): void {
        if (
            progress < OverviewControlsState.HIDDEN ||
            progress > OverviewControlsState.APP_GRID
        )
            this._extensionState = ExtensionState.CUSTOM;
        else this._extensionState = ExtensionState.DEFAULT;

        this._progress = progress;

        // log(`update: progress=${progress}, overview progress=${this._getOverviewProgressValue(progress)}`);

        Main.overview._gestureUpdate(
            tracker,
            this._getOverviewProgressValue(progress)
        );
    }

    _gestureEnd(
        tracker: typeof SwipeTracker.prototype,
        duration: number,
        endProgress: number
    ): void {
        if (this._progress < OverviewControlsState.HIDDEN) {
            this._extensionState = ExtensionState.CUSTOM;
            endProgress =
                endProgress >= OverviewControlsState.HIDDEN
                    ? OverviewControlsState.HIDDEN
                    : OverviewControlsState.APP_GRID;
        } else if (this._progress > OverviewControlsState.APP_GRID) {
            this._extensionState = ExtensionState.CUSTOM;
            endProgress =
                endProgress <= OverviewControlsState.APP_GRID
                    ? OverviewControlsState.APP_GRID
                    : OverviewControlsState.HIDDEN;
        } else {
            this._extensionState = ExtensionState.DEFAULT;
            endProgress = Math.clamp(
                endProgress,
                OverviewControlsState.HIDDEN,
                OverviewControlsState.APP_GRID
            );
        }

        // log(`end: progress=${this._progress}, endProgress=${endProgress}, \
        //     overview progress=${this._getOverviewProgressValue(endProgress)}`)
        Main.overview._gestureEnd(tracker, duration, endProgress);
    }

    _getOverviewProgressValue(progress: number): number {
        if (progress < OverviewControlsState.HIDDEN) {
            return Math.min(
                OverviewControlsState.APP_GRID,
                2 * Math.abs(OverviewControlsState.HIDDEN - progress)
            );
        } else if (progress > OverviewControlsState.APP_GRID) {
            return Math.min(
                OverviewControlsState.APP_GRID,
                2 * Math.abs(OverviewControlsState.HIDDEN_N - progress)
            );
        }

        return progress;
    }

    private _getGestureSnapPoints(): number[] {
        switch (this._navigationStates) {
            case OverviewNavigationState.CYCLIC:
                return [
                    OverviewControlsState.APP_GRID_P,
                    OverviewControlsState.HIDDEN,
                    OverviewControlsState.WINDOW_PICKER,
                    OverviewControlsState.APP_GRID,
                    OverviewControlsState.HIDDEN_N,
                ];
            case OverviewNavigationState.GNOME:
                return [
                    OverviewControlsState.HIDDEN,
                    OverviewControlsState.WINDOW_PICKER,
                    OverviewControlsState.APP_GRID,
                ];
            case OverviewNavigationState.WINDOW_PICKER_ONLY:
                return [
                    OverviewControlsState.HIDDEN,
                    OverviewControlsState.WINDOW_PICKER,
                ];
        }
    }
}
