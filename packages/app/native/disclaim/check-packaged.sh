#!/bin/sh
# Checks the privacy helper in a packaged app:
#
#   check-packaged.sh <path to Electron Fiddle.app> [--release]
#
# The helper must be there, executable, universal and validly signed, and it
# must pass build/selfcheck when that was built. With --release it must also
# carry the Developer ID, the hardened runtime and no entitlements. macOS only.
set -eu

app=${1:?usage: check-packaged.sh <path to Electron Fiddle.app> [--release]}
release=${2:-}
here=$(cd "$(dirname "$0")" && pwd)
helper="$app/Contents/Resources/fiddle-disclaim"

fail() {
  echo "check-packaged.sh: $1" >&2
  exit 1
}

if [ ! -f "$helper" ] || [ ! -x "$helper" ]; then
  fail "$helper is missing or not executable"
fi

archs=$(lipo -archs "$helper")
for arch in arm64 x86_64; do
  case " $archs " in
    *" $arch "*) ;;
    *) fail "no $arch slice, only: $archs" ;;
  esac
done

codesign --verify --strict "$helper" || fail "the signature of $helper is invalid"

if [ "$release" = "--release" ]; then
  details=$(codesign -dvv "$helper" 2>&1)
  echo "$details" | grep -q 'Authority=Developer ID Application' || fail "not signed with a Developer ID"
  echo "$details" | grep -q 'flags=.*runtime' || fail "the hardened runtime is off"
  if codesign -d --entitlements :- "$helper" 2>/dev/null | grep -q '<key>'; then
    fail "the helper carries entitlements"
  fi
fi

if [ -x "$here/build/selfcheck" ]; then
  "$here/build/selfcheck" "$helper"
fi

echo "ok: $helper ($archs)"
