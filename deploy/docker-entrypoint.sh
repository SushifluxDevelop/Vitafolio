#!/bin/sh
# Container entrypoint. The container starts as root only to hand the data folder to the configured user, then runs the app without
# root rights (setpriv). PUID/PGID default to Unraid's nobody:users (99:100), the owner Unraid gives a new appdata folder; other hosts
# set their own. Started with --user (not root), it simply runs the app as that user.
# umask 077: the database, its write-ahead log, the keys and the backups are readable by the app user only (files 600, folders 700).
set -eu
umask 077

data_dir="${DATA_DIR:-/data}"
app="/app/Cv.Server.dll"

if [ "$(id -u)" != "0" ]; then
    exec dotnet "$app" "$@"
fi

puid="${PUID:-99}"
pgid="${PGID:-100}"
case "$puid" in ''|*[!0-9]*) echo "PUID muss eine Zahl sein (ist: '$puid')." >&2; exit 1 ;; esac
case "$pgid" in ''|*[!0-9]*) echo "PGID muss eine Zahl sein (ist: '$pgid')." >&2; exit 1 ;; esac
if [ "$pgid" = "0" ]; then
    echo "PGID=0 (root-Gruppe) ist nicht erlaubt: die Anwendung laeuft nie mit Root-Rechten. Bitte eine normale Gruppen-ID setzen (Unraid: 100)." >&2
    exit 1
fi
if [ "$puid" = "0" ]; then
    echo "PUID=0 (root) ist nicht erlaubt: die Anwendung laeuft nie mit Root-Rechten. Bitte eine normale Benutzer-ID setzen (Unraid: 99)." >&2
    exit 1
fi

mkdir -p "$data_dir"
# The backup folder may be mounted separately (BACKUP_DIR); it gets the same owner
backup_dir="${BACKUP_DIR:-}"
if [ -n "$backup_dir" ]; then mkdir -p "$backup_dir"; fi

# Only what does not belong to the user yet - a full chown on every start would be slow on a big folder
for dir in "$data_dir" "$backup_dir"; do
    [ -n "$dir" ] || continue
    find "$dir" \( ! -user "$puid" -o ! -group "$pgid" \) -exec chown -h "$puid:$pgid" {} +
    # Data written by earlier versions may be readable by group and others: tighten it (only what is not private yet)
    find "$dir" -perm /077 -exec chmod go-rwx {} +
done

export HOME=/tmp
exec setpriv --reuid="$puid" --regid="$pgid" --clear-groups --no-new-privs -- dotnet "$app" "$@"
