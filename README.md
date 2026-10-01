# H3 Live（PWA）

用手機（Android Chrome）或電腦 Chrome/Edge 的 Web Bluetooth 直接連 H3 腦波儀，即時顯示 FP1/FP2/ECG/ROC 與 X/Y/Z 波形、錄製成 EDF（格式與 H3 記憶卡、Sleepwell H3rec 相同），錄 ≥30 秒後可直接在手機產生「H3 腦健康報告」（與 2chREC / H3腦健康報告_Windows 同一套計分核心，`report/` 由 2chrec/src/report 用 esbuild 轉出；改計分門檻要同步）。iPhone Safari 不支援 Web Bluetooth。

- 部署後網址：https://chiayumd15.github.io/h3-live/（見 deploy.sh）
- 在 Chrome 選單「加到主畫面」即可當 app 使用；橫向時波形佔左側、控制在右側；連線中保持螢幕常亮。
- 三星瀏覽器的 Web Bluetooth 清單永遠是空的，頁面會偵測並提供「用 Chrome 開啟」。
- `?sim`：無硬體時重播 `test/h3_stream_sample.bin` 實機側錄樣本。
- 測試：`node test/parser.test.mjs`（解析器與 2chrec/parser.rs 的 Rust 測試對照）。
- 本機開發：`python3 -m http.server 8787` 後開 http://127.0.0.1:8787/（localhost 可用 Web Bluetooth，其餘網域需 HTTPS）。

協定摘要與 Rust 原版：見 sleepwellH3-rec/app/README-H3rec.md、2chrec/src-tauri/src/parser.rs。
