#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VAULT_DIR="${1:-/Users/lixiaofeng/Blog}"
PLUGIN_ID="float-toc"
TARGET="${VAULT_DIR}/.obsidian/plugins/${PLUGIN_ID}"

mkdir -p "${VAULT_DIR}/.obsidian/plugins"
ln -sfn "${REPO_DIR}" "${TARGET}"

echo "Linked ${REPO_DIR}"
echo "    -> ${TARGET}"
echo ""
echo "Next: npm run dev (in repo), enable Float TOC in Obsidian, then:"
echo "  obsidian plugin:reload id=${PLUGIN_ID}"
