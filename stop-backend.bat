@echo off
echo Stopping local backend server on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do (
    taskkill /f /pid %%a
    echo Process %%a terminated.
)
echo Done.
pause
