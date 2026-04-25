#!/bin/bash
set -e

echo "=== Touchpad Gesture Customization — Setup (GNOME 50 / Ubuntu 26 LTS) ==="
echo ""

# 1. Verify Wayland Session
if [ "$XDG_SESSION_TYPE" != "wayland" ]; then
    echo "⚠  Warning: You are not using a Wayland session (current: $XDG_SESSION_TYPE)."
    echo "   This extension is optimized for Wayland. It may not work correctly on X11."
else
    echo "✓  Wayland session detected."
fi

# 2. Install System Dependencies
echo ""
echo "[1/4] Installing system dependencies..."
sudo apt update -qq
sudo apt install -y -qq git curl build-essential zip unzip libglib2.0-bin gnome-shell

# 3. Install Bun (fast JS runtime & package manager)
echo ""
echo "[2/4] Setting up Bun..."
if command -v bun &>/dev/null; then
    echo "✓  Bun is already installed: $(bun --version)"
elif [ -x "$HOME/.bun/bin/bun" ]; then
    echo "✓  Bun found at ~/.bun/bin/bun"
    export PATH="$HOME/.bun/bin:$PATH"
else
    echo "   Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# Ensure bun is on PATH for this session
export PATH="$HOME/.bun/bin:$PATH"

# 4. Install Dependencies
echo ""
echo "[3/4] Installing project dependencies..."
bun install

# 5. Build, Pack, and Install
echo ""
echo "[4/4] Building and installing the extension..."
bun run build
make pack
make update

# 6. Done
echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "  1. Log out and log back in (required on Wayland to reload GNOME Shell)"
echo "  2. Enable the extension:"
echo "     gnome-extensions enable touchpad-gesture-customization@coooolapps.com"
echo "  3. Open 'Extensions' app to configure your gestures"
