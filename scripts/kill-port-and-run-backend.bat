@echo off
REM 🚀 Atlas AI Backend Port Manager (Windows)
REM Automatically clears port 8000 and starts the backend server

echo 🔍 Checking port 8000 status...

REM Check if port 8000 is in use
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 8000 is in use. Clearing processes...
    
    REM Find and kill processes using port 8000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
        echo Killing process ID: %%a
        taskkill /PID %%a /F >nul 2>&1
    )
    
    REM Wait a moment for processes to fully terminate
    timeout /t 2 /nobreak >nul
    
    echo ✅ Port 8000 cleared successfully!
) else (
    echo ✅ Port 8000 is free
)

REM Verify port is free before proceeding
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ Port 8000 is still in use. Cannot start backend.
    echo 🔍 Check what's using the port: netstat -ano ^| findstr :8000
    pause
    exit /b 1
)

echo 🚀 Starting Atlas AI Backend Server...
echo 📁 Working directory: %cd%
echo 🔗 Server will be available at: http://localhost:8000
echo 📊 Health check: http://localhost:8000/healthz
echo.

REM Start the backend server
cd backend && npm run dev
