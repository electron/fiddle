#!/usr/bin/env bash

set -eo pipefail

KEY_CHAIN=build.keychain
MACOS_CERT_P12_FILE=certificate.p12

if [ -z "$MACOS_CERT_P12" ]; then
  echo "MACOS_CERT_P12 is not set." >&2
  exit 1
fi

# Recreate the certificate from the secure environment variable
echo -n "$MACOS_CERT_P12" | base64 -d > "$MACOS_CERT_P12_FILE"

# Create a keychain
security create-keychain -p actions $KEY_CHAIN

# Make the keychain the default so identities are found
security default-keychain -s $KEY_CHAIN

# Unlock the keychain
security unlock-keychain -p actions $KEY_CHAIN

# CI lacks the latest Developer ID intermediate certificate, which the cert needs
curl https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer -o DeveloperIDG2CA.cer
sudo security add-trusted-cert -d -r unspecified -k $KEY_CHAIN DeveloperIDG2CA.cer
rm -f DeveloperIDG2CA.cer

security import $MACOS_CERT_P12_FILE -k $KEY_CHAIN -P "$MACOS_CERT_PASSWORD" -T /usr/bin/codesign;

security set-key-partition-list -S apple-tool:,apple: -s -k actions $KEY_CHAIN

security find-identity

# remove certs
rm -fr *.p12
