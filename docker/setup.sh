#!/bin/bash

set -e

echo "=========================================="
echo "License Server Docker Setup Script"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "Step 1: Creating necessary directories..."
mkdir -p nginx/ssl
mkdir -p logs

if [ ! -f ".env" ]; then
    echo "Step 2: Creating .env file from template..."
    cp .env.example .env
    
    SESSION_SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-super-secret-session-key-change-this/$SESSION_SECRET/" .env
        sed -i '' "s/your-super-secret-jwt-key-change-this/$JWT_SECRET/" .env
        sed -i '' "s/license_secret_password/$POSTGRES_PASSWORD/g" .env
    else
        sed -i "s/your-super-secret-session-key-change-this/$SESSION_SECRET/" .env
        sed -i "s/your-super-secret-jwt-key-change-this/$JWT_SECRET/" .env
        sed -i "s/license_secret_password/$POSTGRES_PASSWORD/g" .env
    fi
    
    echo "   Generated secure secrets and saved to .env"
else
    echo "Step 2: .env file already exists, skipping..."
fi

if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "Step 3: Generating self-signed SSL certificates for development..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost" \
        2>/dev/null
    echo "   Self-signed certificates generated."
    echo "   For production, replace with proper SSL certificates."
else
    echo "Step 3: SSL certificates already exist, skipping..."
fi

echo "Step 4: Building Docker images..."
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD build --no-cache

echo "Step 5: Starting services..."
$COMPOSE_CMD up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "Step 6: Checking service status..."
$COMPOSE_CMD ps

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  - Application:  http://localhost (via Nginx)"
echo "  - PostgreSQL:   localhost:5432 (internal)"
echo "  - Redis:        localhost:6379 (internal)"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: P@ssw0rd@123"
echo ""
echo "Useful commands:"
echo "  View logs:      $COMPOSE_CMD logs -f"
echo "  Stop services:  $COMPOSE_CMD down"
echo "  Restart:        $COMPOSE_CMD restart"
echo "  Rebuild:        $COMPOSE_CMD up -d --build"
echo ""
echo "For production deployment:"
echo "  1. Replace self-signed SSL certificates in nginx/ssl/"
echo "  2. Update .env with strong secrets"
echo "  3. Configure your domain in nginx.conf"
echo ""
