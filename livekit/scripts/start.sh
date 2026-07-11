#!/bin/bash
echo "Starting LiveKit Infrastructure..."
docker-compose --env-file .env up -d
echo "LiveKit is running in the background."
docker-compose ps
