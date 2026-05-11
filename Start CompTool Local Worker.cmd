@echo off
cd /d "%~dp0local-worker"
if not exist node_modules (
  echo Installing local worker dependencies...
  npm install
)
npm start
