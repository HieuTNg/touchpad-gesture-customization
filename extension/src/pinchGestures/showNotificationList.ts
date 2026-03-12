import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {TouchpadPinchGesture} from './pinchTracker.js';

enum ShowNotificationListGestureState {
	PINCH_IN = -1,
	DEFAULT = 0,
}

declare type Type_TouchpadPinchGesture = typeof TouchpadPinchGesture.prototype;

export class ShowNotificationListExtension implements ISubExtension {
	private _pinchTracker: Type_TouchpadPinchGesture;

	constructor(
        nfingers: number[],
    ) {
		this._pinchTracker = new TouchpadPinchGesture({
			nfingers: nfingers,
			allowedModes: Shell.ActionMode.NORMAL,
			pinchSpeed: 0.25,
		});
		this._pinchTracker.connect('begin', this.gestureBegin.bind(this));
		this._pinchTracker.connect('end', this.gestureEnd.bind(this));
	}

	destroy(): void {
		this._pinchTracker.destroy();
	}

	gestureBegin(tracker: Type_TouchpadPinchGesture) {
		tracker.confirmPinch(
            0,
            [ShowNotificationListGestureState.PINCH_IN, ShowNotificationListGestureState.DEFAULT],
            ShowNotificationListGestureState.DEFAULT
        );
	}

	gestureEnd(
        _tracker: unknown,
        _duration: number,
        progress: ShowNotificationListGestureState
    ) {
		switch (progress) {
			case ShowNotificationListGestureState.DEFAULT:
				break;
			case ShowNotificationListGestureState.PINCH_IN:
				this._invokeGestureCompleteAction();
		}
	}

	private _invokeGestureCompleteAction() {
		Main.panel.toggleCalendar();
	}
}