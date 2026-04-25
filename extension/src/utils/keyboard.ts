import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

const DELAY_BETWEEN_KEY_PRESS = 10; // ms
const timeoutIds = new Set<number>();

class VirtualKeyboard {
    private _virtualDevice: Clutter.VirtualInputDevice;

    constructor() {
        // In modern GNOME (46+), the seat is best retrieved from the backend directly
        const backend = Clutter.get_default_backend();
        const seat = backend.get_default_seat();

        this._virtualDevice = seat.create_virtual_device(
            Clutter.InputDeviceType.KEYBOARD_DEVICE
        );
    }

    /**
     * Injects a sequence of key presses and releases.
     * Use for injecting combinations like Alt + Left.
     */
    sendKeys(keys: number[]) {
        const keyEvents: [number, Clutter.KeyState][] = [];

        // Build the sequence: Alt Down, Left Down, Left Up, Alt Up
        keys.forEach(key => keyEvents.push([key, Clutter.KeyState.RELEASED]));
        [...keys]
            .reverse()
            .forEach(key => keyEvents.push([key, Clutter.KeyState.PRESSED]));

        let timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            DELAY_BETWEEN_KEY_PRESS,
            () => {
                const keyEvent = keyEvents.pop();

                if (keyEvent !== undefined) {
                    this._sendKey(...keyEvent);
                }

                if (keyEvents.length === 0) {
                    timeoutIds.delete(timeoutId);
                    timeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            }
        );

        if (timeoutId) timeoutIds.add(timeoutId);
    }

    private _sendKey(keyval: number, keyState: Clutter.KeyState) {
        if (!this._virtualDevice) return;

        /**
         * Monotonic time is required for Wayland validation.
         * Many Mutter versions expect milliseconds (not microseconds) for notify_keyval.
         */
        const timeMs = GLib.get_monotonic_time() / 1000;
        this._virtualDevice.notify_keyval(timeMs, keyval, keyState);
    }
}

export type IVirtualKeyboard = VirtualKeyboard;

let _keyboard: VirtualKeyboard | undefined;

/**
 *
 */
export function getVirtualKeyboard() {
    _keyboard = _keyboard ?? new VirtualKeyboard();
    return _keyboard;
}

/**
 *
 */
export function extensionCleanup() {
    timeoutIds.forEach(id => GLib.Source.remove(id));
    timeoutIds.clear();
    _keyboard = undefined;
}
