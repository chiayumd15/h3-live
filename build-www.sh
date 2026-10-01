#!/bin/zsh
# 把 PWA 原始檔整理成 Capacitor 的 webDir（www/）：app.js 連同原生外掛一起用 esbuild 打包，其餘檔案複製
set -e
cd ~/sandbox/h3-pwa
rm -rf www && mkdir -p www/test
npx esbuild app.js --bundle --format=esm --target=es2020 --outfile=www/app.js --log-level=warning
cp index.html manifest.webmanifest icon.svg icon-192.png icon-512.png www/
cp test/h3_stream_sample.bin www/test/
# 在 app 內不註冊 service worker（app.js 已依 isNative 跳過），不複製 sw.js
echo "www/ 完成：$(du -sh www | cut -f1)"
