#!/usr/bin/env bash

# 🔍 SonarQube Analysis Runner
# Single command to setup, configure, and run SonarQube analysis

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SONAR_HOST="http://localhost:9000"
SONAR_TOKEN_FILE="$SCRIPT_DIR/.sonar-token"
SONAR_STATE_FILE="$SCRIPT_DIR/.sonar-state"
PROJECT_KEY="cad"
PROJECT_NAME="CAD Circuit Analysis"
SCAN_START_TIME=""

# Credentials
ADMIN_DEFAULT_PASSWORD="admin"
ADMIN_NEW_PASSWORD="Admin123!@#$"

# Scanner Configuration
SCANNER_VERSION="6.2.1.4610"
SCANNER_DIR="$HOME/.sonar-scanner"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✖${NC} $1"
}

# State management functions
is_step_completed() {
    local step=$1
    [ -f "$SONAR_STATE_FILE" ] && grep -q "^$step=true$" "$SONAR_STATE_FILE"
}

mark_step_completed() {
    local step=$1
    if ! is_step_completed "$step"; then
        echo "$step=true" >> "$SONAR_STATE_FILE"
    fi
}

reset_setup() {
    log_warning "Resetting SonarQube setup state..."
    rm -f "$SONAR_STATE_FILE"
    log_success "Setup state reset. Next run will perform full setup."
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_success "Docker is installed"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    log_success "Docker Compose is installed"
}

# Start SonarQube container
start_sonarqube() {
    log_info "Checking SonarQube container status..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^sonarqube-cad$"; then
        if docker ps --format '{{.Names}}' | grep -q "^sonarqube-cad$"; then
            log_success "SonarQube container is already running"
        else
            log_info "Starting existing SonarQube container..."
            docker start sonarqube-cad > /dev/null
            log_success "SonarQube container started"
        fi
    else
        log_info "Creating and starting SonarQube container..."
        cd "$SCRIPT_DIR"
        docker compose up -d
        log_success "SonarQube container created and started"
    fi
}

# Wait for SonarQube to be ready
wait_for_sonarqube() {
    log_info "Waiting for SonarQube to be ready..."
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$SONAR_HOST/api/system/status" | grep -q '"status":"UP"'; then
            log_success "SonarQube is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "SonarQube failed to start within expected time"
    exit 1
}

# Change default admin password
change_admin_password() {
    if is_step_completed "password_changed"; then
        log_success "Admin password already configured (skipped)"
        return 0
    fi
    
    log_info "Checking admin password..."
    
    # Try to authenticate with new password first
    if curl -s -u "admin:$ADMIN_NEW_PASSWORD" "$SONAR_HOST/api/authentication/validate" | grep -q '"valid":true'; then
        log_success "Admin password is already set to $ADMIN_NEW_PASSWORD"
        mark_step_completed "password_changed"
        return 0
    fi
    
    # Try to change password from default
    log_info "Changing admin password from '$ADMIN_DEFAULT_PASSWORD' to '$ADMIN_NEW_PASSWORD'..."
    local response=$(curl -s -u "admin:$ADMIN_DEFAULT_PASSWORD" \
        -X POST "$SONAR_HOST/api/users/change_password" \
        -d "login=admin" \
        -d "previousPassword=$ADMIN_DEFAULT_PASSWORD" \
        -d "password=$ADMIN_NEW_PASSWORD")
    
    if [ -z "$response" ]; then
        log_success "Admin password changed to $ADMIN_NEW_PASSWORD"
        mark_step_completed "password_changed"
        return 0
    else
        log_warning "Could not change password (may already be changed)"
        mark_step_completed "password_changed"
    fi
}

# Generate authentication token
generate_token() {
    if [ -f "$SONAR_TOKEN_FILE" ]; then
        log_success "Using existing SonarQube token"
        return 0
    fi
    
    log_info "Generating SonarQube authentication token..."
    
    # Create token using new admin credentials
    local response=$(curl -s -u "admin:$ADMIN_NEW_PASSWORD" \
        -X POST "$SONAR_HOST/api/user_tokens/generate" \
        -d "name=scanner-token-$(date +%s)")
    
    local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$token" ]; then
        log_error "Failed to generate token"
        log_warning "Authentication failed with admin/$ADMIN_NEW_PASSWORD"
        exit 1
    fi
    
    echo "$token" > "$SONAR_TOKEN_FILE"
    chmod 600 "$SONAR_TOKEN_FILE"
    log_success "Token generated and saved"
}

# Create project if it doesn't exist
create_project() {
    if is_step_completed "project_created"; then
        log_success "Project already configured (skipped)"
        return 0
    fi
    
    log_info "Checking if project exists..."
    
    local token=$(cat "$SONAR_TOKEN_FILE")
    local response=$(curl -s -u "$token:" \
        "$SONAR_HOST/api/projects/search?projects=$PROJECT_KEY")
    
    if echo "$response" | grep -q "\"key\":\"$PROJECT_KEY\""; then
        log_success "Project already exists"
        mark_step_completed "project_created"
        return 0
    fi
    
    log_info "Creating project..."
    curl -s -u "$token:" \
        -X POST "$SONAR_HOST/api/projects/create" \
        -d "name=$PROJECT_NAME" \
        -d "project=$PROJECT_KEY" > /dev/null
    
    log_success "Project created"
    mark_step_completed "project_created"
}

# Install sonar-scanner if not present
install_scanner() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local scanner_bin="$SCANNER_DIR/sonar-scanner-${SCANNER_VERSION}-${os}-x64/bin"
    
    # Check if scanner binary exists in the expected location
    if [ -f "$scanner_bin/sonar-scanner" ]; then
        export PATH="$scanner_bin:$PATH"
        log_success "sonar-scanner is already installed"
        mark_step_completed "scanner_installed"
        return 0
    fi
    
    # Check if it's in PATH
    if command -v sonar-scanner &> /dev/null; then
        log_success "sonar-scanner is already installed"
        mark_step_completed "scanner_installed"
        return 0
    fi
    
    if is_step_completed "scanner_installed"; then
        log_warning "Scanner marked as installed but not found. Re-installing..."
    fi
    
    log_info "Installing sonar-scanner..."
    
    if [ "$os" = "darwin" ]; then
        local scanner_zip="sonar-scanner-cli-${SCANNER_VERSION}-macosx-x64.zip"
    else
        local scanner_zip="sonar-scanner-cli-${SCANNER_VERSION}-linux-x64.zip"
    fi
    
    local download_url="https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/${scanner_zip}"
    
    mkdir -p "$SCANNER_DIR"
    cd "$SCANNER_DIR"
    
    curl -sL "$download_url" -o scanner.zip
    unzip -o -q scanner.zip
    rm scanner.zip
    
    # Add to PATH for this session
    export PATH="$scanner_bin:$PATH"
    
    log_success "sonar-scanner installed"
    log_warning "Add to your PATH: export PATH=\"$scanner_bin:\$PATH\""
    mark_step_completed "scanner_installed"
}

# Run SonarQube analysis
run_analysis() {
    log_info "Running SonarQube analysis..."
    
    # Record scan start time before running analysis
    SCAN_START_TIME=$(date -u +%s)
    
    local token=$(cat "$SONAR_TOKEN_FILE")
    
    cd "$PROJECT_ROOT"
    sonar-scanner \
        -Dsonar.host.url="$SONAR_HOST" \
        -Dsonar.token="$token"
    
    log_success "Analysis complete"
}

# Wait for analysis to be processed
wait_for_analysis() {
    log_info "Waiting for analysis to be processed..."
    
    local token=$(cat "$SONAR_TOKEN_FILE")
    local max_attempts=30
    local attempt=0
    local last_analysis_date=""
    
    while [ $attempt -lt $max_attempts ]; do
        # Fetch the last analysis date from the API
        local response=$(curl -s -u "$token:" \
            "$SONAR_HOST/api/project_analyses/search?project=$PROJECT_KEY&ps=1")
        
        # Extract the date from the response
        local analysis_date=$(echo "$response" | grep -o '"date":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ -n "$analysis_date" ]; then
            # Convert ISO date to timestamp
            local analysis_timestamp=$(date -d "$analysis_date" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S%z" "$analysis_date" +%s 2>/dev/null)
            
            # Check if the analysis is newer than when we started the scan
            if [ -n "$analysis_timestamp" ] && [ "$analysis_timestamp" -ge "$SCAN_START_TIME" ]; then
                log_success "Fresh analysis results are ready (analyzed at: $analysis_date)"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_warning "Analysis results may not be fully processed yet, but continuing..."
    return 0
}

# Fetch and display results
fetch_results() {
    log_info "Fetching analysis results..."
    
    # Wait for fresh analysis results
    wait_for_analysis
    
    # Use the enhanced TypeScript script with duplication metrics
    ~/.bun/bin/bun run "$SCRIPT_DIR/result_with_duplications.ts"
}

# Main execution
main() {
    # Handle reset flag
    if [ "$1" = "--reset" ] || [ "$1" = "-r" ]; then
        reset_setup
        exit 0
    fi
    
    echo ""
    log_info "🔍 SonarQube Analysis Runner"
    echo ""
    
    check_docker
    check_docker_compose
    start_sonarqube
    wait_for_sonarqube
    change_admin_password
    generate_token
    create_project
    install_scanner
    run_analysis
    fetch_results
    
    echo ""
    log_success "All done! 🎉"
    echo ""
    log_info "Tip: Run with --reset to clear setup state and reconfigure from scratch"
    echo ""
}

main "$@"
