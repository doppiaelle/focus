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

# JWT_SECRET — generato una volta, riusato sempre
SECRET_FILE="$HOME/.focus-jwt-secret"
if [ ! -f "$SECRET_FILE" ]; then
  openssl rand -hex 32 > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "[deploy] JWT_SECRET generato in $SECRET_FILE"
fi
JWT_SECRET=$(cat "$SECRET_FILE")

# INVITE_CODE — generato una volta, serve per registrare nuovi utenti
INVITE_FILE="$HOME/.focus-invite-code"
if [ ! -f "$INVITE_FILE" ]; then
  openssl rand -hex 8 > "$INVITE_FILE"
  chmod 600 "$INVITE_FILE"
  echo "[deploy] INVITE_CODE generato in $INVITE_FILE"
fi
INVITE_CODE=$(cat "$INVITE_FILE")

echo "[deploy] build immagine $IMMAGINE..."
podman build -t "$IMMAGINE" -f Containerfile .

echo ""
echo "[deploy] avvio Focus su porta $PORTA"

podman run -d \
  --name "$CONTAINER" \
  --replace \
  -p "${PORTA}:3001" \
  -v "${VOLUME}:/app/data" \
  -e "JWT_SECRET=${JWT_SECRET}" \
  -e "INVITE_CODE=${INVITE_CODE}" \
  -e "OLLAMA_URL=${OLLAMA_URL:-http://localhost:11434}" \
  --restart unless-stopped \
  "$IMMAGINE"

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "============================================"
echo "  Focus è online!"
echo ""
echo "  URL:          http://${IP}:${PORTA}"
echo "  Invite code:  ${INVITE_CODE}"
echo "  Logs:         podman logs -f focus"
echo "  Stop:         podman stop focus"
echo "============================================"
echo ""
echo "  Dai l'invite code solo a chi vuoi far registrare."
echo "  Per cambiarlo: modifica $INVITE_FILE e rilancia."
echo "============================================"
