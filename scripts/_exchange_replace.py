# -*- coding: utf-8 -*-
"""Замена русских строк в ExchangeTab на обращения к словарю.

Меняем только там, где строка действительно показывается игроку. Каждая
замена точечная: одна русская строка — один ключ. Если строка не нашлась,
скрипт скажет об этом, а не сделает вид, что справился.
"""
import io
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

P = 'frontend/src/pages/ExchangeTab.tsx'
s = io.open(P, encoding='utf-8').read()

# (что искать, на что менять)
ЗАМЕНЫ = [
    # тосты и ошибки — строки в кавычках
    ("showToast('Открываю кошелёк...')", "showToast(t.exchange.openingWallet)"),
    ("throw new Error('Не удалось получить адрес кошелька')", "throw new Error(t.exchange.walletAddrFail)"),
    ("showToast('Кошелёк подключён')", "showToast(t.exchange.walletConnectedToast)"),
    ("'Ошибка подключения'", "t.exchange.connectError"),
    ("setErrMsg('Кошелёк продавца не найден, обнови список')", "setErrMsg(t.exchange.sellerWalletMissing)"),
    ("'Не удалось зарезервировать ордер'", "t.exchange.reserveFailed"),
    ("'Недостаточно баланса'", "t.exchange.notEnoughBalance"),
    ("'Недостаточно монет для этого ордера'", "t.exchange.notEnoughCoinsForOrder"),
    ("'Транзакция отменена'", "t.exchange.txCancelled"),

    # заголовки и подписи в разметке
    (">Цена / TON (за 1М)<", ">{t.exchange.pricePerMln}<"),
    (": 'Сделок пока нет'", ": t.exchange.noTradesYet"),
    (">Нет данных за период<", ">{t.exchange.noDataPeriod}<"),
    ("label: 'Ордеров'", "label: t.exchange.statOrders"),
    ("label: 'Объём 24ч'", "label: t.exchange.statVolume24"),
    ("label: 'Сделок 24ч'", "label: t.exchange.statTrades24"),
    ("label: 'Всего сделок'", "label: t.exchange.statTradesAll"),

    (">Купить<", ">{t.exchange.buy}<"),
    (">Продать<", ">{t.exchange.sell}<"),

    ("'Продают'", "t.exchange.tabSelling"),
    ("'Покупают'", "t.exchange.tabBuying"),
    ("'Мои'", "t.exchange.tabMine"),
    ("'История'", "t.exchange.tabHistory"),
    ("'Топ'", "t.exchange.tabTop"),

    (">Пока нет ордеров на продажу<", ">{t.exchange.emptySell}<"),
    (">Нет ордеров на покупку<", ">{t.exchange.emptyBuy}<"),
    (">У тебя нет активных ордеров<", ">{t.exchange.emptyMine}<"),
    (">История пуста<", ">{t.exchange.emptyHistory}<"),
    (">Будь первым — выстави ордер!<", ">{t.exchange.beFirst}<"),
    (">Загрузка...<", ">{t.exchange.loadingDots}<"),

    (">Игрок<", ">{t.exchange.colPlayer}<"),
    (">Кол-во<", ">{t.exchange.colAmount}<"),
    (">Цена за 1M<", ">{t.exchange.colPricePerM}<"),
    (">Итого TON<", ">{t.exchange.colTotalTon}<"),
    (">Комиссия 0.5%<", ">{t.exchange.fee05}<"),
    (">Монет / в TON<", ">{t.exchange.coinsInTon}<"),
    (">Цена TON<", ">{t.exchange.tonPrice}<"),

    (">Продавец<", ">{t.exchange.seller}<"),
    (">Покупатель<", ">{t.exchange.buyer}<"),
    ("'Продавцу'", "t.exchange.toSeller"),
    ("'Продаёшь'", "t.exchange.youSell"),
    ("'Платишь TON'", "t.exchange.youPay"),
    ("'Получишь'", "t.exchange.youGet"),
    ("'Заплатишь'", "t.exchange.willPay"),
    ("'Цена'", "t.exchange.colPrice"),
    ("'Итого'", "t.exchange.colTotal"),
    ("'Комиссия'", "t.exchange.colFee"),
    ("'Продажа покупателю'", "t.exchange.saleToBuyer"),
    ("'Продажа'", "t.exchange.kindSale"),
    ("'Покупка'", "t.exchange.kindPurchase"),
    ("'(частично)'", "t.exchange.partly"),
    ("'(всё)'", "t.exchange.whole"),

    (">Выставить на продажу<", ">{t.exchange.placeSell}<"),
    (">Выставить на покупку<", ">{t.exchange.placeBuy}<"),
    (">Создай ордер на покупку — цена и объём<", ">{t.exchange.createBuyHint}<"),
    ("'Создаю...'", "t.exchange.creating"),
    ("'Создаю ордер…'", "t.exchange.creatingOrder"),
    ("'Резервирую ордер...'", "t.exchange.reserving"),
    ("'Продавец найден'", "t.exchange.sellerFound"),
    (">Подтверди перевод в кошельке<", ">{t.exchange.confirmInWalletShort}<"),
    (">Отмена<", ">{t.exchange.cancel}<"),

    (">КОЛИЧЕСТВО<", ">{t.exchange.labelQuantity}<"),
    (">МОЯ ЦЕНА (TON за 1М)<", ">{t.exchange.labelMyPrice}<"),
    (">ЦЕНА (TON за 1 000 000)<", ">{t.exchange.labelPricePerM}<"),
    (">ХОЧУ КУПИТЬ<", ">{t.exchange.labelWantBuy}<"),

    (">Ордер зарезервирован<", ">{t.exchange.orderReserved}<"),
    (">Монеты получены<", ">{t.exchange.coinsReceived}<"),

    # экран подключения
    (">Подключить TON-кошелёк<", ">{t.exchange.connectWalletTitle}<"),
    ("'Подключение…'", "t.exchange.connecting"),
    (">Продавай монеты за TON напрямую<", ">{t.exchange.sellDirect}<"),
    (">Покупай по рыночной цене<", ">{t.exchange.buyAtMarket}<"),
    (">Комиссия платформы: 0.5%<", ">{t.exchange.platformFee}<"),
]

не_нашлось = []
сделано = 0
for было, стало in ЗАМЕНЫ:
    if было not in s:
        не_нашлось.append(было)
        continue
    n = s.count(было)
    s = s.replace(было, стало)
    сделано += n

io.open(P, 'w', encoding='utf-8').write(s)
print('заменено вхождений: %d' % сделано)
if не_нашлось:
    print('НЕ НАШЛОСЬ (%d) — проверить руками:' % len(не_нашлось))
    for x in не_нашлось:
        print('   ', x[:70])
