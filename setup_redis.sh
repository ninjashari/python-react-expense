#!/bin/bash

# Redis Setup Script for Expense Manager
# This script installs and configures Redis for caching

set -e

echo "🚀 Setting up Redis for Expense Manager..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command_exists apt-get; then
        # Ubuntu/Debian
        echo "📦 Installing Redis on Ubuntu/Debian..."
        sudo apt update
        sudo apt install -y redis-server
        
        # Configure Redis
        echo "⚙️ Configuring Redis..."
        sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
        sudo systemctl restart redis.service
        sudo systemctl enable redis.service
        
    elif command_exists yum; then
        # CentOS/RHEL
        echo "📦 Installing Redis on CentOS/RHEL..."
        sudo yum install -y epel-release
        sudo yum install -y redis
        sudo systemctl start redis
        sudo systemctl enable redis
        
    elif command_exists dnf; then
        # Fedora
        echo "📦 Installing Redis on Fedora..."
        sudo dnf install -y redis
        sudo systemctl start redis
        sudo systemctl enable redis
        
    else
        echo "❌ Unsupported Linux distribution. Please install Redis manually."
        exit 1
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command_exists brew; then
        echo "📦 Installing Redis on macOS via Homebrew..."
        brew install redis
        
        # Start Redis service
        echo "🚀 Starting Redis service..."
        brew services start redis
        
    else
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install Redis manually for your system."
    exit 1
fi

# Test Redis connection
echo "🧪 Testing Redis connection..."
if command_exists redis-cli; then
    if redis-cli ping | grep -q "PONG"; then
        echo "✅ Redis is running successfully!"
        
        # Show Redis info
        echo ""
        echo "📊 Redis Status:"
        redis-cli --version
        echo "Memory usage: $(redis-cli info memory | grep used_memory_human | cut -d: -f2)"
        echo "Uptime: $(redis-cli info server | grep uptime_in_seconds | cut -d: -f2) seconds"
        
    else
        echo "❌ Redis is installed but not responding to ping"
        echo "Try starting Redis manually:"
        echo "  Linux: sudo systemctl start redis"
        echo "  macOS: brew services start redis"
        exit 1
    fi
else
    echo "❌ redis-cli command not found"
    exit 1
fi

# Docker alternative info
echo ""
echo "🐳 Alternative: Run Redis with Docker"
echo "If you prefer using Docker instead:"
echo "  docker run -d --name redis -p 6379:6379 redis:latest"
echo "  docker start redis  # to start existing container"

# Configuration suggestions
echo ""
echo "⚙️ Configuration for Expense Manager:"
echo "Add these to your backend/.env file:"
echo "  REDIS_URL=redis://localhost:6379"
echo "  CACHE_ENABLED=true"
echo "  CACHE_DEFAULT_TTL=900"

# Performance tips
echo ""
echo "🔧 Performance Tips:"
echo "- Monitor Redis memory usage: redis-cli info memory"
echo "- Check cache hit rate: redis-cli info stats"
echo "- Clear cache if needed: redis-cli FLUSHDB"

echo ""
echo "🎉 Redis setup complete! You can now run the Expense Manager with caching enabled."