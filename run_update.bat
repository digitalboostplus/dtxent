@echo off
:: DTXent Website Updater - Daily scheduled run
:: Logs output to execution\update_log.txt

set DTXENT_DIR=C:\Users\Brian\dtxent
set LOG_FILE=%DTXENT_DIR%\execution\update_log.txt
set PYTHON=python

echo. >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"
echo Run started: %DATE% %TIME% >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

cd /d "%DTXENT_DIR%"

:: Use venv python if it exists, otherwise fall back to system python
if exist "%DTXENT_DIR%\.venv\Scripts\python.exe" (
    set PYTHON=%DTXENT_DIR%\.venv\Scripts\python.exe
)

"%PYTHON%" execution\update_dtxent.py >> "%LOG_FILE%" 2>&1

echo. >> "%LOG_FILE%"
echo Run finished: %DATE% %TIME% >> "%LOG_FILE%"
