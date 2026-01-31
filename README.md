<img src="logo.svg" alt="Logo" width="75 " height="75" align="right">

# Touchpad Gesture Customization #

This extension modifies and extends existing touchpad gestures on GNOME using Wayland. This project is a fork of [gnome-gesture-improvements](https://github.com/harshadgavali/gnome-gesture-improvements). Since the original project seems to be no longer maintained, I setup this project with the aim of taking over the development and maintenance of this wonderful extension that I relied on for daily use.

**Note**:
- I have removed the support for X11 since I only use Wayland, but this can be added again in the future if needed and if someone is willing to support this.
- There is a bug in GNOME 49 which break the extension, you have to upgrade to GNOME 49.3 or compile it from source for the extension to work again.

## Installation

### From GNOME Extensions Website

<a href="https://extensions.gnome.org/extension/7850/touchpad-gesture-customization/">
<img src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.svg" alt="Get it on EGO" width="200" />
</a>

### Manually

1. Install extension

```
git clone https://github.com/HieuTNg/touchpad-gesture-customization.git
cd touchpad-gesture-customization
npm install
npm run update
```

2. Log out and log in
3. Enable extension via extensions app or via command line

```
gnome-extensions enable touchpad-gesture-customization@coooolapps.com
```

## Gestures (including built-in ones)

| Swipe Gesture                           | Modes    | Fingers  | Direction           |
| :-------------------------------------- | :------- | :------- | :------------------ |
| Desktop/Overview/AppGrid navigation     | Any      | 3/4/both | Vertical/Horizontal |
| Switch workspaces                       | Overview | 2/3/4    | Horizontal          |
| Switch workspaces                       | Any      | 3/4/both | Vertical/Horizontal |
| Switch app pages                        | AppGrid  | 2/3      | Horizontal          |
| Switch windows                          | Desktop  | 3/4/both | Vertical/Horizontal |
| Unmaximize/maximize/fullscreen a window | Desktop  | 3/4/both | Vertical            |
| Minimize a window                       | Desktop  | 3/4/both | Vertical            |
| Snap/half-tile a window                 | Desktop  | 3/4/both | Vertical (\*)       |
| Volume Control                          | Desktop  | 3/4/both | Vertical/Horizontal |
| Brightness Control                      | Desktop  | 3/4/both | Vertical/Horizontal |

| Pinch Gesture      | Modes   | Fingers |
| :----------------- | :------ | :------ |
| Show Desktop (\*)  | Desktop | 3/4     |
| Close Window       | Desktop | 3/4     |
| Close Tab/Document | Desktop | 3/4     |

| Application Gestures (Configurable) (\*)         |
| :----------------------------------------------- |
| Go back or forward in browser tab                |
| Page up/down                                     |
| Switch to next or previous image in image viewer |
| Switch to next or previous audio                 |
| Change tabs                                      |

#### For activating snapping/tiling gesture (inverted T gesture)

1. Do a 3/4-fingers vertical swipe downward gesture on a unmaximized window but don't release the gesture
2. Wait a few milliseconds
3. Do a 3/4-fingers horizontal swipe gesture to tile a window to either side of the screen

#### For activating application gesture

1. Activating a 3/4-fingers hold gesture on touchpad by pressing your fingers on touchpad but don't release the gesture
2. Wait a few milliseconds
3. Do a 3/4-fingers horizontal swipe gesture to activate application gesture (an arrow animation cicle will appear)

#### Application Gesture Notes

- For horizontal gestures, application gesture only works if 3/4-fingers horizontal swipe is set to **Window Switching**
- Application gesture also supports vertical swipe but is still experimental and requires users to turn off other actions for 3/4-figners vertical swipe (i.e. set the action to None).

#### Notes

- Enabling minimising window gesture for Window Manipulation will disable snapping/tiling gesture.
- If you are using an older version of GNOME, there might be a bug which prevent the extension from detecting **hold and swipe gesture** and **pinch gesture**. If you face this problem, the gesture can only work if the mouse pointer is pointed at the desktop or top panel.

## Customization

- To switch to windows from _all_ workspaces using 3-fingers swipes, run

```
gsettings set org.gnome.shell.window-switcher current-workspace-only false
```

# Acknowledgement

Massive thanks to the original author and everyone who has contributed to the original project to bring us this wonderful GNOME extension.

[gnome-gesture-improvements](https://github.com/harshadgavali/gnome-gesture-improvements) - Original GNOME Gesture Improvement

[Screen Brightness Governor](https://github.com/inbalboa/gnome-brightness-governor) - brightness control code.

[Volume Scroller](https://github.com/francislavoie/gnome-shell-volume-scroller) - volume control code.
