# Backup host configuration templates

Copies of the host-side files that drive the offsite backup to the owner's Synology NAS.
They live here so the setup can be rebuilt after a total server loss. The **live** copies
are the ones on the host — if you change one, copy it back here in the same change.

| File here | Install to | Purpose |
|---|---|---|
| `mnt-bigbike\x2dnas.mount` | `/etc/systemd/system/` | NFS v4.0 mount of `100.116.56.123:/volume1/Bigbike` at `/mnt/bigbike-nas` |
| `mnt-bigbike\x2dnas.automount` | `/etc/systemd/system/` | Mount on demand; re-establishes after a reboot without blocking boot |
| `cron.d-bigbike-backup` | `/etc/cron.d/bigbike-backup` | **The single place** to change cadence and retention |

The unit filenames contain a literal backslash (`systemd-escape -p --suffix=mount /mnt/bigbike-nas`).
Quote them in every shell command, or systemd will silently ignore a wrongly-named unit.

## Install on a fresh host

```bash
sudo install -m 0644 'deploy/backup/mnt-bigbike\x2dnas.mount'     '/etc/systemd/system/'
sudo install -m 0644 'deploy/backup/mnt-bigbike\x2dnas.automount' '/etc/systemd/system/'
sudo install -m 0644  deploy/backup/cron.d-bigbike-backup          /etc/cron.d/bigbike-backup
sudo mkdir -p /mnt/bigbike-nas /var/log/bigbike-backup
sudo systemctl daemon-reload
sudo systemctl enable --now 'mnt-bigbike\x2dnas.automount'
ls /mnt/bigbike-nas >/dev/null                       # triggers the mount
sudo chattr +i /mnt/bigbike-nas                      # only while UNMOUNTED; see runbook
```

The `.nas-marker` sentinel inside `vps-backups/` must exist on the NAS or every job refuses to run —
that is deliberate. Recreate it only after confirming the correct share is mounted.

Full procedure: [`../../docs/engineering/BACKUP_RESTORE_RUNBOOK.md`](../../docs/engineering/BACKUP_RESTORE_RUNBOOK.md).
