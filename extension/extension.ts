import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {
    AllSettingsKeys,
    PinchGestureType,
    SwipeGestureType,
} from './common/settings.js';
import * as Constants from './constants.js';
import {OverviewRoundTripGestureExtension} from './src/overviewRoundTrip.js';
import {WorkspaceSwitchingExtension} from './src/workspaceSwitching.js';
import AltTabGestureExtension from './src/altTab.js';
import {
    ForwardBackGestureExtension,
    type AppForwardBackKeyBinds,
} from './src/forwardBack.js';
import * as VKeyboard from './src/utils/keyboard.js';
import {SnapWindowExtension} from './src/snapWidnow.js';
import {ShowDesktopExtension} from './src/pinchGestures/showDesktop.js';
import {CloseWindowExtension} from './src/pinchGestures/closeWindow.js';

// import {VolumeControlGestureExtension} from './src/volumeControl.js';
// import {BrightnessControlGestureExtension} from './src/brightnessControl.js';

export default class TouchpadGestureCustomization extends Extension {
    private _extensions: ISubExtension[];
    settings?: Gio.Settings;
    private _settingChangedId = 0;
    private _reloadWaitId = 0;
    private _addReloadDelayFor: AllSettingsKeys[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(metadata: any) {
        super(metadata);

        this._extensions = [];
        this._addReloadDelayFor = [
            'touchpad-speed-scale',
            'alttab-delay',
            'touchpad-pinch-speed',
            'volume-control-speed',
            'brightness-control-speed',
        ];
    }

    enable() {
        this.settings = this.getSettings();
        this._settingChangedId = this.settings.connect(
            'changed',
            this.reload.bind(this)
        );
        this._enable();
    }

    disable() {
        if (this.settings) this.settings.disconnect(this._settingChangedId);

        if (this._reloadWaitId !== 0) {
            GLib.source_remove(this._reloadWaitId);
            this._reloadWaitId = 0;
        }

        this.settings = undefined;

        this._disable();
    }

    reload(_settings: never, key: AllSettingsKeys) {
        if (this._reloadWaitId !== 0) GLib.source_remove(this._reloadWaitId);

        this._reloadWaitId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._addReloadDelayFor.includes(key) ? Constants.RELOAD_DELAY : 0,
            () => {
                this._disable();
                this._enable();
                this._reloadWaitId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _enable() {
        this._initializeSettings();
        this._extensions = [];
        if (this.settings === undefined) return;

        const verticalSwipeToFingersMap =
            this._getVerticalSwipeGestureTypeAndFingers();
        const horizontalSwipeToFingersMap =
            this._getHorizontalSwipeGestureTypeAndFingers();

        /**
         * Overview navigation
         */

        const verticalOverviewNavigationFingers = verticalSwipeToFingersMap.get(
            SwipeGestureType.OVERVIEW_NAVIGATION
        );

        const horizontalOverviewNavigationFingers =
            horizontalSwipeToFingersMap.get(
                SwipeGestureType.OVERVIEW_NAVIGATION
            );

        const overviewRoundTripGesterExtension =
            new OverviewRoundTripGestureExtension(
                this.settings.get_enum('overview-navigation-states')
            );

        // By default, disable overview navigation when user doesn't assign any gestures
        overviewRoundTripGesterExtension.setVerticalSwipeTracker([]);

        // Enable vertical swipe for overview navigation
        if (verticalOverviewNavigationFingers?.length) {
            overviewRoundTripGesterExtension.setVerticalSwipeTracker(
                verticalOverviewNavigationFingers
            );
        }

        // Enable horizontal swipe for overview navigation
        if (horizontalOverviewNavigationFingers?.length) {
            overviewRoundTripGesterExtension?.setHorizontalSwipeTracker(
                horizontalOverviewNavigationFingers
            );
        }

        this._extensions.push(overviewRoundTripGesterExtension);

        /**
         * Workspace navigation
         */

        // TODO: match workspace navigation control in overview mode and normal mode

        const verticalWorkspaceNavigationFingers =
            verticalSwipeToFingersMap.get(SwipeGestureType.WORKSPACE_SWITCHING);
        const horizontalWorkspaceNavigationFingers =
            horizontalSwipeToFingersMap.get(
                SwipeGestureType.WORKSPACE_SWITCHING
            );

        const gestureExtension = new WorkspaceSwitchingExtension();

        // Disable default workspace navigation using horizontal swipe
        gestureExtension.setHorizontalWorkspaceAnimationModifier([]);

        // Enable vertical swipe for workspace navigation
        if (verticalWorkspaceNavigationFingers?.length)
            gestureExtension.setVerticalWorkspceAnimationModifier(
                verticalWorkspaceNavigationFingers
            );

        // Enable horizontal swipe for workspace navigation
        if (horizontalWorkspaceNavigationFingers?.length)
            gestureExtension.setHorizontalWorkspaceAnimationModifier(
                horizontalWorkspaceNavigationFingers
            );

        this._extensions.push(gestureExtension);

        /**
         * Window switching (Alt + tab)
         */

        const verticalWindowSwitchingFingers = verticalSwipeToFingersMap.get(
            SwipeGestureType.WINDOW_SWITCHING
        );
        const horizontalWindowSwitchingFingers =
            horizontalSwipeToFingersMap.get(SwipeGestureType.WINDOW_SWITCHING);

        if (
            verticalWindowSwitchingFingers?.length ||
            horizontalWindowSwitchingFingers?.length
        ) {
            // TODO: update class name to WindowSwitchingGestureExtension
            const windowSwitchingGestureExtension =
                new AltTabGestureExtension();

            // Enable vertical swipe for window switching
            if (verticalWindowSwitchingFingers?.length)
                windowSwitchingGestureExtension.setVerticalTouchpadSwipeTracker(
                    verticalWindowSwitchingFingers
                );

            // Enable horizontal swipe for window switching
            if (horizontalWindowSwitchingFingers?.length)
                windowSwitchingGestureExtension.setHorizontalTouchpadSwipeTracker(
                    horizontalWindowSwitchingFingers
                );

            this._extensions.push(windowSwitchingGestureExtension);
        }

        /**
         * Pinch Gestures
         */

        const pinchToFingersMap = this._getPinchGestureTypeAndFingers();

        // pinch to show desktop (not working)
        const showDesktopFingers = pinchToFingersMap.get(
            PinchGestureType.SHOW_DESKTOP
        );

        if (showDesktopFingers?.length) {
            this._extensions.push(new ShowDesktopExtension(showDesktopFingers));
        }

        // pinch to close window
        const closeWindowFingers = pinchToFingersMap.get(
            PinchGestureType.CLOSE_WINDOW
        );
        if (closeWindowFingers?.length)
            this._extensions.push(
                new CloseWindowExtension(
                    closeWindowFingers,
                    PinchGestureType.CLOSE_WINDOW
                )
            );

        // pinch to close document
        const closeDocumentFingers = pinchToFingersMap.get(
            PinchGestureType.CLOSE_DOCUMENT
        );
        if (closeDocumentFingers?.length)
            this._extensions.push(
                new CloseWindowExtension(
                    closeDocumentFingers,
                    PinchGestureType.CLOSE_DOCUMENT
                )
            );

        // TODO: consider having an option for 'hold and swipe gestures' that can either
        // be set to window tiling or app gesture (need to fix how to activate window tiling with
        // hold and swipe without being blocked by overview navigation)

        /**
         * Window Tiling/snapping & minimisation
         */

        // TODO: when both vertical and horizontal swipe are not set to window manipulation
        // the switch for minimise window should be disbaled
        const verticalWindowManipulationFingers = verticalSwipeToFingersMap.get(
            SwipeGestureType.WINDOW_MANIPULATION
        );

        if (verticalWindowManipulationFingers?.length)
            this._extensions.push(
                new SnapWindowExtension(verticalWindowManipulationFingers)
            );

        /**
         * Volume Control
         */

        // const verticalVolumeControlFingers = verticalSwipeToFingersMap.get(
        //     SwipeGestureType.VOLUME_CONTROL
        // );
        // const horizontalVolumeControlFingers = horizontalSwipeToFingersMap.get(
        //     SwipeGestureType.VOLUME_CONTROL
        // );

        // if (
        //     verticalVolumeControlFingers?.length ||
        //     horizontalVolumeControlFingers?.length
        // ) {
        //     const volumeControlGestureExtension =
        //         new VolumeControlGestureExtension();

        //     // Enable vertical swipe for overview navigation
        //     if (verticalVolumeControlFingers?.length) {
        //         volumeControlGestureExtension.setVerticalSwipeTracker(
        //             verticalVolumeControlFingers
        //         );
        //     }

        //     // Enable horizontal swipe for overview navigation
        //     if (horizontalVolumeControlFingers?.length) {
        //         volumeControlGestureExtension.setHorizontalSwipeTracker(
        //             horizontalVolumeControlFingers
        //         );
        //     }

        //     this._extensions.push(volumeControlGestureExtension);
        // }

        // /**
        //  * Brightness Control
        //  */

        // const verticalBrightnessControlFingers = verticalSwipeToFingersMap.get(
        //     SwipeGestureType.BRIGHTNESS_CONTROL
        // );
        // const horizontalBrightnessControlFingers =
        //     horizontalSwipeToFingersMap.get(
        //         SwipeGestureType.BRIGHTNESS_CONTROL
        //     );

        // if (
        //     verticalBrightnessControlFingers?.length ||
        //     horizontalBrightnessControlFingers?.length
        // ) {
        //     const brightnessControlGestureExtension =
        //         new BrightnessControlGestureExtension();

        //     // Enable vertical swipe for overview navigation
        //     if (verticalBrightnessControlFingers?.length) {
        //         brightnessControlGestureExtension.setVerticalSwipeTracker(
        //             verticalBrightnessControlFingers
        //         );
        //     }

        //     // Enable horizontal swipe for overview navigation
        //     if (horizontalBrightnessControlFingers?.length) {
        //         brightnessControlGestureExtension.setHorizontalSwipeTracker(
        //             horizontalBrightnessControlFingers
        //         );
        //     }

        //     this._extensions.push(brightnessControlGestureExtension);
        // }

        /**
         * App Gestures
         */
        if (this.settings.get_boolean('enable-forward-back-gesture')) {
            const appForwardBackKeyBinds: AppForwardBackKeyBinds = this.settings
                .get_value('forward-back-application-keyboard-shortcuts')
                .deepUnpack() as AppForwardBackKeyBinds;

            this._extensions.push(
                new ForwardBackGestureExtension(
                    appForwardBackKeyBinds,
                    this.metadata.dir.get_uri(),
                    this.settings.get_boolean('enable-vertical-app-gesture')
                )
            );
        }

        this._extensions.forEach(extension => extension.apply?.());
    }

    private _getVerticalSwipeGestureTypeAndFingers(): Map<
        SwipeGestureType,
        number[]
    > {
        if (!this.settings) return new Map();

        const verticalSwipe3FingerGesture = this.settings.get_enum(
            'vertical-swipe-3-fingers-gesture'
        );
        const verticalSwipe4FingerGesture = this.settings.get_enum(
            'vertical-swipe-4-fingers-gesture'
        );

        const swipeGestureToFingersMap = new Map<SwipeGestureType, number[]>();

        if (verticalSwipe3FingerGesture === verticalSwipe4FingerGesture)
            swipeGestureToFingersMap.set(verticalSwipe3FingerGesture, [3, 4]);
        else {
            swipeGestureToFingersMap.set(verticalSwipe3FingerGesture, [3]);
            swipeGestureToFingersMap.set(verticalSwipe4FingerGesture, [4]);
        }

        return swipeGestureToFingersMap;
    }

    private _getHorizontalSwipeGestureTypeAndFingers(): Map<
        SwipeGestureType,
        number[]
    > {
        if (!this.settings) return new Map();

        const horizontalSwipe3FingerGesture = this.settings.get_enum(
            'horizontal-swipe-3-fingers-gesture'
        );
        const horizontalSwipe4FingerGesture = this.settings.get_enum(
            'horizontal-swipe-4-fingers-gesture'
        );

        const swipeGestureToFingersMap = new Map<SwipeGestureType, number[]>();

        if (horizontalSwipe3FingerGesture === horizontalSwipe4FingerGesture)
            swipeGestureToFingersMap.set(horizontalSwipe3FingerGesture, [3, 4]);
        else {
            swipeGestureToFingersMap.set(horizontalSwipe3FingerGesture, [3]);
            swipeGestureToFingersMap.set(horizontalSwipe4FingerGesture, [4]);
        }

        return swipeGestureToFingersMap;
    }

    private _getPinchGestureTypeAndFingers(): Map<PinchGestureType, number[]> {
        if (!this.settings) return new Map();

        const pinch3FingerGesture = this.settings.get_enum(
            'pinch-3-finger-gesture'
        );
        const pinch4FingerGesture = this.settings.get_enum(
            'pinch-4-finger-gesture'
        );

        const gestureToFingersMap = new Map<PinchGestureType, number[]>();

        if (pinch3FingerGesture === pinch4FingerGesture)
            gestureToFingersMap.set(pinch3FingerGesture, [3, 4]);
        else {
            gestureToFingersMap.set(pinch3FingerGesture, [3]);
            gestureToFingersMap.set(pinch4FingerGesture, [4]);
        }

        return gestureToFingersMap;
    }

    _initializeSettings() {
        if (this.settings) {
            Constants.ExtSettings.ALLOW_MINIMIZE_WINDOW =
                this.settings.get_boolean('allow-minimize-window');
            Constants.ExtSettings.FOLLOW_NATURAL_SCROLL =
                this.settings.get_boolean('follow-natural-scroll');
            Constants.ExtSettings.DEFAULT_OVERVIEW_GESTURE_DIRECTION =
                this.settings.get_boolean('default-overview-gesture-direction');
            Constants.ExtSettings.INVERT_VOLUME_DIRECTION =
                this.settings.get_boolean('invert-volume-gesture-direction');
            Constants.ExtSettings.INVERT_BRIGHTNESS_DIRECTION =
                this.settings.get_boolean(
                    'invert-brightness-gesture-direction'
                );
            Constants.ExtSettings.APP_GESTURES = this.settings.get_boolean(
                'enable-forward-back-gesture'
            );

            Constants.TouchpadConstants.SWIPE_MULTIPLIER =
                Constants.TouchpadConstants.DEFAULT_SWIPE_MULTIPLIER *
                this.settings.get_double('touchpad-speed-scale');
            Constants.TouchpadConstants.PINCH_MULTIPLIER =
                Constants.TouchpadConstants.DEFAULT_PINCH_MULTIPLIER *
                this.settings.get_double('touchpad-pinch-speed');
            Constants.TouchpadConstants.VOLUME_CONTROL_MULTIPLIER =
                Constants.TouchpadConstants.DEFAULT_VOLUME_CONTROL_MULTIPLIER *
                this.settings.get_double('volume-control-speed');
            Constants.TouchpadConstants.BRIGHTNESS_CONTROL_MULTIPLIER =
                Constants.TouchpadConstants
                    .DEFAULT_BRIGHTNESS_CONTROL_MULTIPLIER *
                this.settings.get_double('brightness-control-speed');
            Constants.AltTabConstants.DELAY_DURATION =
                this.settings.get_int('alttab-delay');
            Constants.TouchpadConstants.HOLD_SWIPE_DELAY_DURATION =
                this.settings.get_int('hold-swipe-delay-duration');
        }
    }

    _disable() {
        VKeyboard.extensionCleanup();
        this._extensions.reverse().forEach(extension => extension.destroy());
        this._extensions = [];
    }
}
