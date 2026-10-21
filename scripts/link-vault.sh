#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ $# -lt 1 ]]; then
	echo "Usage: $0 <vault-path>" >&2
	echo "Example: $0 /path/to/vault" >&2
	exit 1
fi
VAULT_DIR="$1"
PLUGIN_ID="float-toc"
TARGET="${VAULT_DIR}/.obsidian/plugins/${PLUGIN_ID}"

mkdir -p "${VAULT_DIR}/.obsidian/plugins"
ln -sfn "${REPO_DIR}" "${TARGET}"

echo "Linked ${REPO_DIR}"
echo "    -> ${TARGET}"
echo ""
echo "Next: npm run dev (in repo), enable Float TOC in Obsidian, then:"
echo "  obsidian plugin:reload id=${PLUGIN_ID}"
