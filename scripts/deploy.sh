#!/bin/bash
# =============================================================================
# RELATIM - Production Deployment Script
# Government-Grade LiveKit Platform for India
# =============================================================================
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    🇮🇳 RELATIM PLATFORM                        ║"
echo "║           Government-Grade LiveKit Deployment                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# STEP 1: Check Docker
# =============================================================================
echo -e "${YELLOW}[1/6] Checking Docker installation...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed!${NC}"
    echo ""
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running!${NC}"
    echo ""
    echo "Please start Docker and try again."
    echo ""
    exit 1
fi

DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+')
echo -e "${GREEN}✓ Docker installed: v${DOCKER_VERSION}${NC}"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not available!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose available${NC}"

# =============================================================================
# STEP 2: Detect GPU
# =============================================================================
echo -e "${YELLOW}[2/6] Detecting GPU...${NC}"

GPU_PROFILE="cpu"
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null; then
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n1)
        GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -n1)
        echo -e "${GREEN}✓ NVIDIA GPU detected: ${GPU_NAME} (${GPU_MEMORY})${NC}"
        GPU_PROFILE="gpu"
        
        # Check NVIDIA Container Toolkit
        if docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi &> /dev/null; then
            echo -e "${GREEN}✓ NVIDIA Container Toolkit working${NC}"
        else
            echo -e "${YELLOW}⚠ NVIDIA Container Toolkit not configured, falling back to CPU${NC}"
            GPU_PROFILE="cpu"
        fi
    else
        echo -e "${YELLOW}⚠ NVIDIA driver not responding, using CPU mode${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No GPU detected, using CPU mode${NC}"
fi

echo -e "${BLUE}→ Selected profile: ${GPU_PROFILE}${NC}"

# =============================================================================
# STEP 3: Pre-pull images
# =============================================================================
echo -e "${YELLOW}[3/6] Pulling Docker images...${NC}"

docker compose -f docker-compose.prod.yml pull --quiet 2>/dev/null || true
echo -e "${GREEN}✓ Images ready${NC}"

# =============================================================================
# STEP 4: Stop existing containers
# =============================================================================
echo -e "${YELLOW}[4/6] Stopping existing containers...${NC}"

docker compose -f docker-compose.prod.yml --profile gpu --profile cpu down 2>/dev/null || true
echo -e "${GREEN}✓ Cleaned up${NC}"

# =============================================================================
# STEP 5: Start services
# =============================================================================
echo -e "${YELLOW}[5/6] Starting services with ${GPU_PROFILE} profile...${NC}"

docker compose -f docker-compose.prod.yml --profile ${GPU_PROFILE} up -d --build

echo -e "${GREEN}✓ Services starting...${NC}"

# =============================================================================
# STEP 6: Health checks
# =============================================================================
echo -e "${YELLOW}[6/6] Running health checks...${NC}"

MAX_WAIT=120
WAIT_INTERVAL=5
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Check essential services
    HEALTHY=true
    
    # Check postgres
    if ! docker exec relatim-postgres pg_isready -U relatim &> /dev/null; then
        HEALTHY=false
    fi
    
    # Check redis
    if ! docker exec relatim-redis redis-cli ping &> /dev/null; then
        HEALTHY=false
    fi
    
    # Check backend
    if ! curl -s http://localhost:8000/health &> /dev/null; then
        HEALTHY=false
    fi
    
    # Check LiveKit
    if ! curl -s http://localhost:7880/ &> /dev/null; then
        # LiveKit is accessed via nginx, check via that
        HEALTHY=false
    fi
    
    if [ "$HEALTHY" = true ]; then
        break
    fi
    
    echo "  Waiting for services... (${ELAPSED}s/${MAX_WAIT}s)"
    sleep $WAIT_INTERVAL
    ELAPSED=$((ELAPSED + WAIT_INTERVAL))
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    DEPLOYMENT COMPLETE                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"

echo ""
echo -e "${GREEN}Access Points:${NC}"
echo "  🌐 Frontend:     http://localhost"
echo "  🔌 API:          http://localhost/api"
echo "  📹 LiveKit:      http://localhost/livekit"
echo "  📊 LiveKit WS:   ws://localhost/rtc"
echo ""
echo -e "${YELLOW}Admin Login:${NC}"
echo "  Email:    relatim@relatim.com"
echo "  Password: Relatim@2026"
echo ""
echo -e "${GREEN}Logs: docker compose -f docker-compose.prod.yml logs -f${NC}"
echo ""
