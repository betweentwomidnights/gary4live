@echo off
setlocal

rem Add Node.js to PATH
set "nodejs_path=C:\Program Files\nodejs"
if not exist "%nodejs_path%" set "nodejs_path=C:\Program Files (x86)\nodejs"
if exist "%nodejs_path%" (
    setx PATH "%PATH%;%nodejs_path%"
) else (
    echo Node.js installation not found. Ensure Node.js is installed correctly.
)

rem Add FFmpeg to PATH
set "ffmpeg_path=C:\g4l\ffmpeg"
setx PATH "%PATH%;%ffmpeg_path%"

rem Verify updates
echo PATH=%PATH%
endlocal