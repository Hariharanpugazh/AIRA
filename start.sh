#!/bin/bash

# =============================================================================
# LiveKit Dashboard - Unified Start Script
# =============================================================================
# Production-ready script to start all services with support for:
#   - dev mode: Local backend/frontend with Docker infrastructure services
#   - docker mode: Everything in Docker containers
#   - full mode: Complete stack including optional AI services
#
# Usage: ./start.sh [mode] [options]
#   Modes: dev, docker, full
#   Options:
#     --build         Force rebuild of Docker images
#     --logs          Show logs after starting
#     --stop          Stop all services instead of starting
#     --status        Check status of all services
#     --clean         Clean up volumes and rebuild
#
# Examples:
#   ./start.sh dev              # Start in development mode
#   ./start.sh docker --build   # Start in Docker mode with rebuild
#   ./start.sh full --logs      # Start full stack and show logs
#   ./start.sh --stop           # Stop all services
#   ./start.sh --status         # Check service status
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="livekit-dashboard"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Service names
INFRA_SERVICES="postgres redis livekit ingress egress"
ALL_SERVICES="nginx frontend backend postgres redis livekit ingress egress"

# Default ports for conflict checking
declare -A SERVICE_PORTS=(
    ["postgres"]=5433
    ["redis"]=6379
    ["livekit"]=7880
    ["ingress"]=1935
    ["egress"]=0
    ["backend"]=8000
    ["frontend"]=3000
    ["nginx"]=80
)

# Health check endpoints
declare -A HEALTH_ENDPOINTS=(
    ["backend"]='http://localhost:8000/health'
    ["postgres"]='localhost'
    ["redis"]='localhost'
)

# =============================================================================
# COLORS AND OUTPUT FORMATTING
# =============================================================================

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${CYAN}[→]${NC} $1"; }
log_header() { echo -e "\n${BOLD}${MAGENTA}$1${NC}\n"; }

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              LiveKit Dashboard - Start Script                  ║"
    echo "║                    Unified Service Manager                     ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $(basename "$0") [MODE] [OPTIONS]

MODES:
  dev         Development mode - Local backend/frontend + Docker infra
  docker      Docker mode - All services in containers
  full        Full mode - Complete stack with AI services (GPU required)

OPTIONS:
  --build     Force rebuild Docker images before starting
  --logs      Show logs after starting services
  --stop      Stop all services
  --status    Check status of all services
  --clean     Clean volumes and rebuild (WARNING: Data loss!)
  --help      Show this help message

EXAMPLES:
  $(basename "$0") dev                    # Start development environment
  $(basename "$0") docker --build         # Build and start Docker services
  $(basename "$0") full --logs            # Start full stack with logs
  $(basename "$0") --stop                 # Stop all services
  $(basename "$0") --status               # Check service health

ENVIRONMENT:
  MODE=local|production                   # Set in .env file

EOF
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Docker is installed and running
check_docker() {
    if ! command_exists docker; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        log_error "Docker Compose is not installed."
        exit 1
    fi
}

# Get docker compose command (v1 or v2)
get_compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# =============================================================================
# ENVIRONMENT SETUP
# =============================================================================

# Check and setup environment
setup_environment() {
    log_step "Setting up environment..."

    # Check if .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warn ".env file not found at $ENV_FILE"
        log_info "Creating default .env file..."
        
        cat > "$ENV_FILE" << 'EOF'
# Environment Configuration
MODE=local

# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=Admin2026Secure
POSTGRES_DB=livekit_admin
DATABASE_URL=postgresql://admin:Admin2026Secure@postgres:5432/livekit_admin

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=Admin@2026

# LiveKit
LIVEKIT_API_KEY=APIwQJRKPH1GaLa
LIVEKIT_API_SECRET=mCafIFJr80hhRBYVBKCUqgOLEiIpRFLj5RAfEaNjF8p
LIVEKIT_URL=http://livekit:7880
LIVEKIT_WS_URL=ws://livekit:7880

# Frontend
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_WS_URL=ws://localhost/rtc
EOF
        log_success "Created default .env file"
    fi

    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a

    # Create necessary directories
    mkdir -p "$SCRIPT_DIR/backend/docker" "$SCRIPT_DIR/nginx"

    log_success "Environment setup complete"
}

# =============================================================================
# PORT CONFLICT CHECKING
# =============================================================================

# Check if a port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1 || \
       netstat -tuln 2>/dev/null | grep -q ":$port " || \
       ss -tuln 2>/dev/null | grep -q ":$port "; then
        return 0
    fi
    return 1
}

# Check all required ports
check_ports() {
    local mode=$1
    local conflicts=()
    
    log_step "Checking for port conflicts..."

    for service in postgres redis livekit nginx; do
        local port=${SERVICE_PORTS[$service]}
        if [[ $port -gt 0 ]] && check_port $port; then
            conflicts+=("$service:$port")
        fi
    done

    if [[ $mode == "dev" ]]; then
        # Check additional ports for dev mode
        for port in 8000 3000; do
            if check_port $port; then
                conflicts+=("local-dev:$port")
            fi
        done
    fi

    if [[ ${#conflicts[@]} -gt 0 ]]; then
        log_warn "Port conflicts detected:"
        for conflict in "${conflicts[@]}"; do
            echo "  - Port ${conflict#*:} already in use (for ${conflict%:*})"
        done
        
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Aborted due to port conflicts"
            exit 1
        fi
    else
        log_success "No port conflicts detected"
    fi
}

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

# Check if a Docker container is running
is_container_running() {
    local container=$1
    docker ps --format "{{.Names}}" | grep -q "^${container}$"
}

# Get container status
get_container_status() {
    local container=$1
    if is_container_running "$container"; then
        echo "running"
    elif docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        echo "stopped"
    else
        echo "not_created"
    fi
}

# Stop all services
stop_services() {
    log_header "STOPPING SERVICES"
    
    local compose_cmd=$(get_compose_cmd)
    
    # Stop Docker services
    log_step "Stopping Docker containers..."
    $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
    
    # Kill local processes if any
    if pgrep -f "uvicorn.*main:app" >/dev/null 2>&1; then
        log_step "Stopping local backend..."
        pkill -f "uvicorn.*main:app" 2>/dev/null || true
    fi
    
    if pgrep -f "next.*dev" >/dev/null 2>&1; then
        log_step "Stopping local frontend..."
        pkill -f "next.*dev" 2>/dev/null || true
    fi
    
    log_success "All services stopped"
}

# Clean up volumes
clean_services() {
    log_header "CLEANING SERVICES"
    
    read -p "This will remove all data volumes. Are you sure? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleanup cancelled"
        return
    fi

    local compose_cmd=$(get_compose_cmd)
    
    $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans 2>/dev/null || true
    
    # Remove orphaned volumes
    docker volume prune -f 2>/dev/null || true
    
    log_success "Cleanup complete"
}

# =============================================================================
# HEALTH CHECKS
# =============================================================================

# Wait for service to be healthy
wait_for_service() {
    local service=$1
    local max_attempts=${2:-30}
    local delay=${3:-2}
    
    log_step "Waiting for $service to be ready..."
    
    for ((i=1; i<=max_attempts; i++)); do
        local status=$(get_container_status "lk-$service")
        
        if [[ "$status" == "running" ]]; then
            # Additional health check for specific services
            case $service in
                postgres)
                    if docker exec lk-postgres pg_isready -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-livekit_admin}" >/dev/null 2>&1; then
                        log_success "$service is healthy"
                        return 0
                    fi
                    ;;
                redis)
                    if docker exec lk-redis redis-cli ping | grep -q "PONG"; then
                        log_success "$service is healthy"
                        return 0
                    fi
                    ;;
                backend)
                    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
                        log_success "$service is healthy"
                        return 0
                    fi
                    ;;
                livekit)
                    if curl -sf http://localhost:7880/ >/dev/null 2>&1; then
                        log_success "$service is healthy"
                        return 0
                    fi
                    ;;
                *)
                    log_success "$service is running"
                    return 0
                    ;;
            esac
        fi
        
        echo -n "."
        sleep $delay
    done
    
    echo
    log_error "$service failed to become healthy after $((max_attempts * delay)) seconds"
    return 1
}

# Check all service status
show_status() {
    log_header "SERVICE STATUS"
    
    printf "%-20s %-15s %s\n" "SERVICE" "STATUS" "HEALTH"
    echo "───────────────────────────────────────────────────────"
    
    for service in postgres redis livekit ingress egress backend frontend nginx; do
        local container="lk-$service"
        local status=$(get_container_status "$container")
        local health="N/A"
        
        if [[ "$status" == "running" ]]; then
            # Check specific health
            case $service in
                postgres)
                    if docker exec "$container" pg_isready -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-livekit_admin}" >/dev/null 2>&1; then
                        health="${GREEN}healthy${NC}"
                    else
                        health="${YELLOW}unhealthy${NC}"
                    fi
                    ;;
                redis)
                    if docker exec "$container" redis-cli ping | grep -q "PONG" 2>/dev/null; then
                        health="${GREEN}healthy${NC}"
                    else
                        health="${YELLOW}unhealthy${NC}"
                    fi
                    ;;
                backend)
                    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
                        health="${GREEN}healthy${NC}"
                    else
                        health="${YELLOW}unhealthy${NC}"
                    fi
                    ;;
                *)
                    health="${GREEN}running${NC}"
                    ;;
            esac
            status="${GREEN}running${NC}"
        elif [[ "$status" == "stopped" ]]; then
            status="${YELLOW}stopped${NC}"
        else
            status="${RED}not created${NC}"
        fi
        
        printf "%-20b %-15b %b\n" "$service" "$status" "$health"
    done
    
    echo
    log_info "Check complete. Run with 'dev' or 'docker' mode to start services."
}

# =============================================================================
# MODE: DEVELOPMENT
# =============================================================================

start_dev_mode() {
    log_header "STARTING DEVELOPMENT MODE"
    log_info "Mode: Local backend/frontend + Docker infrastructure"
    
    local compose_cmd=$(get_compose_cmd)
    local build_flag=""
    
    [[ "$BUILD_FLAG" == "true" ]] && build_flag="--build"
    
    # Check ports
    check_ports "dev"
    
    # Start infrastructure services only
    log_step "Starting infrastructure services (PostgreSQL, Redis, LiveKit)..."
    $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d $build_flag \
        postgres redis livekit ingress egress
    
    # Wait for critical infrastructure
    log_step "Waiting for infrastructure to be ready..."
    wait_for_service "postgres" 30 2 || { log_error "PostgreSQL failed to start"; exit 1; }
    wait_for_service "redis" 20 1 || { log_error "Redis failed to start"; exit 1; }
    wait_for_service "livekit" 40 2 || { log_error "LiveKit failed to start"; exit 1; }
    
    log_success "Infrastructure services are ready"
    
    # Setup local environment for dev mode
    log_step "Setting up local environment..."
    
    export DATABASE_URL="postgresql://${POSTGRES_USER:-admin}:${POSTGRES_PASSWORD:-Admin2026Secure}@localhost:5433/${POSTGRES_DB:-livekit_admin}"
    export REDIS_URL="redis://localhost:6379"
    export LIVEKIT_URL="http://localhost:7880"
    export LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-APIwQJRKPH1GaLa}"
    export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-mCafIFJr80hhRBYVBKCUqgOLEiIpRFLj5RAfEaNjF8p}"
    export JWT_SECRET="${JWT_SECRET:-your-super-secret-jwt-key-change-in-production-min-32-chars}"
    export MODE="local"
    
    # Start backend in background
    log_step "Starting local backend (FastAPI)..."
    if [[ -d "$SCRIPT_DIR/backend/api" ]]; then
        cd "$SCRIPT_DIR/backend"
        if [[ -d "api/venv" ]]; then
            ./api/venv/bin/python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 &
            BACKEND_PID=$!
            log_info "Backend started with PID: $BACKEND_PID"
        else
            log_warn "Virtual environment not found at backend/api/venv"
            log_info "Attempting to run with system Python..."
            if command_exists python3; then
                python3 -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 &
                BACKEND_PID=$!
                log_info "Backend started with PID: $BACKEND_PID"
            else
                log_error "Python3 not found. Cannot start backend."
            fi
        fi
    else
        log_warn "Backend directory not found at $SCRIPT_DIR/backend/api"
    fi
    
    # Wait for backend to be ready
    sleep 3
    
    # Start frontend in background
    log_step "Starting local frontend (Next.js)..."
    if [[ -d "$SCRIPT_DIR/frontend" ]]; then
        cd "$SCRIPT_DIR/frontend"
        
        # Check if node_modules exists
        if [[ ! -d "node_modules" ]]; then
            log_warn "node_modules not found. Running npm install..."
            if command_exists npm; then
                npm install
            else
                log_error "npm not found. Cannot install dependencies."
            fi
        fi
        
        if [[ -d "node_modules" ]]; then
            export NEXT_PUBLIC_API_URL="http://localhost:8000"
            export NEXT_PUBLIC_WS_URL="ws://localhost:7880"
            npm run dev &
            FRONTEND_PID=$!
            log_info "Frontend started with PID: $FRONTEND_PID"
        fi
    else
        log_warn "Frontend directory not found at $SCRIPT_DIR/frontend"
    fi
    
    # Wait for services to be ready
    sleep 3
    
    # Health check
    log_step "Performing health checks..."
    
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        log_success "Backend is responding at http://localhost:8000"
    else
        log_warn "Backend may not be fully ready yet"
    fi
    
    echo
    log_success "Development environment is starting up!"
    echo
    echo -e "${CYAN}Services:${NC}"
    echo "  • PostgreSQL:  localhost:5433"
    echo "  • Redis:       localhost:6379"
    echo "  • LiveKit:     localhost:7880"
    echo "  • Backend:     http://localhost:8000"
    echo "  • Frontend:    http://localhost:3000"
    echo
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    
    # Show logs if requested
    if [[ "$SHOW_LOGS" == "true" ]]; then
        echo
        log_info "Showing Docker logs (Ctrl+C to exit logs, services will keep running)..."
        $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f postgres redis livekit
    else
        # Wait for interrupt
        wait
    fi
}

# =============================================================================
# MODE: DOCKER
# =============================================================================

start_docker_mode() {
    log_header "STARTING DOCKER MODE"
    log_info "Mode: All services in Docker containers"
    
    local compose_cmd=$(get_compose_cmd)
    local build_flag=""
    
    [[ "$BUILD_FLAG" == "true" ]] && build_flag="--build"
    
    # Check ports
    check_ports "docker"
    
    # Start all services
    log_step "Starting all Docker services..."
    $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d $build_flag $ALL_SERVICES
    
    # Wait for critical services
    log_step "Waiting for services to be ready..."
    wait_for_service "postgres" 30 2 || { log_error "PostgreSQL failed to start"; exit 1; }
    wait_for_service "redis" 20 1 || { log_error "Redis failed to start"; exit 1; }
    wait_for_service "livekit" 40 2 || { log_error "LiveKit failed to start"; exit 1; }
    wait_for_service "backend" 60 2 || { log_warn "Backend may not be fully ready"; }
    wait_for_service "nginx" 20 1 || { log_warn "Nginx may not be fully ready"; }
    
    log_success "All Docker services are running!"
    
    echo
    echo -e "${CYAN}Services:${NC}"
    echo "  • Dashboard:   http://localhost (via Nginx)"
    echo "  • API:         http://localhost/api"
    echo "  • LiveKit:     ws://localhost/rtc"
    echo "  • PostgreSQL:  localhost:5433"
    echo "  • Redis:       localhost:6379"
    echo
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    
    # Show logs if requested
    if [[ "$SHOW_LOGS" == "true" ]]; then
        echo
        log_info "Showing Docker logs (Ctrl+C to exit logs, services will keep running)..."
        $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    fi
}

# =============================================================================
# MODE: FULL (with AI services)
# =============================================================================

start_full_mode() {
    log_header "STARTING FULL MODE"
    log_info "Mode: Complete stack with AI services (GPU required)"
    
    local compose_cmd=$(get_compose_cmd)
    local build_flag=""
    
    [[ "$BUILD_FLAG" == "true" ]] && build_flag="--build"
    
    # Check GPU availability
    if ! nvidia-smi >/dev/null 2>&1; then
        log_warn "NVIDIA GPU not detected. AI services may not work properly."
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "NVIDIA GPU detected"
    fi
    
    # Check ports
    check_ports "docker"
    
    # Start all services including GPU profile
    log_step "Starting all services including AI (Whisper, Kokoro, Ollama)..."
    $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" --profile gpu up -d $build_flag
    
    # Wait for critical services
    log_step "Waiting for core services to be ready..."
    wait_for_service "postgres" 30 2 || { log_error "PostgreSQL failed to start"; exit 1; }
    wait_for_service "redis" 20 1 || { log_error "Redis failed to start"; exit 1; }
    wait_for_service "livekit" 40 2 || { log_error "LiveKit failed to start"; exit 1; }
    wait_for_service "backend" 60 2 || { log_warn "Backend may not be fully ready"; }
    
    log_step "Waiting for AI services to be ready (this may take a while)..."
    sleep 10  # AI services take longer to initialize
    
    log_success "Full stack is running!"
    
    echo
    echo -e "${CYAN}Services:${NC}"
    echo "  • Dashboard:   http://localhost (via Nginx)"
    echo "  • API:         http://localhost/api"
    echo "  • LiveKit:     ws://localhost/rtc"
    echo "  • Whisper STT: http://localhost:8001"
    echo "  • Kokoro TTS:  http://localhost:8880"
    echo "  • Ollama LLM:  http://localhost:11434"
    echo
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    
    # Show logs if requested
    if [[ "$SHOW_LOGS" == "true" ]]; then
        echo
        log_info "Showing Docker logs..."
        $compose_cmd -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    print_banner
    
    # Parse arguments
    local MODE=""
    local BUILD_FLAG="false"
    local SHOW_LOGS="false"
    local STOP_FLAG="false"
    local STATUS_FLAG="false"
    local CLEAN_FLAG="false"
    
    for arg in "$@"; do
        case $arg in
            dev|docker|full)
                MODE="$arg"
                ;;
            --build)
                BUILD_FLAG="true"
                ;;
            --logs)
                SHOW_LOGS="true"
                ;;
            --stop)
                STOP_FLAG="true"
                ;;
            --status)
                STATUS_FLAG="true"
                ;;
            --clean)
                CLEAN_FLAG="true"
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $arg"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Execute requested action
    if [[ "$STOP_FLAG" == "true" ]]; then
        stop_services
        exit 0
    fi
    
    if [[ "$STATUS_FLAG" == "true" ]]; then
        show_status
        exit 0
    fi
    
    if [[ "$CLEAN_FLAG" == "true" ]]; then
        clean_services
        exit 0
    fi
    
    # Default mode is dev if not specified
    if [[ -z "$MODE" ]]; then
        log_warn "No mode specified. Defaulting to 'dev' mode."
        log_info "Usage: $0 [dev|docker|full] [options]"
        MODE="dev"
    fi
    
    # Check prerequisites
    check_docker
    setup_environment
    
    # Start in specified mode
    case $MODE in
        dev)
            start_dev_mode
            ;;
        docker)
            start_docker_mode
            ;;
        full)
            start_full_mode
            ;;
        *)
            log_error "Invalid mode: $MODE"
            show_usage
            exit 1
            ;;
    esac
}

# Trap signals for cleanup
trap 'echo; log_warn "Interrupted! Cleaning up..."; stop_services; exit 130' INT TERM

# Run main function
main "$@"
