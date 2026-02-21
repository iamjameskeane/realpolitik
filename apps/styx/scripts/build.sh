#!/bin/bash

# Styx Gateway Docker Image Build Script

set -e

IMAGE_NAME="realpolitik/styx"
VERSION=${1:-latest}
FULL_IMAGE_NAME="${IMAGE_NAME}:${VERSION}"

echo "Building Styx gateway Docker image: ${FULL_IMAGE_NAME}"

# Build the image
docker build -t ${FULL_IMAGE_NAME} .

# Show image info
echo "Image built successfully!"
docker images | grep styx

echo ""
echo "To run the container:"
echo "  docker run -p 8080:8080 -e DELPHI_URL=http://host.docker.internal:8000 ${FULL_IMAGE_NAME}"

echo ""
echo "To push to registry:"
echo "  docker push ${FULL_IMAGE_NAME}"