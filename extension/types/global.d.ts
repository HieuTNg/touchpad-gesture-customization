declare interface IExtension {
    enable(): void;
    disable(): void;
}

declare interface ISubExtension {
    apply?(): void;
    destroy(): void;
}

declare type KeysThatStartsWith<
    K extends string,
    U extends string,
> = K extends `${U}${infer _R}` ? K : never;

declare type KeysOfType<T, U> = {
    [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];

declare type compositor = typeof global.compositor & {
    disable_unredirect(): void;
    enable_unredirect(): void;
};
