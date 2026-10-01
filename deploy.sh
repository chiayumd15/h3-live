#!/bin/zsh
# 首次：建公開 repo chiayumd15/h3-live 並開 GitHub Pages（main 分支根目錄）；之後：commit + push 即更新
set -e
cd ~/sandbox/h3-pwa
git add -A && (git commit -q -m "${1:-update}" || true)
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create chiayumd15/h3-live --public --source=. --remote=origin --push \
    --description "H3 腦波儀 Web Bluetooth PWA：手機即時波形與 EDF 錄製"
  gh api -X POST repos/chiayumd15/h3-live/pages -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
else
  git push -u origin main
fi
echo "約 1 分鐘後開: https://chiayumd15.github.io/h3-live/"
