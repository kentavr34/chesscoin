#!/usr/bin/env python3
"""
secrets_encrypt.py — зашифровать plaintext .secrets.json → .secrets.enc.

Формат: OpenSSL AES-256-CBC + PBKDF2 (200 000 iterations).

Usage:
    python secrets_encrypt.py .secrets.json .secrets.enc PASSPHRASE

После encrypt — `shred -u .secrets.json` (или Windows: sdelete) — НЕ оставлять
plaintext на диске.
"""
from __future__ import annotations
import os
import subprocess
import sys


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    plain = sys.argv[1]
    enc_out = sys.argv[2]
    passphrase = sys.argv[3]

    if not os.path.exists(plain):
        print(f'ERROR: {plain} not found', file=sys.stderr)
        sys.exit(2)

    cmd = [
        'openssl', 'enc',
        '-aes-256-cbc', '-pbkdf2', '-iter', '200000',
        '-in', plain,
        '-out', enc_out,
        '-pass', f'pass:{passphrase}',
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        print('ERROR: openssl not found in PATH.', file=sys.stderr)
        sys.exit(3)

    if result.returncode != 0:
        print(f'ERROR: openssl encrypt failed: {result.stderr[:400]}', file=sys.stderr)
        sys.exit(result.returncode)

    sz = os.path.getsize(enc_out)
    print(f'OK: {plain} → {enc_out} ({sz} bytes encrypted)')
    print(f'REMINDER: shred/sdelete {plain} now. Не commit .secrets.json в git!')


if __name__ == '__main__':
    main()
