import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {TouchpadPinchGesture} from './pinchTracker.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';
import {OSD_FRAMETIME_CAP_MS} from '../../constants.js';

export class PinchKeyboardBacklightControlExtension implements ISubExtension {
    private _pinchTracker?: typeof TouchpadPinchGesture.prototype;
    private _brightnessProxy?: Gio.DBusProxy;
    private _lastOsdShowTimestamp: number = 0;
    private _connectHandlers?: number[];

    constructor(private _nfingers: number[]) {}

    apply() {
        const iface = loadInterfaceXML(
            'org.gnome.SettingsDaemon.Power.Keyboard'
        );

        if (iface !== null) {
            const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(
                iface
            ) as unknown as new (
                connection: Gio.DBusConnection,
                name: string | null,
                objectPath: string,
                callback?: (proxy: Gio.DBusProxy, error: Error | null) => void
            ) => Gio.DBusProxy;

            this._brightnessProxy = new BrightnessProxy(
                Gio.DBus.session,
                'org.gnome.SettingsDaemon.Power',
                '/org/gnome/SettingsDaemon/Power',
                (proxy, error) => {
                    if (error)
                        console.error(
                            `Failed to connect to the ${proxy.g_interface_name} D-Bus interface`,
                            error
                        );
                }
            );
        } else {
            console.error('D-Bus interface for keyboard backlight is missing');
            this._brightnessProxy = undefined;
        }

        this._pinchTracker = new TouchpadPinchGesture({
            nfingers: this._nfingers,
            allowedModes: Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        });

        this._connectHandlers = [
            this._pinchTracker.connect('begin', this._gestureBegin.bind(this)),
            this._pinchTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._pinchTracker.connect('end', this._gestureEnd.bind(this)),
        ];
    }

    destroy(): void {
        delete this._brightnessProxy;

        this._connectHandlers?.forEach(handle =>
            this._pinchTracker?.disconnect(handle)
        );
        this._connectHandlers = undefined;
        this._pinchTracker?.destroy();
    }

    get _brightness() {
        return this._brightnessProxy?.Brightness ?? 0;
    }

    set _brightness(value: number) {
        if (
            this._brightnessProxy === undefined ||
            this._brightnessProxy.Brightness === null
        ) {
            return;
        }

        this._brightnessProxy.Brightness = value;
    }

    get _brightnessSteps() {
        return this._brightnessProxy?.Steps ?? 0;
    }

    _showOsd(level: number) {
        // If osd is updated too frequently, it may lag or freeze, so cap it to 30 fps
        const nowTimestamp = new Date().getTime();

        if (nowTimestamp - this._lastOsdShowTimestamp < OSD_FRAMETIME_CAP_MS) {
            return;
        }

        this._lastOsdShowTimestamp = nowTimestamp;

        const icon = Gio.Icon.new_for_string('keyboard-brightness-symbolic');
        Main.osdWindowManager.showAll(icon, null, level, 1);
    }

    _gestureBegin(): void {
        if (
            this._brightnessProxy === undefined ||
            this._pinchTracker === undefined
        ) {
            return;
        }

        this._pinchTracker.confirmPinch(1, [0, 1], this._brightness / 100);
    }

    _gestureUpdate(_tracker: unknown, progress: number): void {
        const interval = this._brightnessSteps - 1;
        const brightness =
            interval > 0 && interval <= 50
                ? Math.round(progress * interval) / interval
                : progress;
        this._brightness = brightness * 100;

        this._showOsd(brightness);
    }

    _gestureEnd(
        _tracker: unknown,
        _duration: number,
        _endProgress: number
    ): void {}
}
