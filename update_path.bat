@echo off
setlocal

rem Add Node.js to PATH
set "nodejs_path=C:\Program Files\nodejs"
if not exist "%nodejs_path%" set "nodejs_path=C:\Program Files (x86)\nodejs"
if exist "%nodejs_path%" (
    set "PATH=%PATH%;%nodejs_path%"
    setx PATH "%PATH%"
) else (
    echo Node.js installation not found. Ensure Node.js is installed correctly.
)

rem Add FFmpeg to PATH
set "ffmpeg_path=C:\g4l\ffmpeg"
if exist "%ffmpeg_path%" (
    set "PATH=%PATH%;%ffmpeg_path%"
    setx PATH "%PATH%"
) else (
    echo FFmpeg installation not found. Ensure FFmpeg is installed correctly.
)

rem Verify updates
echo PATH=%PATH%

echo Checking Node.js path: %nodejs_path%
echo Checking FFmpeg path: %ffmpeg_path%

endlocal
