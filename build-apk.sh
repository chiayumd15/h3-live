#!/bin/zsh
# 建 Android APK：build-www.sh → cap sync → gradle assembleDebug → 複製到 ~/Downloads/H3Live.apk
set -e
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd ~/sandbox/h3-pwa
./build-www.sh
npx cap sync android
cd android && ./gradlew assembleDebug -q
APK="app/build/outputs/apk/debug/app-debug.apk"
cp "$APK" ~/Downloads/H3Live.apk 2>/dev/null || echo "（無法寫入 ~/Downloads，APK 在 $(pwd)/$APK）"
echo "APK 完成：~/Downloads/H3Live.apk（$(du -h ~/Downloads/H3Live.apk | cut -f1)）"
echo "安裝：adb install -r ~/Downloads/H3Live.apk，或傳到手機點開安裝"
echo "更新下載連結：gh release upload v1.0.0 ~/Downloads/H3Live.apk --clobber  （連結固定 https://github.com/chiayumd15/h3-live/releases/latest/download/H3Live.apk）"
