#!/usr/bin/env bash

# Script to check code health for all TypeScript files using CodeScene
# Usage: ./scripts/check-code-health.sh [--full]
# Options:
#   --full    Force full check of all files (ignore incremental cache)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Incremental check directory (in same directory as script)
CACHE_DIR="$SCRIPT_DIR/.cache"
TIMESTAMP_FILE="$CACHE_DIR/file-timestamps.txt"
RESULTS_FILE="$CACHE_DIR/results.txt"

# Function to detect OS (bash script runs on Unix-like systems only)
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux";;
        Darwin*) echo "macos";;
        *)       echo "unknown";;
    esac
}

# Function to install CodeScene CLI
install_codescene() {
    local os=$(detect_os)
    
    echo -e "${YELLOW}📦 Installing CodeScene CLI...${NC}"
    echo ""
    
    if [ "$os" = "unknown" ]; then
        echo -e "${RED}❌ Platform not recognized. Manual installation required.${NC}"
        echo "Download the binary from: ${BLUE}https://codescene.io/docs/cli/index.html#${NC}"
        return 1
    fi
    
    # Run the installer (pipe newline to handle interactive prompt)
    echo "Running installer..."
    if echo "" | curl -fsSL https://downloads.codescene.io/enterprise/cli/install-cs-tool.sh | sh; then
        echo ""
        echo -e "${GREEN}✅ CodeScene CLI installed successfully${NC}"
        
        # Add ~/.local/bin to PATH for current session if not already there
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            export PATH="$HOME/.local/bin:$PATH"
            echo -e "${BLUE}Added ~/.local/bin to PATH for current session${NC}"
        fi
        
        # For macOS, remove quarantine if needed
        if [ "$os" = "macos" ] && [ -f "$HOME/.local/bin/cs" ]; then
            echo "Removing macOS quarantine..."
            xattr -dr com.apple.quarantine "$HOME/.local/bin/cs" 2>/dev/null || true
        fi
        
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}❌ Installation failed${NC}"
        return 1
    fi
}

# Function to show token setup instructions
show_token_instructions() {
    echo -e "${YELLOW}🔑 Token Setup Instructions:${NC}"
    echo ""
    echo "1. Get your access token from your CodeScene administrator"
    echo "   (Projects configuration page)"
    echo ""
    echo "2. Set the CS_ACCESS_TOKEN environment variable:"
    echo ""
    echo "   Temporary (current session):"
    echo -e "   ${BLUE}export CS_ACCESS_TOKEN=<your-access-token>${NC}"
    echo ""
    echo "   Permanent (add to your shell config file):"
    echo -e "   ${BLUE}echo 'export CS_ACCESS_TOKEN=<your-access-token>' >> ~/.bashrc${NC}"
    echo -e "   ${BLUE}source ~/.bashrc${NC}"
    echo ""
    echo "   For other shells:"
    echo "   • zsh: Add to ~/.zshrc"
    echo "   • fish: Add to ~/.config/fish/config.fish"
    echo ""
}

# Check if cs CLI is installed, install if not
if ! command -v cs &> /dev/null; then
    echo -e "${YELLOW}⚠️  CodeScene CLI (cs) is not installed${NC}"
    echo ""
    
    if ! install_codescene; then
        exit 1
    fi
    
    # Verify installation
    if ! command -v cs &> /dev/null; then
        echo -e "${RED}❌ Installation completed but 'cs' command not found${NC}"
        echo -e "${YELLOW}You may need to restart your terminal or run:${NC}"
        echo -e "${BLUE}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        exit 1
    fi
fi

# Check CodeScene version
cs_version=$(cs version 2>&1 || echo "unknown")
echo -e "${GREEN}✓${NC} CodeScene CLI installed: ${BLUE}$cs_version${NC}"

# Check if CodeScene token is configured
if [ -z "$CS_ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ CS_ACCESS_TOKEN environment variable is not set${NC}"
    echo ""
    show_token_instructions
    exit 1
fi

echo -e "${GREEN}✓${NC} CS_ACCESS_TOKEN is configured"
echo ""

# Test if token is valid by running a simple check
cs_test=$(cs check --help 2>&1 || true)
if echo "$cs_test" | grep -qi "unauthorized\|invalid.*token\|authentication.*failed"; then
    echo -e "${RED}❌ CodeScene token appears to be invalid${NC}"
    echo ""
    echo "Please verify your token with your CodeScene administrator."
    echo ""
    show_token_instructions
    exit 1
fi

# Parse arguments
FORCE_FULL=false
if [ "$1" = "--full" ]; then
    FORCE_FULL=true
    echo -e "${BLUE}🔄 Running full check (ignoring cache)${NC}"
fi

# Create cache directory if it doesn't exist
mkdir -p "$CACHE_DIR"

# Function to get file modification time
get_mtime() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null
}

# Function to check if file needs checking
needs_check() {
    local file="$1"
    local current_mtime=$(get_mtime "$file")
    
    if [ "$FORCE_FULL" = true ]; then
        return 0
    fi
    
    if [ ! -f "$TIMESTAMP_FILE" ]; then
        return 0
    fi
    
    local cached_mtime=$(grep "^$file " "$TIMESTAMP_FILE" 2>/dev/null | cut -d' ' -f2)
    
    if [ -z "$cached_mtime" ] || [ "$current_mtime" != "$cached_mtime" ]; then
        return 0
    fi
    
    return 1
}

# Function to update file timestamp
update_timestamp() {
    local file="$1"
    local mtime=$(get_mtime "$file")
    
    # Remove old entry if exists
    if [ -f "$TIMESTAMP_FILE" ]; then
        grep -v "^$file " "$TIMESTAMP_FILE" > "$TIMESTAMP_FILE.tmp" 2>/dev/null || true
        mv "$TIMESTAMP_FILE.tmp" "$TIMESTAMP_FILE"
    fi
    
    # Add new entry
    echo "$file $mtime" >> "$TIMESTAMP_FILE"
}

# Function to save result
save_result() {
    local file="$1"
    local status="$2"
    local details="$3"
    
    # Remove old entry if exists
    if [ -f "$RESULTS_FILE" ]; then
        grep -v "^$file§§§" "$RESULTS_FILE" > "$RESULTS_FILE.tmp" 2>/dev/null || true
        mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"
    fi
    
    # Encode newlines as |||NEWLINE||| to preserve multi-line details
    local encoded_details=$(echo "$details" | sed ':a;N;$!ba;s/\n/|||NEWLINE|||/g')
    
    # Add new entry with unique delimiter
    echo "$file§§§$status§§§$encoded_details" >> "$RESULTS_FILE"
}

# Function to get cached result
get_cached_result() {
    local file="$1"
    
    if [ ! -f "$RESULTS_FILE" ]; then
        return 1
    fi
    
    grep "^$file§§§" "$RESULTS_FILE" 2>/dev/null || return 1
}

echo "🔍 Finding all TypeScript files..."

# Change to project root to ensure consistent paths
cd "$PROJECT_ROOT"

# Find all .ts and .tsx files, excluding node_modules and dist
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null)

if [ -z "$files" ]; then
    echo "❌ No TypeScript files found in src/"
    exit 1
fi

total_files=$(echo "$files" | wc -l | tr -d ' ')
echo "📊 Found $total_files TypeScript files"

# Count files that need checking
files_to_check=0
while IFS= read -r file; do
    if needs_check "$file"; then
        files_to_check=$((files_to_check + 1))
    fi
done <<< "$files"

if [ $files_to_check -eq 0 ]; then
    echo -e "${GREEN}✨ All files are up to date (no changes detected)${NC}"
    echo ""
else
    echo -e "${BLUE}🔄 Checking $files_to_check changed file(s)${NC}"
    echo -e "${BLUE}⚡ Skipping $((total_files - files_to_check)) unchanged file(s)${NC}"
    echo ""
fi

# Counters
perfect_count=0
warning_count=0
error_count=0
cached_count=0

# Arrays to store results
declare -a warning_files
declare -a error_files

# Check each file
while IFS= read -r file; do
    if needs_check "$file"; then
        # File needs checking
        result=$(cs check "$file" 2>&1)
        
        if echo "$result" | grep -q "warn:"; then
            warning_count=$((warning_count + 1))
            warning_files+=("$file")
            echo -e "${YELLOW}⚠️  $file${NC}"
            warnings=$(echo "$result" | grep "warn:" | sed 's/^/    /')
            echo "$warnings"
            echo ""
            save_result "$file" "warning" "$warnings"
        elif echo "$result" | grep -q "error:"; then
            error_count=$((error_count + 1))
            error_files+=("$file")
            echo -e "${RED}❌ $file${NC}"
            errors=$(echo "$result" | grep "error:" | sed 's/^/    /')
            echo "$errors"
            echo ""
            save_result "$file" "error" "$errors"
        else
            perfect_count=$((perfect_count + 1))
            echo -e "${GREEN}✅ $file${NC}"
            save_result "$file" "perfect" ""
        fi
        
        # Update timestamp
        update_timestamp "$file"
    else
        # Use cached result
        cached_result=$(get_cached_result "$file")
        # Use awk to parse multi-character delimiter
        status=$(echo "$cached_result" | awk -F'§§§' '{print $2}')
        encoded_details=$(echo "$cached_result" | awk -F'§§§' '{print $3}')
        # Decode newlines
        details=$(echo "$encoded_details" | sed 's/|||NEWLINE|||/\n/g')
        
        case "$status" in
            "perfect")
                perfect_count=$((perfect_count + 1))
                # Don't print perfect health cached files
                ;;
            "warning")
                warning_count=$((warning_count + 1))
                warning_files+=("$file")
                echo -e "${YELLOW}⚠️  $file ${BLUE}${NC}"
                if [ -n "$details" ]; then
                    echo -e "$details"
                fi
                echo ""
                ;;
            "error")
                error_count=$((error_count + 1))
                error_files+=("$file")
                echo -e "${RED}❌ $file ${BLUE}${NC}"
                if [ -n "$details" ]; then
                    echo -e "$details"
                fi
                echo ""
                ;;
        esac
        
        cached_count=$((cached_count + 1))
    fi
done <<< "$files"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Code Health Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Perfect health: $perfect_count files${NC}"
echo -e "${YELLOW}⚠️  With warnings: $warning_count files${NC}"
echo -e "${RED}❌ With errors: $error_count files${NC}"
if [ $cached_count -gt 0 ]; then
    echo -e "${BLUE}⚡ Cached results: $cached_count files${NC}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# List files with issues
if [ $warning_count -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Files with warnings:${NC}"
    for file in "${warning_files[@]}"; do
        echo "  - $file"
    done
fi

if [ $error_count -gt 0 ]; then
    echo ""
    echo -e "${RED}Files with errors:${NC}"
    for file in "${error_files[@]}"; do
        echo "  - $file"
    done
fi

# Exit with error if there are any issues
if [ $error_count -gt 0 ] || [ $warning_count -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}💡 For detailed analysis of a specific file, use the shell script:${NC}"
    echo -e "${YELLOW}   cs check --verbose <file>${NC}"
    echo -e "${YELLOW}💡 Run './health/codescene/codescene.sh --full' to force full check${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All files have perfect code health!${NC}"
exit 0
