@echo off
title Tragedy Looper 多人伺服器
cd /d "%~dp0"
echo 啟動悲劇輪迴多人伺服器（http://localhost:8360）...

set "NODE_CMD=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
  ) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
  ) else if exist "C:\Users\newyo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_CMD=C:\Users\newyo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo 找不到 Node.js。請安裝 Node.js（https://nodejs.org）後再試。
    pause
    exit /b 1
  )
)

"%NODE_CMD%" server\multiplayer.js 8360
pause
