#!/bin/bash
# Согласованность конфигурации TON — для эталона достигнутого.
#
# На проде 30.07.2026 стояло TON_NETWORK=testnet при mainnet-адресе кошелька
# (UQDZ…): верификация ходила на testnet.toncenter.com и спрашивала про
# mainnet-адрес — реальный платёж не нашёлся бы никогда. Плюс пустой
# TONCENTER_API_KEY означал жёсткий рейт-лимит и флапающую верификацию.
#
# Печатает одно слово: TON_CONSISTENT | TON_MISMATCH | TON_NO_KEY

N=$(docker exec chesscoin_backend printenv TON_NETWORK 2>/dev/null)
W=$(docker exec chesscoin_backend printenv PLATFORM_TON_WALLET 2>/dev/null)
K=$(docker exec chesscoin_backend printenv TONCENTER_API_KEY 2>/dev/null)

if [ -z "$K" ]; then
  echo TON_NO_KEY
elif [ -z "$N" ] || [ -z "$W" ]; then
  echo TON_MISMATCH
elif [ "$N" = "mainnet" ] && echo "$W" | grep -qE '^(UQ|EQ)'; then
  echo TON_CONSISTENT
elif [ "$N" = "testnet" ] && echo "$W" | grep -qE '^(0Q|kQ)'; then
  echo TON_CONSISTENT
else
  echo TON_MISMATCH
fi
