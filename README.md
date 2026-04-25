<img src="logo.svg" alt="Logo" width="75 " height="75" align="right">

# Touchpad Gesture Customization #

This extension modifies and extends existing touchpad gestures on GNOME using Wayland. This project is a fork of [gnome-gesture-improvements](https://github.com/harshadgavali/gnome-gesture-improvements). Since the original project seems to be no longer maintained, I setup this project with the aim of taking over the development and maintenance of this wonderful extension that I relied on for daily use.

**Note**:
- ```main``` branch contains latest changes which are optimized for GNOME 50+ and Ubuntu 26 LTS.
- I have removed the support for X11 since I only use Wayland, but this can be added again in the future if needed and if someone is willing to support this.
- **GNOME 50 Compatibility**: This extension has been fully audited for GNOME 50, including fixes for Wayland virtual input device timestamps and ESM module compatibility.

## Installation

### From GNOME Extensions Website

<a href="https://extensions.gnome.org/extension/7850/touchpad-gesture-customization/">
<img src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.svg" alt="Get it on EGO" width="200" />
</a>

### From Source (using Bun — recommended)

> **Bun** is a fast all-in-one JavaScript toolkit. Install it from [bun.sh](https://bun.sh).

```bash
git clone https://github.com/HieuTNg/touchpad-gesture-customization.git
cd touchpad-gesture-customization
bun install
bun run update
```

### From Source (using npm)

```bash
git clone https://github.com/HieuTNg/touchpad-gesture-customization.git
cd touchpad-gesture-customization
npm install
npm run update
```

### After Installation

1. Log out and log back in (required on Wayland to reload GNOME Shell).
2. Enable the extension:

```bash
gnome-extensions enable touchpad-gesture-customization@coooolapps.com
```

## Gestures (including built-in ones)

### Default Configuration

By default, the extension is configured with the following gestures:

| Gesture Type | Direction | 3 Fingers | 4 Fingers |
| :--- | :--- | :--- | :--- |
| **Swipe** | Vertical | Overview/AppGrid Navigation | Window Manipulation (Snap/Tile) |
| **Swipe** | Horizontal | Window Switching (Alt-Tab) | Workspace Switching |
| **Pinch** | In/Out | Close Tab/Document | Close Window |

### 2-Finger Horizontal Navigation (Alt+Left / Alt+Right)

> **Disabled by default.** Enable in extension settings under the **Misc** tab.

| Swipe Direction | Action | Works In |
| :--- | :--- | :--- |
| ← Left | **Back** (Alt+Left) | Chrome, Firefox, Nautilus |
| → Right | **Forward** (Alt+Right) | Chrome, Firefox, Nautilus |

- Uses `Clutter.VirtualInputDevice` — fully Wayland-safe, no X11 dependency.
- **Expert Calibration**: Key injection timestamps are optimized for Mutter 50 (milliseconds instead of microseconds) to prevent "stale event" rejections.
- A **"Reverse Direction"** toggle is available for natural scrolling preference.
- Triggers once per swipe gesture (debounced with 500ms reset for high-precision touchpads).

### Available Configurable Actions

You can configure any of the 3-finger or 4-finger gestures to perform the following actions:

#### Swipe Gesture Actions

| Action | Description | Direction |
| :--- | :--- | :--- |
| Overview Navigation | Open Activities / App Grid | Vertical / Horizontal |
| Workspace Switching | Move between virtual workspaces | Vertical / Horizontal |
| Window Switching | Alt-Tab style window cycling | Vertical / Horizontal |
| Window Manipulation | Maximize / unmaximize / snap windows to sides | Vertical |
| **Maximize Window** *(new)* | Toggle maximize on the focused window | Vertical / Horizontal |
| **Minimize All Windows** *(new)* | Minimize all windows on the active workspace; reverse gesture to restore | Vertical / Horizontal |
| **Close Window** *(new)* | Close the focused application window | Vertical / Horizontal |
| **Close Tab (Ctrl+W)** *(new)* | Close the current tab / document | Vertical / Horizontal |
| Show Desktop | Hide all windows to reveal the desktop | Vertical / Horizontal |
| Volume Control | Adjust system volume | Vertical / Horizontal |
| Brightness Control | Adjust screen brightness | Vertical / Horizontal |

#### Pinch Gesture Actions

| Action | Description |
| :--- | :--- |
| Show Desktop | Hide all windows |
| Close Window | Close the focused window |
| Close Tab / Document | Send Ctrl+W to close the active tab |
| Show Notification List | Open the calendar / notification panel |
| Maximize Window | Toggle maximize on the focused window |
| Minimize All Windows | Minimize all windows on the active workspace |

#### Application Gestures (Configurable)

| Action |
| :--- |
| Go back or forward in browser tab |
| Page up/down |
| Switch to next or previous image in image viewer |
| Switch to next or previous audio |
| Change tabs |

### Gesture Instructions

#### Snapping / Tiling (Inverted-T gesture)

1. Do a 3/4-fingers vertical swipe downward gesture on an unmaximized window but don't release the gesture
2. Wait a few milliseconds
3. Do a 3/4-fingers horizontal swipe gesture to tile a window to either side of the screen

#### Application Gesture

1. Activate a 3/4-fingers hold gesture on touchpad by pressing your fingers but don't release
2. Wait a few milliseconds
3. Do a 3/4-fingers horizontal swipe gesture to activate the application gesture (an arrow animation will appear)

#### Application Gesture Notes

- For horizontal gestures, application gesture only works if 3/4-fingers horizontal swipe is set to **Window Switching**
- Application gesture also supports vertical swipe but is still experimental and requires users to turn off other actions for 3/4-fingers vertical swipe (i.e. set the action to None).

#### Notes

- Enabling minimizing window gesture for Window Manipulation will disable snapping/tiling gesture.
- If you are using an older version of GNOME, there might be a bug which prevent the extension from detecting **hold and swipe gesture** and **pinch gesture**. If you face this problem, the gesture can only work if the mouse pointer is pointed at the desktop or top panel.

## Development

### Prerequisites

- GNOME Shell 50+ (Ubuntu 26 LTS recommended)
- Node.js v20+ or [Bun](https://bun.sh) v1.3+
- TypeScript, ESLint, Prettier (installed via `bun install`)

### Build Commands

| Command | Description |
| :--- | :--- |
| `bun install` | Install all dependencies |
| `bun run build` | Lint, format, and compile TypeScript |
| `bun run pack` | Build and create the `.zip` extension package |
| `bun run update` | Pack and install the extension into GNOME Shell |
| `bun run clean-dev` | Remove `build/` and `node_modules/` |

### Project Structure

```
extension/
├── extension.ts          # Main extension lifecycle (enable/disable)
├── common/settings.ts    # GSettings type definitions and enums
├── src/
│   ├── maximize.ts       # Maximize Window gesture handler
│   ├── minimizeAll.ts    # Minimize All Windows gesture handler
│   ├── closeWindowSwipe.ts # Close Window / Close Tab swipe handler
│   ├── snapWindow.ts     # Window Manipulation (snap/tile) handler
│   ├── altTab.ts         # Window Switching (Alt-Tab) handler
│   ├── showDesktop.ts    # Show Desktop handler
│   ├── twoFingerNav.ts   # 2-Finger Horizontal Navigation (Back/Forward)
│   └── ...               # Volume, Brightness, Overview, etc.
├── schemas/              # GSettings XML schema
├── ui/                   # GTK4 Preferences UI definitions
└── prefs/                # Preferences page logic
```

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
