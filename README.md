# H3 Live（PWA）

用手機（Android Chrome）或電腦 Chrome/Edge 的 Web Bluetooth 直接連 H3 腦波儀，即時顯示 FP1/FP2/ECG/ROC 與 X/Y/Z 波形、錄製成 EDF（格式與 H3 記憶卡、Sleepwell H3rec 相同），錄 ≥30 秒後可直接在手機產生「H3 腦健康報告」（與 2chREC / H3腦健康報告_Windows 同一套計分核心，`report/` 由 2chrec/src/report 用 esbuild 轉出；改計分門檻要同步）。iPhone Safari 不支援 Web Bluetooth。

- 部署後網址：https://chiayumd15.github.io/h3-live/（見 deploy.sh）
- 在 Chrome 選單「加到主畫面」即可當 app 使用；橫向時波形佔左側、控制在右側；連線中保持螢幕常亮。
- 三星瀏覽器的 Web Bluetooth 清單永遠是空的，頁面會偵測並提供「用 Chrome 開啟」。
- `?sim`：無硬體時重播 `test/h3_stream_sample.bin` 實機側錄樣本。
- 測試：`node test/parser.test.mjs`（解析器與 2chrec/parser.rs 的 Rust 測試對照）。
- 本機開發：`python3 -m http.server 8787` 後開 http://127.0.0.1:8787/（localhost 可用 Web Bluetooth，其餘網域需 HTTPS）。

協定摘要與 Rust 原版：見 sleepwellH3-rec/app/README-H3rec.md、2chrec/src-tauri/src/parser.rs。

## Android APK（Capacitor 8）

WebView 沒有 Web Bluetooth，app 版藍牙改走 `@capacitor-community/bluetooth-le`（`ble.js` 依 `isNative` 切換，網頁版仍用 Web Bluetooth）；存檔走 `@capacitor/filesystem`（Documents/H3Live/）＋分享面板，螢幕常亮走 keep-awake 外掛（`platform.js`）。

- 建置：`./build-apk.sh`（需 JDK 21 + Android SDK；內部先跑 `build-www.sh` 用 esbuild 把 app.js 連外掛打包進 `www/`，再 `cap sync` + `gradlew assembleDebug`），產物複製到 `~/Downloads/H3Live.apk`。
- appId `com.sleepware.h3live`；權限在 `android/app/src/main/AndroidManifest.xml`（BLUETOOTH_SCAN neverForLocation、BLUETOOTH_CONNECT）。
- app 內沒有網址列，連點標題「H3 Live」5 下進入模擬模式。
- 真機安裝：`adb install -r ~/Downloads/H3Live.apk`，或把 APK 傳到手機點開（需允許安裝未知來源）。
