import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import Gvc from 'gi://Gvc';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {ExtSettings, TouchpadConstants} from '../constants.js';

const VolumeIcons = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic',
    'audio-volume-overamplified-symbolic', // Added: Icon for overamplification (> 100%)
];

export class VolumeControlGestureExtension implements ISubExtension {
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _controller?: Gvc.MixerControl;
    private _sink?: Gvc.MixerStream;
    private _maxVolume!: number;
    private _sinkChangeBinding!: number;
    private _lastOsdShowTimestamp: number = 0;
    private _audioSettings!: Gio.Settings; // Added: Settings object to track GNOME sound preferences
    private _maxVolumeLimitRatio: number = 1.0; // Added: Dynamic ratio to handle overamplification state

    apply() {
        this._controller = Volume.getMixerControl();

        this._maxVolume = this._controller.get_vol_max_norm();

        // Initializing GNOME sound settings to check for overamplification toggle
        this._audioSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.sound',
        });

        this._sink = this._controller.get_default_sink();
        this._sinkChangeBinding = this._controller.connect(
            'default-sink-changed',
            this._handleSinkChange.bind(this)
        );
    }

    destroy(): void {
        this._controller?.disconnect(this._sinkChangeBinding);
        delete this._controller;
        delete this._sink;

        // @ts-expect-error: audioSettings is a private property that needs cleanup
        delete this._audioSettings; // Cleanup settings object

        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalSwipeTracker?.disconnect(handle)
        );
        this._verticalConnectHandlers = undefined;
        this._verticalSwipeTracker?.destroy();

        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();
    }

    setVerticalSwipeTracker(nfingers: number[]) {
        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            !ExtSettings.INVERT_VOLUME_DIRECTION,
            TouchpadConstants.VOLUME_CONTROL_MULTIPLIER,
            {allowTouch: false}
        );

        this._verticalConnectHandlers = [
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
        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            !ExtSettings.INVERT_VOLUME_DIRECTION,
            TouchpadConstants.VOLUME_CONTROL_MULTIPLIER,
            {allowTouch: false}
        );

        this._horizontalConnectHandlers = [
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

    _handleSinkChange(controller: Gvc.MixerControl, id: number) {
        this._sink = controller.lookup_stream_id(id);
    }

    _showOsd(volume: number) {
        // If osd is updated too frequently, it may lag or freeze, so cap it to 30 fps
        const nowTimestamp = Date.now();

        if (nowTimestamp - this._lastOsdShowTimestamp < 1000 / 30) {
            return;
        }

        this._lastOsdShowTimestamp = nowTimestamp;

        const level = volume / this._maxVolume;

        // Logic to select the correct icon, including the overamplified one
        let iconIndex: number;

        if (volume === 0) {
            iconIndex = 0;
        } else if (level > 1.0) {
            iconIndex = 4; // Use overamplified icon
        } else {
            iconIndex = Math.clamp(Math.floor(3 * level + 1), 1, 3);
        }

        const icon = Gio.Icon.new_for_string(VolumeIcons[iconIndex]);
        const label = this._sink?.get_port().human_port ?? ''; // Recovered label logic

        Main.osdWindowManager.showAll(icon, label, level, this._maxVolumeLimitRatio);
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        if (this._sink === undefined || this._controller === undefined) {
            return;
        }

        // Check if "Overamplification" is enabled in GNOME Settings
        const isOverampEnabled = this._audioSettings.get_boolean(
            'allow-volume-above-100-percent'
        );

        // Calculate the actual multiplier: 1.0 if disabled, usually ~1.5 if enabled
        this._maxVolumeLimitRatio = isOverampEnabled
            ? this._controller.get_vol_max_amplified() / this._maxVolume
            : 1.0;

        _tracker.confirmSwipe(
            global.screen_height,
            [0, this._maxVolumeLimitRatio], // Set the dynamic swipe range based on overamplification state
            this._sink.volume / this._maxVolume, // current normalized volume
            0
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        if (this._sink === undefined) {
            return;
        }

        const volume = progress * this._maxVolume;

        if (volume > 0) {
            this._sink.change_is_muted(false);
        }

        this._sink.volume = volume;
        this._sink.push_volume();

        this._showOsd(volume);
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: number
    ): void {}
}
