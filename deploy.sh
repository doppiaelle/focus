#!/bin/bash
# Deploy Focus by DoubleL su VPS con Podman + Caddy HTTPS
# Uso: FOCUS_DOMAIN=focus.tuodominio.com ./deploy.sh
set -e

PORTA=3001
VOLUME="focus-data"
IMMAGINE="focus-backend"
CONTAINER="focus"
CADDY_CONTAINER="focus-caddy"
CADDY_DATA="caddy-data"
CADDY_CONFIG="caddy-config"

echo "============================================"
echo "  Focus by DoubleL — Deploy"
echo "============================================"

if ! command -v podman &>/dev/null; then
  echo "[deploy] podman non trovato. Installalo:"
  echo "  sudo dnf install podman    # Fedora/RHEL"
  echo "  sudo apt install podman    # Debian/Ubuntu"
  exit 1
fi

# --- Dominio ---
if [ -z "$FOCUS_DOMAIN" ]; then
  echo ""
  echo "[deploy] ATTENZIONE: FOCUS_DOMAIN non impostato."
  echo "  Senza dominio, Caddy gira in HTTP locale (no HTTPS)."
  echo "  Per HTTPS: FOCUS_DOMAIN=focus.tuodominio.com ./deploy.sh"
  echo ""
  FOCUS_DOMAIN="localhost"
fi

# --- Ferma container precedenti ---
for c in "$CONTAINER" "$CADDY_CONTAINER"; do
  if podman ps --format "{{.Names}}" 2>/dev/null | grep -q "^${c}$"; then
    echo "[deploy] fermo $c..."
    podman stop "$c" 2>/dev/null || true
  fi
  podman rm "$c" 2>/dev/null || true
done

# --- Volumi ---
for v in "$VOLUME" "$CADDY_DATA" "$CADDY_CONFIG"; do
  if ! podman volume exists "$v" 2>/dev/null; then
    podman volume create "$v"
    echo "[deploy] volume $v creato"
  fi
done

# --- JWT_SECRET ---
SECRET_FILE="$HOME/.focus-jwt-secret"
if [ ! -f "$SECRET_FILE" ]; then
  openssl rand -hex 32 > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "[deploy] JWT_SECRET generato in $SECRET_FILE"
fi
JWT_SECRET=$(cat "$SECRET_FILE")

# --- INVITE_CODE ---
INVITE_FILE="$HOME/.focus-invite-code"
if [ ! -f "$INVITE_FILE" ]; then
  openssl rand -hex 8 > "$INVITE_FILE"
  chmod 600 "$INVITE_FILE"
  echo "[deploy] INVITE_CODE generato in $INVITE_FILE"
fi
INVITE_CODE=$(cat "$INVITE_FILE")

# --- Build e avvia Focus ---
echo "[deploy] build immagine..."
podman build -t "$IMMAGINE" -f Containerfile .

echo "[deploy] avvio Focus..."
podman run -d \
  --name "$CONTAINER" \
  --replace \
  -p "127.0.0.1:${PORTA}:3001" \
  -v "${VOLUME}:/app/data" \
  -e "JWT_SECRET=${JWT_SECRET}" \
  -e "INVITE_CODE=${INVITE_CODE}" \
  -e "OLLAMA_URL=${OLLAMA_URL:-http://host.containers.internal:11434}" \
  --restart unless-stopped \
  "$IMMAGINE"

# --- Avvia Caddy ---
echo "[deploy] avvio Caddy (HTTPS)..."
podman run -d \
  --name "$CADDY_CONTAINER" \
  --replace \
  --network host \
  -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "${CADDY_DATA}:/data" \
  -v "${CADDY_CONFIG}:/config" \
  -e "FOCUS_DOMAIN=${FOCUS_DOMAIN}" \
  --restart unless-stopped \
  docker.io/library/caddy:2-alpine

# --- Riepilogo ---
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "============================================"
echo "  Focus è online!"
echo ""
if [ "$FOCUS_DOMAIN" = "localhost" ]; then
  echo "  URL:          http://${IP}:${PORTA}"
  echo "  (no HTTPS — imposta FOCUS_DOMAIN per attivarlo)"
else
  echo "  URL:          https://${FOCUS_DOMAIN}"
  echo "  (certificato SSL automatico via Let's Encrypt)"
fi
echo ""
echo "  Invite code:  ${INVITE_CODE}"
echo ""
echo "  Logs Focus:   podman logs -f focus"
echo "  Logs Caddy:   podman logs -f focus-caddy"
echo "  Stop tutto:   podman stop focus focus-caddy"
echo "============================================"
echo ""
echo "  Dai l'invite code solo a chi vuoi far registrare."
echo "============================================"
