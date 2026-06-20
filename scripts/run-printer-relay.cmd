@echo off
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" --env-file=.env.printer-relay.local scripts\printer-relay.mjs >> printer-relay.log 2>> printer-relay-error.log
