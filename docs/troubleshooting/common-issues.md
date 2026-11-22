# Common Issues

## The extension is installed but does not load

GNOME Shell only scans extensions when the session starts. After a manual
install, log out and log back in. On Wayland the shell cannot be restarted
without ending the session, so the `ReloadExtension` D-Bus method is
deprecated:

```
org.freedesktop.DBus.Error.NotSupported: ReloadExtension is deprecated and does not work
```

## Gestures stop working when an external mouse is connected

GNOME can disable the touchpad while a mouse is present. Check the current
setting:

```
gsettings get org.gnome.desktop.peripherals.touchpad send-events
```

If the value is `disabled-on-external-mouse`, enable the touchpad with:

```
gsettings set org.gnome.desktop.peripherals.touchpad send-events enabled
```