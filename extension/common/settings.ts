import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export enum PinchGestureType {
    NONE = 0,
    SHOW_DESKTOP = 1,
    CLOSE_WINDOW = 2,
    CLOSE_DOCUMENT = 3,
}

export enum SwipeGestureType {
    NONE = 0,
    OVERVIEW_NAVIGATION = 1,
    WORKSPACE_SWITCHING = 2,
    WINDOW_SWITCHING = 3,
    VOLUME_CONTROL = 4,
    BRIGHTNESS_CONTROL = 5,
    WINDOW_MANIPULATION = 6,
}

export enum OverviewNavigationState {
    CYCLIC = 0,
    GNOME = 1,
    WINDOW_PICKER_ONLY = 2,
}

export enum WorkspaceSwitchingState {
    DEFAULT = 0,
    CYCLIC = 1,
}

export enum ForwardBackKeyBinds {
    Default = 0,
    'Forward/Backward' = 1,
    'Page Up/Down' = 2,
    'Right/Left' = 3,
    'Audio Next/Prev' = 4,
    'Tab Next/Prev' = 5,
}

export type BooleanSettingsKeys =
    | 'allow-minimize-window'
    | 'follow-natural-scroll'
    | 'invert-volume-gesture-direction'
    | 'invert-brightness-gesture-direction'
    | 'enable-forward-back-gesture'
    | 'default-overview-gesture-direction'
    | 'enable-vertical-app-gesture';

export type IntegerSettingsKeys = 'alttab-delay' | 'hold-swipe-delay-duration';

export type DoubleSettingsKeys =
    | 'touchpad-speed-scale'
    | 'touchpad-pinch-speed'
    | 'volume-control-speed'
    | 'brightness-control-speed';

export type EnumSettingsKeys =
    | 'vertical-swipe-3-fingers-gesture'
    | 'horizontal-swipe-3-fingers-gesture'
    | 'vertical-swipe-4-fingers-gesture'
    | 'horizontal-swipe-4-fingers-gesture'
    | 'pinch-3-finger-gesture'
    | 'pinch-4-finger-gesture'
    | 'overview-navigation-states'
    | 'workspace-switching-states';

export type MiscSettingsKeys = 'forward-back-application-keyboard-shortcuts';

export type AllSettingsKeys =
    | BooleanSettingsKeys
    | IntegerSettingsKeys
    | DoubleSettingsKeys
    | EnumSettingsKeys
    | MiscSettingsKeys;

export type UIPageObjectIds = 'gestures_page' | 'customizations_page';

export type AllUIObjectKeys =
    | UIPageObjectIds
    | AllSettingsKeys
    | 'touchpad-speed-scale_display-value'
    | 'touchpad-pinch-speed_display-value'
    | 'volume-control-speed_display-value'
    | 'brightness-control-speed_display-value';

type Enum_Functions<K extends EnumSettingsKeys, T> = {
    get_enum(key: K): T;
    set_enum(key: K, value: T): void;
};

type SettingsEnumFunctions = Enum_Functions<
    | 'vertical-swipe-3-fingers-gesture'
    | 'horizontal-swipe-3-fingers-gesture'
    | 'vertical-swipe-4-fingers-gesture'
    | 'horizontal-swipe-4-fingers-gesture',
    SwipeGestureType
> &
    Enum_Functions<
        'pinch-3-finger-gesture' | 'pinch-4-finger-gesture',
        PinchGestureType
    > &
    Enum_Functions<'overview-navigation-states', OverviewNavigationState> &
    Enum_Functions<'workspace-switching-states', WorkspaceSwitchingState>;

type Misc_Functions<K extends MiscSettingsKeys, T extends string> = {
    get_value(key: K): GLib.Variant<T>;
    set_value(key: K, value: GLib.Variant<T>): void;
};

type SettingsMiscFunctions = Misc_Functions<
    'forward-back-application-keyboard-shortcuts',
    'a{s(ib)}'
>;

export type GioSettings = Omit<
    Gio.Settings,
    KeysThatStartsWith<keyof Gio.Settings, 'get_' | 'set_'>
> & {
    get_boolean(key: BooleanSettingsKeys): boolean;
    get_int(key: IntegerSettingsKeys): number;
    get_double(key: DoubleSettingsKeys): number;
    set_double(key: DoubleSettingsKeys, value: number): void;
} & SettingsEnumFunctions &
    SettingsMiscFunctions;
