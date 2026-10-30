#!/bin/sh
# Builds fiddle-disclaim and selfcheck as universal (arm64 and x86_64) binaries
# in build/, or in the folder given as the first argument. macOS only.
#
# MACOSX_DEPLOYMENT_TARGET sets the oldest macOS they run on. The linker signs
# them ad hoc; the release build signs fiddle-disclaim again (forge.config.ts).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
out=${1:-"$here/build"}
target=${MACOSX_DEPLOYMENT_TARGET:-12.0}

if [ "$(uname -s)" != Darwin ]; then
  echo "build.sh: the privacy helper builds on macOS only" >&2
  exit 1
fi

mkdir -p "$out"

build() {
  clang -std=c11 -O2 -Wall -Wextra -arch arm64 -arch x86_64 \
    -mmacosx-version-min="$target" -o "$out/$1" "$here/$2"
  codesign --force --sign - "$out/$1"
}

build fiddle-disclaim disclaim.c
build selfcheck selfcheck.c
