import React, { useState, useEffect, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import type { Transaction } from '@/types';
import { useT } from '@/i18n/useT';

function formatTxType(type: string, t: any): string {
  const types = t.txHistory.types as Record<string, string>;
  if (types[type]) return types[type];
  // Авто-форматирование: SOME_TYPE → Some Type
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Определение направления транзакции ────────────────────────────────────────
type TxDirection = 'income' | 'expense' | 'neutral';

function getTxDirection(tx: Transaction): TxDirection {
  const amount = tx.amount ?? '';
  if (amount.startsWith('+')) return 'income';
  if (amount.startsWith('-')) return 'expense';
  const type = tx.type ?? '';
  if (/WIN|REWARD|REFERRAL|DEPOSIT|ADMIN_CREDIT/.test(type)) return 'income';
  if (/BUY|PURCHASE|BET|LOSS|FEE|WITHDRAWAL/.test(type)) return 'expense';
  return 'neutral';
}

// ── Группировка транзакций по дате ────────────────────────────────────────────
function groupByDate(transactions: Transaction[], t: any): Array<{ label: string; items: Transaction[] }> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const fmt = (d: Date) => d.toLocaleDateString(t.settings?.language === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const todayStr = fmt(today);
  const yesterdayStr = fmt(yesterday);

  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const d = tx.createdAt ? new Date(tx.createdAt) : new Date(0);
    const label = fmt(d);
    const displayLabel = label === todayStr ? t.txHistory.today : label === yesterdayStr ? t.txHistory.yesterday : label;
    if (!groups.has(displayLabel)) groups.set(displayLabel, []);
    groups.get(displayLabel)!.push(tx);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

// ── Иконка типа транзакции ────────────────────────────────────────────────────
const TxIcon: React.FC<{ direction: TxDirection }> = ({ direction }) => {
  const colors = {
    income:  { bg: 'rgba(61,186,122,.12)', border: 'rgba(61,186,122,.25)', text: '#3DBA7A', sign: '+' },
    expense: { bg: 'rgba(204,96,96,.12)',  border: 'rgba(204,96,96,.25)',  text: '#CC6060', sign: '−' },
    neutral: { bg: 'rgba(74,158,255,.12)', border: 'rgba(74,158,255,.25)', text: '#4A9EFF', sign: '≈' },
  };
  const c = colors[direction];
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: c.bg,
      border: `.5px solid ${c.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.05rem', fontWeight: 900, color: c.text,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {c.sign}
    </div>
  );
};

// ── Одна транзакция ───────────────────────────────────────────────────────────
const TxRow: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const t = useT();
  const direction = getTxDirection(tx);
  const isIncome  = direction === 'income';
  const isExpense = direction === 'expense';

  const amountColor = isIncome ? '#3DBA7A' : isExpense ? '#CC6060' : '#4A9EFF';
  const rawAmount = tx.amount ?? '0';
  // Показываем знак явно
  const displayAmount = rawAmount.startsWith('+') || rawAmount.startsWith('-')
    ? rawAmount
    : isIncome  ? `+${rawAmount}`
    : isExpense ? `−${rawAmount.replace('-', '')}`
    : rawAmount;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      background: 'linear-gradient(135deg,#141018,#0F0E18)',
      border: '.5px solid rgba(212,168,67,.18)',
      borderRadius: 14,
    }}>
      <TxIcon direction={direction} />

      {/* Основная информация */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '.82rem', fontWeight: 700,
          color: '#EAE2CC',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {formatTxType(tx.type, t)}
        </div>
        <div style={{ fontSize: '.65rem', color: '#5A5248', marginTop: 2 }}>
          {tx.createdAt ? fmtDate(tx.createdAt) : ''}
        </div>
      </div>

      {/* Сумма */}
      <div style={{
        fontSize: '1rem', fontWeight: 900,
        color: amountColor,
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
        letterSpacing: '-.01em',
      }}>
        {displayAmount} <span style={{ fontFamily: 'inherit', fontSize: '.85em', opacity: .85 }}></span>
      </div>
    </div>
  );
};

// ── Метка секции (дата) ────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    fontSize: '.58rem', fontWeight: 700,
    color: '#7A7875',
    textTransform: 'uppercase',
    letterSpacing: '.14em',
    padding: '18px 14px 6px',
  }}>
    {label}
  </div>
);

// ── Итоговая сводка ────────────────────────────────────────────────────────────
const SummaryHeader: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const t = useT();
  const { totalIn, totalOut } = useMemo(() => {
    let inn = 0n;
    let out = 0n;
    for (const tx of transactions) {
      const d = getTxDirection(tx);
      try {
        const abs = BigInt(tx.amount.replace(/[+\-]/g, ''));
        if (d === 'income')  inn += abs;
        if (d === 'expense') out += abs;
      } catch {}
    }
    return { totalIn: inn, totalOut: out };
  }, [transactions]);

  return (
    <div style={{
      display: 'flex', gap: 10,
      padding: '14px 14px 6px',
    }}>
      {/* Приход */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg,#0E1C13,#0A1510)',
        border: '.5px solid rgba(61,186,122,.22)',
        borderRadius: 12, padding: '10px 12px',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#3DBA7A', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>
          {t.txHistory.income}
        </div>
        <div style={{ fontSize: '.92rem', fontWeight: 900, color: '#3DBA7A', fontFamily: "'JetBrains Mono', monospace" }}>
          +{fmtBalance(totalIn)}
        </div>
      </div>

      {/* Расход */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg,#1C0E0E,#15090A)',
        border: '.5px solid rgba(204,96,96,.22)',
        borderRadius: 12, padding: '10px 12px',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#CC6060', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 4 }}>
          {t.txHistory.expense}
        </div>
        <div style={{ fontSize: '.92rem', fontWeight: 900, color: '#CC6060', fontFamily: "'JetBrains Mono', monospace" }}>
          −{fmtBalance(totalOut)}
        </div>
      </div>
    </div>
  );
};

// ── Главная страница ───────────────────────────────────────────────────────────
export const TransactionHistoryPage: React.FC = () => {
  const t = useT();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    setLoading(true);
    profileApi
      .getTransactions(50, 0)
      .then((r) => setTransactions(r.transactions ?? []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupByDate(transactions, t), [transactions, t]);

  return (
    <PageLayout title={t.txHistory.title} backTo="/profile" centered>
      <style>{`@keyframes tx-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Загрузка */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <div style={{
            width: 28, height: 28,
            border: '3px solid rgba(212,168,67,.18)',
            borderTopColor: '#D4A843',
            borderRadius: '50%',
            animation: 'tx-spin .75s linear infinite',
          }} />
        </div>
      )}

      {/* Пустой список */}
      {!loading && transactions.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', gap: 12 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(212,168,67,.07)',
            border: '.5px solid rgba(212,168,67,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 4,
          }}>
            📋
          </div>
          <div style={{ fontSize: '.9rem', fontWeight: 700, color: '#7A7875' }}>
            {t.txHistory.noTx}
          </div>
          <div style={{ fontSize: '.72rem', color: '#4A4540', textAlign: 'center', maxWidth: 220 }}>
            {t.txHistory.noTxDesc}
          </div>
        </div>
      )}

      {/* Список транзакций */}
      {!loading && transactions.length > 0 && (
        <>
          {/* Сводка прихода/расхода */}
          <SummaryHeader transactions={transactions} />

          {/* Группы по дате */}
          {groups.map(({ label, items }) => (
            <div key={label}>
              <SectionLabel label={label} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
                {items.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ))}

          {/* Нижний отступ */}
          <div style={{ height: 16 }} />
        </>
      )}
    </PageLayout>
  );
};
