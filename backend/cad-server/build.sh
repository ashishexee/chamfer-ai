#!/usr/bin/env bash
set -euo pipefail

echo "Building chamfer-ai-cad-executor Docker image..."
cd "$(dirname "$0")"
docker build -t chamfer-ai-cad-executor .
echo "Done. Image chamfer-ai-cad-executor is ready."
