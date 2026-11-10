#!/bin/sh
# Installs dependencies with the committed lockfile. Usage: install.sh [extra npm ci args]
# The repository policy (docs/DEPLOYMENT_SECURITY.md) requires a committed package-lock.json, so by default a missing
# lockfile fails the build. ALLOW_NO_LOCKFILE=1 is for local experiments only; never use it for an image you deploy.
set -eu
if [ -f package-lock.json ]; then
  exec npm ci "$@"
fi
if [ "${ALLOW_NO_LOCKFILE:-0}" = "1" ]; then
  echo "WARNING: package-lock.json is missing; installing unlocked versions. Do not deploy this image." >&2
  exec npm install "$@"
fi
echo "package-lock.json is missing. Run 'npm run lockfile:refresh' on a networked machine and commit it," >&2
echo "or, for a local experiment only, build with --build-arg ALLOW_NO_LOCKFILE=1." >&2
exit 1
