#!/bin/bash

# Phase 3 Production Deployment Script

echo "🚀 Starting Phase 3 Production Deployment..."

# Set environment variables
export DB_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
export GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Create .env file
cat > .env << EOF
DB_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
GRAFANA_PASSWORD=$GRAFANA_PASSWORD
EOF

# Build Docker images
echo "📦 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend npm run migrate

# Start all services
echo "▶️ Starting all services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking health..."
curl -f http://localhost:80/health || echo "Health check failed"

echo "✅ Deployment complete!"
echo "📊 Grafana: http://localhost:3001 (admin/${GRAFANA_PASSWORD})"
echo "📈 Prometheus: http://localhost:9090"
echo "🚀 API: http://localhost:80"