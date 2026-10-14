#!/bin/bash
#
# The disk image. Kept under this name because it is the one people type, but the work is create-dmg's: hdiutil plus
# Finder was tried here first, and Finder refused half of what it was asked for — silently, in two different ways,
# with a volume-name cache in the middle. The layout it produced was never the one anybody wanted.
#
# create-dmg has met all of that before. See package-dmg-create.sh for the flags that shape the window.
#
set -euo pipefail
cd "$(dirname "$0")"
exec bash package-dmg-create.sh "$@"
