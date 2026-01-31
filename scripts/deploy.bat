@echo off
REM =============================================================================
REM RELATIM - Production Deployment Script (Windows)
REM Government-Grade LiveKit Platform for India
REM =============================================================================

echo.
echo ================================================================
echo                    RELATIM PLATFORM
echo           Government-Grade LiveKit Deployment
echo ================================================================
echo.

REM =============================================================================
REM STEP 1: Check Docker
REM =============================================================================
echo [1/6] Checking Docker installation...

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not installed!
    echo.
    echo Please install Docker from: https://docs.docker.com/get-docker/
    echo.
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker daemon is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    exit /b 1
)

echo [OK] Docker installed

REM Check Docker Compose
docker compose version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Compose is not available!
    exit /b 1
)
echo [OK] Docker Compose available

REM =============================================================================
REM STEP 2: Detect GPU
REM =============================================================================
echo [2/6] Detecting GPU...

set GPU_PROFILE=cpu

where nvidia-smi >nul 2>&1
if %ERRORLEVEL% equ 0 (
    nvidia-smi >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] NVIDIA GPU detected
        set GPU_PROFILE=gpu
        
        REM Test NVIDIA Container Toolkit
        docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi >nul 2>&1
        if %ERRORLEVEL% neq 0 (
            echo [WARN] NVIDIA Container Toolkit not configured, using CPU mode
            set GPU_PROFILE=cpu
        ) else (
            echo [OK] NVIDIA Container Toolkit working
        )
    ) else (
        echo [WARN] NVIDIA driver not responding, using CPU mode
    )
) else (
    echo [WARN] No GPU detected, using CPU mode
)

echo Selected profile: %GPU_PROFILE%

REM =============================================================================
REM STEP 3: Pre-pull images
REM =============================================================================
echo [3/6] Pulling Docker images...

docker compose -f docker-compose.prod.yml pull 2>nul
echo [OK] Images ready

REM =============================================================================
REM STEP 4: Stop existing containers
REM =============================================================================
echo [4/6] Stopping existing containers...

docker compose -f docker-compose.prod.yml --profile gpu --profile cpu down 2>nul
echo [OK] Cleaned up

REM =============================================================================
REM STEP 5: Start services
REM =============================================================================
echo [5/6] Starting services with %GPU_PROFILE% profile...

docker compose -f docker-compose.prod.yml --profile %GPU_PROFILE% up -d --build

echo [OK] Services starting...

REM =============================================================================
REM STEP 6: Wait for services
REM =============================================================================
echo [6/6] Waiting for services to be ready...

timeout /t 30 /nobreak >nul

REM =============================================================================
REM SUMMARY
REM =============================================================================
echo.
echo ================================================================
echo                    DEPLOYMENT COMPLETE
echo ================================================================
echo.

docker compose -f docker-compose.prod.yml ps

echo.
echo Access Points:
echo   Frontend:     http://localhost
echo   API:          http://localhost/api
echo   LiveKit:      http://localhost/livekit
echo   LiveKit WS:   ws://localhost/rtc
echo.
echo Admin Login:
echo   Email:    relatim@relatim.com
echo   Password: Relatim@2026
echo.
echo Logs: docker compose -f docker-compose.prod.yml logs -f
echo.

pause
