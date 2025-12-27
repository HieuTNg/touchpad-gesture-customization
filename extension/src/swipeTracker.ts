import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import {actionMode} from 'resource:///org/gnome/shell/ui/main.js';
import {
    SwipeTracker,
    CustomEventType,
    _SwipeTrackerOptionalParams,
} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {TouchpadConstants} from '../constants.js';

enum TouchpadState {
    NONE = 0,
    PENDING = 1,
    HANDLING = 2,
    IGNORED = 3,
}

export const TouchpadSwipeGesture = GObject.registerClass(
    {
        Properties: {
            enabled: GObject.ParamSpec.boolean(
                'enabled',
                'enabled',
                'enabled',
                GObject.ParamFlags.READWRITE,
                true
            ),
            orientation: GObject.ParamSpec.enum(
                'orientation',
                'orientation',
                'orientation',
                GObject.ParamFlags.READWRITE,
                Clutter.Orientation,
                Clutter.Orientation.HORIZONTAL
            ),
        },
        Signals: {
            begin: {
                param_types: [
                    GObject.TYPE_UINT,
                    GObject.TYPE_DOUBLE,
                    GObject.TYPE_DOUBLE,
                ],
            },
            update: {
                param_types: [
                    GObject.TYPE_UINT,
                    GObject.TYPE_DOUBLE,
                    GObject.TYPE_DOUBLE,
                ],
            },
            end: {param_types: [GObject.TYPE_UINT, GObject.TYPE_DOUBLE]},
        },
    },
    class TouchpadSwipeGesture extends GObject.Object {
        private _nfingers: number[];
        private _allowedModes: Shell.ActionMode;
        orientation: Clutter.Orientation;
        private _checkAllowedGesture?: (event: CustomEventType) => boolean;
        private _cumulativeX = 0;
        private _cumulativeY = 0;
        private _followNaturalScroll: boolean;
        _touchpadEvent: number | null;
        SWIPE_MULTIPLIER: number;
        enabled = true;
        private _state = TouchpadState.NONE;
        private _toggledDirection = false;
        private _swipeGestureBeginTime = 0;
        private _holdGestureBeginTime = 0;
        private _holdGestureCancelTime = 0;

        constructor(
            actor: Clutter.Actor,
            nfingers: number[],
            allowedModes: Shell.ActionMode,
            orientation: Clutter.Orientation,
            followNaturalScroll = true,
            checkAllowedGesture?: (event: CustomEventType) => boolean,
            gestureSpeed = 1.0
        ) {
            super();
            this._nfingers = nfingers;
            this._allowedModes = allowedModes;
            this.orientation = orientation;
            this._checkAllowedGesture = checkAllowedGesture;
            this._followNaturalScroll = followNaturalScroll;

            this._touchpadEvent = actor.connect(
                'event::touchpad',
                this._handleEvent.bind(this)
            );

            this.SWIPE_MULTIPLIER =
                TouchpadConstants.SWIPE_MULTIPLIER *
                (typeof gestureSpeed !== 'number' ? 1.0 : gestureSpeed);
        }

        private _resetState() {
            this._state = TouchpadState.NONE;
            this._toggledDirection = false;

            this._swipeGestureBeginTime = 0;
            this._holdGestureBeginTime = 0;
            this._holdGestureCancelTime = 0;
        }

        _handleEvent(
            _actor: undefined | Clutter.Actor,
            event: CustomEventType
        ): boolean {
            if (event.type() === Clutter.EventType.TOUCHPAD_HOLD) {
                this._handleHoldEvent(event);
                return Clutter.EVENT_PROPAGATE;
            }

            if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
                return Clutter.EVENT_PROPAGATE;

            const gesturePhase = event.get_gesture_phase();

            if (gesturePhase === Clutter.TouchpadGesturePhase.BEGIN) {
                this._swipeGestureBeginTime = event.get_time();
                this._state = TouchpadState.NONE;
                this._toggledDirection = false;
            }

            if (this._state === TouchpadState.IGNORED)
                return Clutter.EVENT_PROPAGATE;

            if (!this.enabled) return Clutter.EVENT_PROPAGATE;

            if (
                this._allowedModes !== Shell.ActionMode.ALL &&
                (this._allowedModes & actionMode) === 0
            ) {
                this._state = TouchpadState.IGNORED;
                return Clutter.EVENT_PROPAGATE;
            }

            if (
                !this._nfingers.includes(
                    event.get_touchpad_gesture_finger_count()
                )
            ) {
                this._state = TouchpadState.IGNORED;
                return Clutter.EVENT_PROPAGATE;
            }

            if (
                gesturePhase === Clutter.TouchpadGesturePhase.BEGIN &&
                this._checkAllowedGesture !== undefined
            ) {
                try {
                    if (this._checkAllowedGesture(event) !== true) {
                        this._state = TouchpadState.IGNORED;
                        return Clutter.EVENT_PROPAGATE;
                    }
                } catch (ex) {
                    this._state = TouchpadState.IGNORED;
                    return Clutter.EVENT_PROPAGATE;
                }
            }

            const time = event.get_time();

            const [x, y] = event.get_coords();
            const [dx, dy] = event.get_gesture_motion_delta_unaccelerated() as [
                number,
                number,
            ];

            if (this._state === TouchpadState.NONE) {
                if (dx === 0 && dy === 0) return Clutter.EVENT_PROPAGATE;

                this._cumulativeX = 0;
                this._cumulativeY = 0;
                this._state = TouchpadState.PENDING;
            }

            if (this._state === TouchpadState.PENDING) {
                this._cumulativeX += dx * this.SWIPE_MULTIPLIER;
                this._cumulativeY += dy * this.SWIPE_MULTIPLIER;

                const cdx = this._cumulativeX;
                const cdy = this._cumulativeY;
                const distance = Math.sqrt(cdx * cdx + cdy * cdy);

                if (distance >= TouchpadConstants.DRAG_THRESHOLD_DISTANCE) {
                    const gestureOrientation =
                        Math.abs(cdx) > Math.abs(cdy)
                            ? Clutter.Orientation.HORIZONTAL
                            : Clutter.Orientation.VERTICAL;

                    this._cumulativeX = 0;
                    this._cumulativeY = 0;

                    if (gestureOrientation === this.orientation) {
                        this._state = TouchpadState.HANDLING;
                        this.emit('begin', time, x, y);
                    } else {
                        this._state = TouchpadState.IGNORED;
                        return Clutter.EVENT_PROPAGATE;
                    }
                } else {
                    return Clutter.EVENT_PROPAGATE;
                }
            }

            const vertical = this.orientation === Clutter.Orientation.VERTICAL;
            let delta =
                (vertical !== this._toggledDirection ? dy : dx) *
                this.SWIPE_MULTIPLIER;
            const distance = vertical
                ? TouchpadConstants.TOUCHPAD_BASE_HEIGHT
                : TouchpadConstants.TOUCHPAD_BASE_WIDTH;

            switch (gesturePhase) {
                case Clutter.TouchpadGesturePhase.BEGIN:
                case Clutter.TouchpadGesturePhase.UPDATE:
                    if (this._followNaturalScroll) delta = -delta;

                    this.emit('update', time, delta, distance);
                    break;

                case Clutter.TouchpadGesturePhase.END:
                case Clutter.TouchpadGesturePhase.CANCEL:
                    this.emit('end', time, distance);
                    this._resetState();
                    break;
            }

            return this._state === TouchpadState.HANDLING
                ? Clutter.EVENT_STOP
                : Clutter.EVENT_PROPAGATE;
        }

        private _handleHoldEvent(event: CustomEventType) {
            switch (event.get_gesture_phase()) {
                case Clutter.TouchpadGesturePhase.BEGIN:
                    this._holdGestureCancelTime = 0;
                    this._holdGestureBeginTime = event.get_time();
                    break;
                case Clutter.TouchpadGesturePhase.CANCEL:
                    this._holdGestureCancelTime = event.get_time();
                    break;
                case Clutter.TouchpadGesturePhase.END:
                    this._holdGestureBeginTime = 0;
                    this._holdGestureCancelTime = 0;
            }
        }

        isItHoldAndSwipeGesture() {
            if (this._holdGestureCancelTime === 0) return false;

            return (
                this._holdGestureCancelTime - this._holdGestureBeginTime >=
                    TouchpadConstants.HOLD_SWIPE_DELAY_DURATION &&
                this._swipeGestureBeginTime - this._holdGestureCancelTime <=
                    Math.max(100, TouchpadConstants.HOLD_SWIPE_DELAY_DURATION)
            );
        }

        switchDirectionTo(direction: Clutter.Orientation): void {
            if (this._state !== TouchpadState.HANDLING) return;

            this._toggledDirection = direction !== this.orientation;
        }

        // Redundant, to be removed when GNOME remove this function
        destroy() {
            return;
        }
    }
);

export function createSwipeTracker(
    actor: Clutter.Actor,
    nfingers: number[],
    allowedModes: Shell.ActionMode,
    orientation: Clutter.Orientation,
    followNaturalScroll = true,
    gestureSpeed = 1,
    params?: _SwipeTrackerOptionalParams
): typeof SwipeTracker.prototype {
    params = params ?? {};
    params.allowDrag = params.allowDrag ?? false;
    params.allowScroll = params.allowScroll ?? false;
    params.phase = params.phase ?? Clutter.EventPhase.CAPTURE;
    const allowTouch = params.allowTouch ?? false;
    delete params.allowTouch;

    // create swipeTracker
    const swipeTracker = new SwipeTracker(
        actor,
        orientation,
        allowedModes,
        params
    );

    // add touchpadBindings to tracker
    swipeTracker._touchpadGesture = new TouchpadSwipeGesture(
        actor,
        nfingers,
        swipeTracker._allowedModes,
        swipeTracker.orientation,
        followNaturalScroll,
        undefined,
        gestureSpeed
    );

    swipeTracker._touchpadGesture.connect(
        'begin',
        swipeTracker._beginTouchpadGesture.bind(swipeTracker)
    );
    swipeTracker._touchpadGesture.connect(
        'update',
        swipeTracker._updateTouchpadGesture.bind(swipeTracker)
    );
    swipeTracker._touchpadGesture.connect(
        'end',
        swipeTracker._endTouchpadGesture.bind(swipeTracker)
    );
    swipeTracker.bind_property(
        'enabled',
        swipeTracker._touchpadGesture,
        'enabled',
        0
    );
    swipeTracker.bind_property(
        'orientation',
        swipeTracker._touchpadGesture,
        'orientation',
        GObject.BindingFlags.SYNC_CREATE
    );

    return swipeTracker;
}
