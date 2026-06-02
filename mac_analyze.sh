#!/usr/bin/env bash
# Analisi spazio disco macOS — solo lettura, nessuna eliminazione

set -uo pipefail

# ── colori ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── utilità ──────────────────────────────────────────────────────────────────
dir_size() {
    local path="$1"
    if [[ -d "$path" ]]; then
        du -sh "$path" 2>/dev/null | cut -f1
    else
        echo "—"
    fi
}

dir_size_bytes() {
    local path="$1"
    if [[ -d "$path" ]]; then
        du -sk "$path" 2>/dev/null | cut -f1
    else
        echo "0"
    fi
}

file_size() {
    local path="$1"
    if [[ -f "$path" ]]; then
        du -sh "$path" 2>/dev/null | cut -f1
    else
        echo "—"
    fi
}

print_header() {
    printf "\n${BOLD}${CYAN}══════════════════════════════════════════════════════${RESET}\n"
    printf "${BOLD}${CYAN}  %s${RESET}\n" "$1"
    printf "${BOLD}${CYAN}══════════════════════════════════════════════════════${RESET}\n"
}

print_row() {
    local label="$1" size="$2" cmd="$3"
    printf "  ${BOLD}%-38s${RESET} %s\n" "$label" "$size"
    if [[ -n "$cmd" ]]; then
        printf "  ${YELLOW}  → %s${RESET}\n" "$cmd"
    fi
}

TOTAL_SAVINGS_KB=0
add_savings() {
    local kb="${1:-0}"
    TOTAL_SAVINGS_KB=$(( TOTAL_SAVINGS_KB + kb ))
}

# ── intestazione ─────────────────────────────────────────────────────────────
clear
printf "\n${BOLD}╔══════════════════════════════════════════════════════╗${RESET}\n"
printf "${BOLD}║       ANALISI SPAZIO DISCO macOS — solo lettura      ║${RESET}\n"
printf "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}\n"
printf "\n  Data: %s\n" "$(date '+%d/%m/%Y %H:%M')"
printf "  Utente: %s\n" "$USER"

# ── panoramica disco ─────────────────────────────────────────────────────────
print_header "PANORAMICA DISCO"
df -h / | awk 'NR==2 {
    printf "  Totale: %s   Usato: %s   Libero: %s   (%s usato)\n", $2, $3, $4, $5
}'

# ── 1. Time Machine snapshots locali ────────────────────────────────────────
print_header "1 · TIME MACHINE — SNAPSHOT LOCALI"
if command -v tmutil &>/dev/null; then
    snapshots=$(tmutil listlocalsnapshots / 2>/dev/null)
    count=$(echo "$snapshots" | grep -c 'com.apple' 2>/dev/null || echo 0)
    if [[ "$count" -gt 0 ]]; then
        printf "  ${RED}%d snapshot trovati:${RESET}\n" "$count"
        echo "$snapshots" | while read -r snap; do
            [[ -n "$snap" ]] && printf "    • %s\n" "$snap"
        done
        snap_size_kb=$(tmutil listlocalsnapshotdates / 2>/dev/null | wc -l)
        printf "\n  ${YELLOW}→ Per eliminarli: tmutil deletelocalsnapshots /${RESET}\n"
        printf "  ${YELLOW}→ Stima liberabile: controllare con 'Informazioni su questo Mac → Archiviazione'${RESET}\n"
        add_savings 20480  # stima conservativa 20 GB
    else
        printf "  ${GREEN}Nessuno snapshot locale trovato.${RESET}\n"
    fi
else
    printf "  tmutil non disponibile.\n"
fi

# ── 2. Backup iPhone/iPad ────────────────────────────────────────────────────
print_header "2 · BACKUP iPhone / iPad"
BACKUP_DIR="$HOME/Library/Application Support/MobileSync/Backup"
if [[ -d "$BACKUP_DIR" ]]; then
    total=$(dir_size "$BACKUP_DIR")
    total_kb=$(dir_size_bytes "$BACKUP_DIR")
    printf "  Spazio totale backup: ${RED}%s${RESET}\n" "$total"
    count_backups=$(find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
    printf "  Numero di backup: %s\n" "$count_backups"
    printf "\n  ${YELLOW}→ Per gestirli: Finder → iPhone nella sidebar → 'Gestisci backup'${RESET}\n"
    printf "  ${YELLOW}→ Oppure: Impostazioni di sistema → Generali → Archiviazione iPhone${RESET}\n"
    add_savings "$total_kb"
else
    printf "  ${GREEN}Nessun backup locale trovato.${RESET}\n"
fi

# ── 3. Xcode ─────────────────────────────────────────────────────────────────
print_header "3 · XCODE"
XCODE_DERIVED="$HOME/Library/Developer/Xcode/DerivedData"
XCODE_DEVICE_SUPPORT="$HOME/Library/Developer/Xcode/iOS DeviceSupport"
XCODE_ARCHIVES="$HOME/Library/Developer/Xcode/Archives"
XCODE_SIMULATORS="$HOME/Library/Developer/CoreSimulator/Devices"

xcode_found=false
for d in "$XCODE_DERIVED" "$XCODE_DEVICE_SUPPORT" "$XCODE_ARCHIVES" "$XCODE_SIMULATORS"; do
    if [[ -d "$d" ]]; then xcode_found=true; break; fi
done

if $xcode_found; then
    s=$(dir_size "$XCODE_DERIVED"); kb=$(dir_size_bytes "$XCODE_DERIVED")
    print_row "DerivedData" "$s" "rm -rf ~/Library/Developer/Xcode/DerivedData/*"
    add_savings "$kb"

    s=$(dir_size "$XCODE_DEVICE_SUPPORT"); kb=$(dir_size_bytes "$XCODE_DEVICE_SUPPORT")
    print_row "iOS Device Support" "$s" "rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*"
    add_savings "$kb"

    s=$(dir_size "$XCODE_ARCHIVES")
    print_row "Archives (.xcarchive)" "$s" "Xcode → Window → Organizer → elimina manualmente"

    s=$(dir_size "$XCODE_SIMULATORS")
    print_row "Simulatori iOS" "$s" "xcrun simctl delete unavailable"
else
    printf "  ${GREEN}Xcode non installato — nessun dato.${RESET}\n"
fi

# ── 4. Docker ────────────────────────────────────────────────────────────────
print_header "4 · DOCKER"
DOCKER_DATA="$HOME/Library/Containers/com.docker.docker/Data"
if [[ -d "$DOCKER_DATA" ]]; then
    s=$(dir_size "$DOCKER_DATA"); kb=$(dir_size_bytes "$DOCKER_DATA")
    print_row "Docker (immagini + volumi)" "$s" "docker system prune -a --volumes"
    add_savings "$kb"
elif command -v docker &>/dev/null; then
    printf "  Docker installato ma dati non trovati nel percorso standard.\n"
else
    printf "  ${GREEN}Docker non installato.${RESET}\n"
fi

# ── 5. Macchine virtuali ──────────────────────────────────────────────────────
print_header "5 · MACCHINE VIRTUALI"
vm_found=false
for vm_dir in \
    "$HOME/Parallels" \
    "$HOME/Documents/Parallels" \
    "$HOME/Virtual Machines.localized" \
    "$HOME/Library/Containers/com.utmapp.UTM/Data/Documents"
do
    if [[ -d "$vm_dir" ]]; then
        s=$(dir_size "$vm_dir"); kb=$(dir_size_bytes "$vm_dir")
        print_row "$(basename "$vm_dir")" "$s" "Elimina le VM non usate dall'app"
        add_savings "$kb"
        vm_found=true
    fi
done
$vm_found || printf "  ${GREEN}Nessuna macchina virtuale trovata.${RESET}\n"

# ── 6. Cache utente ──────────────────────────────────────────────────────────
print_header "6 · CACHE APPLICAZIONI UTENTE"
CACHE_DIR="$HOME/Library/Caches"
if [[ -d "$CACHE_DIR" ]]; then
    total=$(dir_size "$CACHE_DIR"); total_kb=$(dir_size_bytes "$CACHE_DIR")
    printf "  Totale cache: ${YELLOW}%s${RESET}\n\n" "$total"
    printf "  Le 10 voci più grandi:\n"
    find "$CACHE_DIR" -maxdepth 1 -mindepth 1 -exec du -sk {} + 2>/dev/null \
        | sort -rn | head -10 \
        | while read -r kb path; do
            size=$(( kb / 1024 ))
            printf "    %6d MB  %s\n" "$size" "$(basename "$path")"
        done
    printf "\n  ${YELLOW}→ Per pulirle: usa lo script cleanup.sh${RESET}\n"
    add_savings "$total_kb"
fi

# ── 7. Log utente ────────────────────────────────────────────────────────────
print_header "7 · LOG APPLICAZIONI"
LOG_DIR="$HOME/Library/Logs"
s=$(dir_size "$LOG_DIR"); kb=$(dir_size_bytes "$LOG_DIR")
print_row "Log utente" "$s" "rm -rf ~/Library/Logs/*"
add_savings "$kb"

# ── 8. Homebrew ──────────────────────────────────────────────────────────────
print_header "8 · HOMEBREW"
if command -v brew &>/dev/null; then
    BREW_CACHE=$(brew --cache 2>/dev/null)
    s=$(dir_size "$BREW_CACHE"); kb=$(dir_size_bytes "$BREW_CACHE")
    print_row "Cache download Homebrew" "$s" "brew cleanup --prune=all"
    add_savings "$kb"
    CELLAR=$(brew --cellar 2>/dev/null)
    s=$(dir_size "$CELLAR")
    print_row "Cellar (pacchetti installati)" "$s" "brew autoremove  # rimuove dipendenze orfane"
else
    printf "  ${GREEN}Homebrew non installato.${RESET}\n"
fi

# ── 9. node_modules ──────────────────────────────────────────────────────────
print_header "9 · NODE_MODULES (top 5 più grandi)"
nm_found=false
find "$HOME" -name "node_modules" -type d -maxdepth 6 2>/dev/null \
    | head -20 \
    | xargs -I{} du -sk {} 2>/dev/null \
    | sort -rn | head -5 \
    | while read -r kb path; do
        size=$(( kb / 1024 ))
        printf "  %6d MB  %s\n" "$size" "$path"
        nm_found=true
    done
printf "  ${YELLOW}→ Negli artefatti non usati: npx npkill  (tool interattivo)${RESET}\n"

# ── 10. File grandi (>500 MB) ────────────────────────────────────────────────
print_header "10 · FILE GRANDI (> 500 MB)"
printf "  Ricerca in corso...\n"
found_large=false
while IFS= read -r -d '' f; do
    size=$(du -sh "$f" 2>/dev/null | cut -f1)
    printf "  %8s  %s\n" "$size" "$f"
    found_large=true
done < <(find "$HOME" \
    -not -path "*/Library/Developer/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/.Trash/*" \
    -type f -size +500M -print0 2>/dev/null)
$found_large || printf "  ${GREEN}Nessun file > 500 MB trovato (escluso Xcode e node_modules).${RESET}\n"

# ── 11. Cestino ──────────────────────────────────────────────────────────────
print_header "11 · CESTINO"
TRASH="$HOME/.Trash"
s=$(dir_size "$TRASH"); kb=$(dir_size_bytes "$TRASH")
if [[ "$kb" -gt 0 ]]; then
    print_row "Cestino" "$s" "Finder → Cestino → Svuota Cestino"
    add_savings "$kb"
else
    printf "  ${GREEN}Cestino vuoto.${RESET}\n"
fi

# ── 12. Download ─────────────────────────────────────────────────────────────
print_header "12 · CARTELLA DOWNLOAD"
DOWNLOADS="$HOME/Downloads"
s=$(dir_size "$DOWNLOADS"); kb=$(dir_size_bytes "$DOWNLOADS")
printf "  Dimensione totale: ${YELLOW}%s${RESET}\n" "$s"
printf "  File più grandi:\n"
find "$DOWNLOADS" -maxdepth 1 -type f 2>/dev/null \
    | xargs -I{} du -sk {} 2>/dev/null \
    | sort -rn | head -5 \
    | while read -r kb2 path; do
        size=$(( kb2 / 1024 ))
        printf "    %6d MB  %s\n" "$size" "$(basename "$path")"
    done
printf "  ${YELLOW}→ Revisiona e sposta in cloud o elimina i file non necessari${RESET}\n"

# ── riepilogo ────────────────────────────────────────────────────────────────
print_header "RIEPILOGO — SPAZIO POTENZIALMENTE LIBERABILE"

total_mb=$(( TOTAL_SAVINGS_KB / 1024 ))
total_gb=$(( total_mb / 1024 ))

printf "\n"
printf "  ${BOLD}Stima spazio recuperabile: ${RED}~%d GB${RESET} (${total_mb} MB)\n\n" "$total_gb"
printf "  ${BOLD}Priorità consigliata:${RESET}\n"
printf "  1. Time Machine snapshots   →  tmutil deletelocalsnapshots /\n"
printf "  2. Backup iPhone/iPad       →  Finder → iPhone → Gestisci backup\n"
printf "  3. Xcode artefatti          →  DerivedData + Device Support + Simulatori\n"
printf "  4. Docker                   →  docker system prune -a --volumes\n"
printf "  5. Cache applicazioni       →  bash cleanup.sh\n"
printf "  6. File grandi in Downloads →  revisione manuale\n"
printf "\n  ${YELLOW}Questo script non ha eliminato nulla.${RESET}\n"
printf "  ${YELLOW}Esegui i comandi sopra solo per ciò che vuoi davvero rimuovere.${RESET}\n\n"
