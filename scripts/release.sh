#!/usr/bin/env bash
set -euo pipefail

version=$(bun -e "const pkg = require('./package.json'); console.log(pkg.version)")
tag="v${version}"

if [[ -z "${version}" ]]; then
  echo "Unable to read version from package.json" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before releasing." >&2
  exit 1
fi

if git rev-parse "${tag}" >/dev/null 2>&1; then
  echo "Tag ${tag} already exists." >&2
  exit 1
fi

git tag -a "${tag}" -m "release ${tag}"

if [[ "${1:-}" == "--push" ]]; then
  git push origin "${tag}"
  echo "Pushed ${tag}"
else
  echo "Created tag ${tag}. Push with: git push origin ${tag}"
fi
