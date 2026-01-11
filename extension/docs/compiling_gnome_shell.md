# Compiling GNOME Shell with patch

## Caution
* The following instruction is only here for guidance and doesn't guarantee to work.
* The following instruction can cause your system to become unstable and even stop working.
* The following instruction is only intended for **gnome shell 49.2** and may be removed in the future.
* If your distribution latest update doesn't have **gnome shell 49.2**, the following instruction will not apply but can still be used for consultation.
* Always backup your system before attempting any risky task.
* In the event of failure, the author cannot provide any support.
* The below instruction is mainly geared toward Fedora users but other distribution should follow sismilar steps with different package naming and package management tool.
* If you have tried compiling yourself and would like to contribute, this would be a good place to start by writing instruction for your distribution.

## Tips
If you have lots of storage on your storage device, free up some space for a new partition to install a temporary OS for testing (any distribution of your choice, ideally matching your current distro). That way you can try compiling gnome shell yourself and if it fail, you can simply remove the temporary partition without affecting your current system.

## Fedora

### Obtaining GNOME Shell source code and correct patch
* [GNOME Shell source code](https://gitlab.gnome.org/GNOME/gnome-shell/-/releases/49.2)
* [GNOME Shell patch](https://gitlab.gnome.org/GNOME/gnome-shell/-/merge_requests/3997.patch)
* Extract the downloaded GNOME Shell source code (e.g. zip, tar.gz, etc) and copy the patch file to the extracted GNOME Shell source code folder

### Appling patch and compiling
1. update your system to the latest version and check gnome shell version

```
sudo dnf update -y
gnome-shell --version
```

2. Apply patch

```
cd gnome-shell-49.2
patch -p1 < /path/to/3397.patch # Change this to the correct path
```

3. Installing required dependencies for compilation (you can remove these package after compiling and if you no longer need to recompile)

```
sudo dnf install git meson ninja-build libsass-devel cmake gcc-c++ gnome-shell-devel NetworkManager-libnm python3-docutils pulseaudio-libs-devel nodejs npm glib2-devel gtk3-devel gnome-desktop3-devel cairo-devel gdk-pixbuf2-devel atk-devel gcr-devel gjs-devel mutter-devel polkit-devel -y
sudo npm install -g jasmine
```

4. Compiling

```
meson setup _build
meson compile -C _build
```

**Note**: gnome shell has lots of dependencies, the most common error that user encountered when compiling gnome shell is missing dependencies. I tried to be as exhaustive as possible but I can still miss some dependencies. Often, the missing dependency will be stated clearly in the error message, user just need to find the appropriate dependency for their distribution and install it.

### Installing patched gnome shell
1. Switch to a TTY (Ctrl+Alt+F3) (you will need to write down the instruction below somewhere since you will need to stop the graphic session)

2. login to TTY session with your username and password

3. stop the graphical session and gnome-shell

```
sudo systemctl isolate multi-user.target
```

4. navigate to the extracted gnome shell folder and install built files

```
cd path/to/gnome-shell-49.2 # replace with the right path
sudo meson install -C _build
```

**Note**: This will copy files into /usr (or your meson prefix) and overwrite system files.

5. reboot the system

**Note**: there is no command to verify if the installation has been successful after reboot, but if you sucessfully boot into the system, it is likely that you have successfully patched and compiled gnome shell and you can verify this by installing the extension to see if it works.

## Arch Linux
* Arch Linux instruction seems to be much easiser than Fedora but I haven't tested this so please consult [@clover-yan's instruction](https://github.com/HieuTNg/touchpad-gesture-customization/issues/22#issuecomment-3694392532)

## Other methods
* compiling method that uses container will not work with this extension since the extension is modifying gnome shell directly and not simply running on gnome shell like an application glibc glibc-devel