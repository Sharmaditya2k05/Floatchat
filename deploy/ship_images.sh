#!/usr/bin/env bash
# Run on your laptop: build the production images here and copy them to the
# server, so a small VM never has to build anything.
#   bash deploy/ship_images.sh ubuntu@<VM_PUBLIC_IP> ~/.ssh/floatchat.key
set -euo pipefail
HOST=${1:?usage: ship_images.sh user@host [ssh-key]}
KEY=${2:-}
SSH_OPTS=${KEY:+-i $KEY}
cd "$(dirname "$0")/.."

docker compose -f docker-compose.prod.yml build
docker save floatchat-api floatchat-web | gzip > deploy/images.tar.gz
ls -lh deploy/images.tar.gz
scp $SSH_OPTS deploy/images.tar.gz "$HOST:~/FloatChat/deploy/"
ssh $SSH_OPTS "$HOST" 'gunzip -c ~/FloatChat/deploy/images.tar.gz | docker load && rm ~/FloatChat/deploy/images.tar.gz && docker images | grep floatchat'
