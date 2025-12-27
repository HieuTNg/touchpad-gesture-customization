import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {WindowSwitcherPopup} from 'resource:///org/gnome/shell/ui/altTab.js';
import {AltTabConstants, ExtSettings} from '../constants.js';
import {TouchpadSwipeGesture} from './swipeTracker.js';

let dummyWinCount = AltTabConstants.DUMMY_WIN_COUNT;

/**
 *
 * @param progress
 * @param nelement
 */
function getIndexForProgress(progress: number, nelement: number): number {
    let index = Math.floor(progress * (nelement + 2 * dummyWinCount));
    index = index - dummyWinCount;
    return Math.clamp(index, 0, nelement - 1);
}

/**
 * index -> index + AltTabConstants.DUMMY_WIN_COUNT
 * @param index
 * @param nelement
 */
function getAvgProgressForIndex(index: number, nelement: number): number {
    index = index + dummyWinCount;
    const progress = (index + 0.5) / (nelement + 2 * dummyWinCount);
    return progress;
}

enum AltTabExtState {
    DISABLED = 0,
    DEFAULT = 1,
    ALTTABDELAY = 2,
    ALTTAB = 3,
}

export default class AltTabGestureExtension implements ISubExtension {
    private _verticalTouchpadSwipeTracker?: typeof TouchpadSwipeGesture.prototype;
    private _horizontalTouchpadSwipeTracker?: typeof TouchpadSwipeGesture.prototype;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _adjustment: St.Adjustment;
    private _switcher?: typeof WindowSwitcherPopup.prototype;
    private _extState = AltTabExtState.DISABLED;
    private _progress = 0;
    private _altTabTimeoutId = 0;

    constructor() {
        this._adjustment = new St.Adjustment({
            value: 0,
            lower: 0,
            upper: 1,
        });
    }

    setVerticalTouchpadSwipeTracker(nfingers: number[]) {
        // disconnect and destroy vertical touchpad swipe tracker if exist
        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalTouchpadSwipeTracker?.disconnect(handle)
        );

        this._verticalTouchpadSwipeTracker = new TouchpadSwipeGesture(
            global.stage,
            nfingers,
            Shell.ActionMode.ALL,
            Clutter.Orientation.VERTICAL,
            false,
            this._checkAllowedGestureforVerticalSwipe.bind(this)
        );

        this._verticalConnectHandlers = [
            this._verticalTouchpadSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._verticalTouchpadSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._verticalTouchpadSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    setHorizontalTouchpadSwipeTracker(nfingers: number[]) {
        // disconnect and destroy horizontal touchpad swipe tracker if exist
        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalTouchpadSwipeTracker?.disconnect(handle)
        );

        this._horizontalTouchpadSwipeTracker = new TouchpadSwipeGesture(
            global.stage,
            nfingers,
            Shell.ActionMode.ALL,
            Clutter.Orientation.HORIZONTAL,
            false,
            this._checkAllowedGestureforHorizontalSwipe.bind(this)
        );

        this._horizontalConnectHandlers = [
            this._horizontalTouchpadSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._horizontalTouchpadSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._horizontalTouchpadSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    _checkAllowedGestureforVerticalSwipe(): boolean {
        return (
            this._extState <= AltTabExtState.DEFAULT &&
            Main.actionMode === Shell.ActionMode.NORMAL &&
            !(
                ExtSettings.APP_GESTURES &&
                this._verticalTouchpadSwipeTracker?.isItHoldAndSwipeGesture()
            )
        );
    }

    _checkAllowedGestureforHorizontalSwipe(): boolean {
        return (
            this._extState <= AltTabExtState.DEFAULT &&
            Main.actionMode === Shell.ActionMode.NORMAL &&
            !(
                ExtSettings.APP_GESTURES &&
                this._horizontalTouchpadSwipeTracker?.isItHoldAndSwipeGesture()
            )
        );
    }

    apply(): void {
        this._adjustment?.connect(
            'notify::value',
            this._onUpdateAdjustmentValue.bind(this)
        );

        this._extState = AltTabExtState.DEFAULT;
    }

    destroy(): void {
        // disconnect and destroy vertical touchpad swipe tracker
        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalTouchpadSwipeTracker?.disconnect(handle)
        );

        this._verticalTouchpadSwipeTracker = undefined;
        this._verticalConnectHandlers = undefined;

        // disconnect and destroy horizontal touchpad swipe tracker
        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalTouchpadSwipeTracker?.disconnect(handle)
        );

        this._horizontalTouchpadSwipeTracker = undefined;
        this._horizontalConnectHandlers = undefined;

        this._extState = AltTabExtState.DISABLED;

        if (this._altTabTimeoutId) {
            GLib.source_remove(this._altTabTimeoutId);
            this._altTabTimeoutId = 0;
        }

        if (this._switcher) {
            this._switcher.destroy();
            this._switcher = undefined;
        }
    }

    _onUpdateAdjustmentValue(): void {
        if (this._extState === AltTabExtState.ALTTAB && this._switcher) {
            const nelement = this._switcher._items.length;

            if (nelement > 1) {
                const n = getIndexForProgress(this._adjustment.value, nelement);
                this._switcher._select(n);
                const adjustment =
                    this._switcher._switcherList._scrollView.hscroll.adjustment;
                const transition = adjustment.get_transition('value');

                if (transition) {
                    transition.advance(AltTabConstants.POPUP_SCROLL_TIME);
                }
            }
        }
    }

    _gestureBegin(): void {
        this._progress = 0;

        if (this._extState === AltTabExtState.DEFAULT) {
            this._switcher = new WindowSwitcherPopup();
            this._switcher._switcherList.add_style_class_name(
                'gie-alttab-quick-transition'
            );
            this._switcher.connect('destroy', () => {
                this._switcher = undefined;
                this._reset();
            });

            // remove timeout entirely
            this._switcher._resetNoModsTimeout = function () {
                if (this._noModsTimeoutId) {
                    GLib.source_remove(this._noModsTimeoutId);
                    this._noModsTimeoutId = 0;
                }
            };

            const nelement = this._switcher._items.length;

            if (nelement > 0) {
                this._switcher.show(false, 'switch-windows', 0);
                this._switcher._popModal();

                if (this._switcher._initialDelayTimeoutId) {
                    GLib.source_remove(this._switcher._initialDelayTimeoutId);
                    this._switcher._initialDelayTimeoutId = 0;
                }

                const leftOver = AltTabConstants.MIN_WIN_COUNT - nelement;

                if (leftOver > 0) {
                    dummyWinCount = Math.max(
                        AltTabConstants.DUMMY_WIN_COUNT,
                        Math.ceil(leftOver / 2)
                    );
                } else {
                    dummyWinCount = AltTabConstants.DUMMY_WIN_COUNT;
                }

                if (nelement === 1) {
                    this._switcher._select(0);
                    this._progress = 0;
                } else {
                    this._progress = getAvgProgressForIndex(1, nelement);
                    this._switcher._select(1);
                }

                this._adjustment.value = 0;
                this._extState = AltTabExtState.ALTTABDELAY;

                if (this._altTabTimeoutId)
                    GLib.source_remove(this._altTabTimeoutId);

                this._altTabTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    AltTabConstants.DELAY_DURATION,
                    () => {
                        Main.osdWindowManager.hideAll();
                        if (this._switcher) this._switcher.opacity = 255;
                        this._adjustment.value = this._progress;
                        this._extState = AltTabExtState.ALTTAB;
                        this._altTabTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            } else {
                this._switcher.destroy();
                this._switcher = undefined;
            }
        }
    }

    _gestureUpdate(
        _gesture: never,
        _time: never,
        delta: number,
        distance: number
    ): void {
        if (this._extState > AltTabExtState.ALTTABDELAY) {
            this._progress = Math.clamp(
                this._progress + delta / distance,
                0,
                1
            );
            this._adjustment.value = this._progress;
        }
    }

    _gestureEnd(): void {
        if (this._switcher) {
            const win =
                this._switcher._items[this._switcher._selectedIndex].window;
            Main.activateWindow(win);
            this._switcher.destroy();
            this._switcher = undefined;
        }

        this._reset();
    }

    private _reset() {
        if (this._extState > AltTabExtState.DEFAULT) {
            this._extState = AltTabExtState.DEFAULT;

            if (this._altTabTimeoutId) {
                GLib.source_remove(this._altTabTimeoutId);
                this._altTabTimeoutId = 0;
            }

            this._progress = 0;
            this._adjustment.value = 0;
        }

        this._extState = AltTabExtState.DEFAULT;
    }
}
