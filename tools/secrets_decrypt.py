#!/usr/bin/env python3
"""
secrets_decrypt.py — расшифровать .secrets.enc → stdout (или файл).

Формат: OpenSSL AES-256-CBC + PBKDF2 (200 000 iterations) — совместим с
vault_decrypt.bat в этом же tools/ и с openssl CLI.

Usage:
    python secrets_decrypt.py .secrets.enc PASSPHRASE             # → stdout
    python secrets_decrypt.py .secrets.enc PASSPHRASE out.json    # → файл

ВАЖНО:
- Никогда не commit'ить расшифрованный output в git.
- Не сохранять plaintext дольше чем нужно. Используй -> | jq и stream-обработку.
- Passphrase Кенан держит на телефоне (backup в Telegram Vault chat).

Чувствительность: расшифрованный JSON содержит API keys, SSH paths, tokens.
Никогда не вставлять plaintext content в LightRAG / Postgres / chat history.
"""
from __future__ import annotations
import os
import subprocess
import sys


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    enc_path = sys.argv[1]
    passphrase = sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.exists(enc_path):
        print(f'ERROR: {enc_path} not found', file=sys.stderr)
        sys.exit(2)

    # OpenSSL: AES-256-CBC + PBKDF2, 200 000 iterations (same as vault_decrypt.bat)
    cmd = [
        'openssl', 'enc', '-d',
        '-aes-256-cbc', '-pbkdf2', '-iter', '200000',
        '-in', enc_path,
        '-pass', f'pass:{passphrase}',
    ]
    if out_path:
        cmd += ['-out', out_path]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        print('ERROR: openssl not found in PATH. Install OpenSSL or use Git Bash.',
              file=sys.stderr)
        sys.exit(3)

    if result.returncode != 0:
        print(f'ERROR: openssl decrypt failed (likely wrong passphrase):',
              file=sys.stderr)
        print(result.stderr[:400], file=sys.stderr)
        sys.exit(result.returncode)

    if out_path:
        print(f'OK: decrypted → {out_path}', file=sys.stderr)
        print('REMINDER: shred {out_path} when done. Не commit'.format(out_path=out_path),
              file=sys.stderr)
    else:
        # stdout — для pipe в jq / другую обработку
        sys.stdout.write(result.stdout)
        sys.stdout.flush()


if __name__ == '__main__':
    main()
