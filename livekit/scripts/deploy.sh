#!/bin/bash
echo "Deploying LiveKit Infrastructure..."

if [ ! -f .env ]; then
    echo "Warning: .env file not found! Copying .env.example..."
    cp .env.example .env
    echo "Please update the .env file with actual secrets and rerun deploy.sh"
    exit 1
fi

docker-compose --env-file .env pull
docker-compose --env-file .env up -d --remove-orphans
echo "Deployment complete."
