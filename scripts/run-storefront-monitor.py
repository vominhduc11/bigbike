#!/usr/bin/env python3
"""One-shot external monitor. Install/schedule/send only after recipient confirmation."""
import argparse
import concurrent.futures
import datetime as dt
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import urllib.parse
import urllib.request

spec = importlib.util.spec_from_file_location('uptime', Path(__file__).with_name('check-storefront-uptime.py'))
uptime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uptime)


def transitions(previous, current):
    """Only compare states successfully notified; retry after a delivery failure."""
    failed = [key for key, value in current.items() if value and previous.get(key) != value]
    recovered = [key for key, value in current.items() if not value and previous.get(key)]
    return failed, recovered


def send_telegram(credentials, message):
    # Reject redirects so credentials cannot be forwarded to another host.
    token = credentials['bot_token']
    if not isinstance(token, str) or not token or any(c not in '0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-' for c in token):
        raise ValueError('INVALID_CREDENTIALS')
    request = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/sendMessage',
        data=json.dumps({'chat_id': credentials['chat_id'], 'text': message}).encode(),
        headers={'Content-Type': 'application/json'}, method='POST',
    )
    with urllib.request.build_opener(uptime.NoRedirect()).open(request, timeout=10) as response:
        if response.status != 200 or json.loads(response.read(65536)).get('ok') is not True:
            raise ValueError('DELIVERY_FAILED')


def save_state(path, state):
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.monitor-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            json.dump(state, output)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def load_targets(path):
    config = json.loads(path.read_text(encoding='utf-8'))
    checks = config['checks']
    if set(checks) != {'home', 'product', 'feed'}:
        raise ValueError('THREE_TARGETS_REQUIRED')
    targets = []
    for kind in ('home', 'product', 'feed'):
        check = checks[kind]
        url = urllib.parse.urlsplit(check['url'])
        if url.scheme != 'https' or url.hostname != 'bigbike.vn' or url.port not in (None, 443) or url.username or url.password or url.fragment:
            raise ValueError('INVALID_TARGET')
        if kind != 'feed' and not check.get('marker'):
            raise ValueError('MARKER_REQUIRED')
        targets.append((kind, check['url'], check.get('marker')))
    return targets


def run(args):
    targets = load_targets(args.config)
    stamp = dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).isoformat(timespec='seconds')
    if args.test_event:
        credentials = json.loads(args.credentials.read_text())
        event = 'MẤT KẾT NỐI' if args.test_event == 'outage' else 'KHÔI PHỤC'
        send_telegram(credentials, f'THỬ NGHIỆM BigBike — {event} — {stamp}. Production không bị ngắt; vui lòng xác nhận dev và anh Trí nhận được tin.')
        print(json.dumps({'testEvent': args.test_event, 'delivered': True, 'productionInterrupted': False}))
        return 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(lambda target: uptime.probe(*target), targets))
    current = {row['target']: sorted(set(row['errors'])) for row in results}
    ok = not any(current.values())
    if args.dry_run:
        print(json.dumps({'checkedAt': stamp, 'ok': ok, 'dryRun': True, 'targets': results}))
        return 0 if ok else 1
    previous = json.loads(args.state.read_text()) if args.state.exists() else {}
    failed, recovered = transitions(previous, current)
    delivered = False
    if failed or recovered:
        credentials = json.loads(args.credentials.read_text())
        parts = [f'BigBike — {stamp}']
        if failed:
            parts.append('Không truy cập đúng: ' + ', '.join(f'{key} ({"/".join(current[key])})' for key in failed))
        if recovered:
            parts.append('Đã khôi phục: ' + ', '.join(recovered))
        send_telegram(credentials, '\n'.join(parts))
        delivered = True
    save_state(args.state, current)
    print(json.dumps({'checkedAt': stamp, 'ok': ok, 'notificationDelivered': delivered, 'targets': results}))
    return 0 if ok else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--state', type=Path, default=Path('/var/lib/bigbike-gmc-monitor/state.json'))
    parser.add_argument('--credentials', type=Path, default=Path('/etc/bigbike-gmc-monitor/telegram.json'))
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--dry-run', action='store_true')
    group.add_argument('--test-event', choices=['outage', 'recovery'])
    args = parser.parse_args()
    try:
        # Dry runs do not require writable state or Telegram credentials.
        if args.dry_run or args.test_event:
            return run(args)
        args.state.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with args.state.with_suffix('.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print(json.dumps({'skipped': 'ALREADY_RUNNING'}))
                return 0
            return run(args)
    except Exception:
        # Never print exceptions: HTTP errors can include the bot token in the URL.
        print(json.dumps({'ok': False, 'error': 'CONFIG_STATE_OR_DELIVERY_FAILED'}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
