#!/bin/bash
# Deploy Focus by DoubleL su VPS con Podman
# Uso: ./deploy.sh [porta]
set -e

PORTA="${1:-3001}"
VOLUME="focus-data"
IMMAGINE="focus-backend"
CONTAINER="focus"

echo "============================================"
echo "  Focus by DoubleL — Deploy"
echo "============================================"

# Controlla podman
if ! command -v podman &>/dev/null; then
  echo "[deploy] podman non trovato. Installalo:"
  echo "  sudo dnf install podman    # Fedora/RHEL"
  echo "  sudo apt install podman    # Debian/Ubuntu"
  exit 1
fi

# Ferma container precedente
if podman ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
  echo "[deploy] fermo container precedente..."
  podman stop "$CONTAINER" || true
fi
if podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
  podman rm "$CONTAINER" || true
fi

# Volume persistente
if ! podman volume exists "$VOLUME" 2>/dev/null; then
  echo "[deploy] creo volume $VOLUME"
  podman volume create "$VOLUME"
else
  echo "[deploy] volume $VOLUME già presente"
fi

# Genera JWT_SECRET se non esiste
SECRET_FILE="$HOME/.focus-jwt-secret"
if [ ! -f "$SECRET_FILE" ]; then
  openssl rand -hex 32 > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "[deploy] JWT_SECRET generato in $SECRET_FILE"
fi
JWT_SECRET=$(cat "$SECRET_FILE")

# Build immagine
echo "[deploy] build immagine $IMMAGINE..."
podman build -t "$IMMAGINE" -f Containerfile .

echo ""
echo "[deploy] avvio Focus su porta $PORTA"

# Run in background con restart automatico
podman run -d \
  --name "$CONTAINER" \
  --replace \
  -p "${PORTA}:3001" \
  -v "${VOLUME}:/app/data" \
  -e "JWT_SECRET=${JWT_SECRET}" \
  -e "OLLAMA_URL=${OLLAMA_URL:-http://localhost:11434}" \
  --restart unless-stopped \
  "$IMMAGINE"

echo ""
echo "============================================"
echo "  Focus è online!"
echo "  URL:  http://$(hostname -I | awk '{print $1}'):${PORTA}"
echo "  Logs: podman logs -f focus"
echo "  Stop: podman stop focus"
echo "============================================"
