# -*- coding: utf-8 -*-
"""Перевод биржи: строки из кода — в словарь и в таблицу текстов.

Экран биржи был написан по-русски прямо в разметке: 83 строки мимо словаря,
то есть для азербайджанского и турецкого игрока вся биржа оставалась русской.
Ключи кладём в `exchange` — там уже живёт половина текстов этого экрана.
"""
import io
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ключ: (ru, en, az, tr)
СЛОВАРЬ = {
    'walletConnected':    ('Кошелёк подключён', 'Wallet connected', 'Pul kisəsi qoşuldu', 'Cüzdan bağlı'),
    'disconnect':         ('Отвязать', 'Disconnect', 'Ayır', 'Bağlantıyı kes'),
    'disconnecting':      ('Отвязываю…', 'Disconnecting…', 'Ayrılır…', 'Kesiliyor…'),
    'walletDisconnected': ('Кошелёк отвязан', 'Wallet disconnected', 'Pul kisəsi ayrıldı', 'Cüzdan bağlantısı kesildi'),
    'disconnectFailed':   ('Не удалось отвязать кошелёк, попробуй ещё раз', 'Could not disconnect the wallet, try again', 'Pul kisəsini ayırmaq alınmadı, yenidən cəhd edin', 'Cüzdan bağlantısı kesilemedi, tekrar deneyin'),
    'disconnectConfirm':  ('Отвязать кошелёк? Торговля на бирже станет недоступна, пока не подключишь снова.', 'Disconnect the wallet? Exchange trading will be unavailable until you connect again.', 'Pul kisəsi ayrılsın? Yenidən qoşulana qədər birjada ticarət əlçatmaz olacaq.', 'Cüzdan bağlantısı kesilsin mi? Yeniden bağlanana kadar borsada işlem yapılamaz.'),

    'connectWalletTitle': ('Подключить TON-кошелёк', 'Connect a TON wallet', 'TON pul kisəsini qoş', 'TON cüzdanı bağla'),
    'connectWalletNeed':  ('Кошелёк нужен для торговли на бирже.', 'A wallet is required to trade on the exchange.', 'Birjada ticarət üçün pul kisəsi lazımdır.', 'Borsada işlem için cüzdan gerekir.'),
    'confirmOnce':        ('1 TON, один раз', '1 TON, once', '1 TON, bir dəfə', '1 TON, bir kez'),
    'confirmAddressNote': ('Подтверждение адреса —', 'Address confirmation —', 'Ünvanın təsdiqi —', 'Adres onayı —'),
    'sameWalletFree':     ('Тот же кошелёк дальше подключается бесплатно.', 'The same wallet connects free of charge afterwards.', 'Həmin pul kisəsi sonra pulsuz qoşulur.', 'Aynı cüzdan sonrasında ücretsiz bağlanır.'),
    'sellDirect':         ('Продавай монеты за TON напрямую', 'Sell coins for TON directly', 'Sikkələri birbaşa TON-a sat', 'Coinleri doğrudan TON karşılığı sat'),
    'buyAtMarket':        ('Покупай по рыночной цене', 'Buy at the market price', 'Bazar qiyməti ilə al', 'Piyasa fiyatından al'),
    'platformFee':        ('Комиссия платформы: 0.5%', 'Platform fee: 0.5%', 'Platforma komissiyası: 0.5%', 'Platform komisyonu: %0.5'),
    'connecting':         ('Подключение…', 'Connecting…', 'Qoşulur…', 'Bağlanıyor…'),
    'openingWallet':      ('Открываю кошелёк...', 'Opening the wallet...', 'Pul kisəsi açılır...', 'Cüzdan açılıyor...'),
    'walletAddrFail':     ('Не удалось получить адрес кошелька', 'Could not get the wallet address', 'Pul kisəsinin ünvanı alınmadı', 'Cüzdan adresi alınamadı'),
    'connectError':       ('Ошибка подключения', 'Connection error', 'Qoşulma xətası', 'Bağlantı hatası'),
    'walletConnectedToast': ('Кошелёк подключён', 'Wallet connected', 'Pul kisəsi qoşuldu', 'Cüzdan bağlandı'),

    'pricePerMln':      ('Цена / TON (за 1М)', 'Price / TON (per 1M)', 'Qiymət / TON (1M üçün)', 'Fiyat / TON (1M için)'),
    'noTradesYet':      ('Сделок пока нет', 'No trades yet', 'Hələ sövdələşmə yoxdur', 'Henüz işlem yok'),
    'volumeShort':      ('Объём', 'Volume', 'Həcm', 'Hacim'),
    'noDataPeriod':     ('Нет данных за период', 'No data for this period', 'Bu dövr üçün məlumat yoxdur', 'Bu dönem için veri yok'),
    'statOrders':       ('Ордеров', 'Orders', 'Sifarişlər', 'Emirler'),
    'statVolume24':     ('Объём 24ч', 'Volume 24h', 'Həcm 24s', 'Hacim 24s'),
    'statTrades24':     ('Сделок 24ч', 'Trades 24h', 'Sövdələşmə 24s', 'İşlem 24s'),
    'statTradesAll':    ('Всего сделок', 'Total trades', 'Ümumi sövdələşmə', 'Toplam işlem'),

    'tabSelling':   ('Продают', 'Selling', 'Satırlar', 'Satanlar'),
    'tabBuying':    ('Покупают', 'Buying', 'Alırlar', 'Alanlar'),
    'tabMine':      ('Мои', 'Mine', 'Mənim', 'Benim'),
    'tabHistory':   ('История', 'History', 'Tarixçə', 'Geçmiş'),
    'tabTop':       ('Топ', 'Top', 'Top', 'Top'),

    'emptySell':    ('Пока нет ордеров на продажу', 'No sell orders yet', 'Hələ satış sifarişi yoxdur', 'Henüz satış emri yok'),
    'emptyBuy':     ('Нет ордеров на покупку', 'No buy orders', 'Alış sifarişi yoxdur', 'Alış emri yok'),
    'emptyMine':    ('У тебя нет активных ордеров', 'You have no active orders', 'Aktiv sifarişiniz yoxdur', 'Aktif emriniz yok'),
    'emptyHistory': ('История пуста', 'History is empty', 'Tarixçə boşdur', 'Geçmiş boş'),
    'beFirst':      ('Будь первым — выстави ордер!', 'Be the first — place an order!', 'İlk ol — sifariş ver!', 'İlk sen ol — emir ver!'),
    'loadingDots':  ('Загрузка...', 'Loading...', 'Yüklənir...', 'Yükleniyor...'),

    'colPlayer':    ('Игрок', 'Player', 'Oyunçu', 'Oyuncu'),
    'colAmount':    ('Кол-во', 'Amount', 'Miqdar', 'Miktar'),
    'colPrice':     ('Цена', 'Price', 'Qiymət', 'Fiyat'),
    'colPricePerM': ('Цена за 1M', 'Price per 1M', '1M üçün qiymət', '1M için fiyat'),
    'colTotal':     ('Итого', 'Total', 'Cəmi', 'Toplam'),
    'colTotalTon':  ('Итого TON', 'Total TON', 'Cəmi TON', 'Toplam TON'),
    'colFee':       ('Комиссия', 'Fee', 'Komissiya', 'Komisyon'),
    'fee05':        ('Комиссия 0.5%', 'Fee 0.5%', 'Komissiya 0.5%', 'Komisyon %0.5'),
    'coinsInTon':   ('Монет / в TON', 'Coins / in TON', 'Sikkə / TON ilə', 'Coin / TON olarak'),
    'tonPrice':     ('Цена TON', 'TON price', 'TON qiyməti', 'TON fiyatı'),

    'seller':       ('Продавец', 'Seller', 'Satıcı', 'Satıcı'),
    'buyer':        ('Покупатель', 'Buyer', 'Alıcı', 'Alıcı'),
    'toSeller':     ('Продавцу', 'To the seller', 'Satıcıya', 'Satıcıya'),
    'youSell':      ('Продаёшь', 'You sell', 'Satırsınız', 'Satıyorsunuz'),
    'youPay':       ('Платишь TON', 'You pay TON', 'TON ödəyirsiniz', 'TON ödüyorsunuz'),
    'youGet':       ('Получишь', 'You get', 'Alacaqsınız', 'Alacaksınız'),
    'willPay':      ('Заплатишь', 'You will pay', 'Ödəyəcəksiniz', 'Ödeyeceksiniz'),
    'kindSale':     ('Продажа', 'Sale', 'Satış', 'Satış'),
    'kindPurchase': ('Покупка', 'Purchase', 'Alış', 'Alış'),
    'saleToBuyer':  ('Продажа покупателю', 'Sale to a buyer', 'Alıcıya satış', 'Alıcıya satış'),
    'partly':       ('(частично)', '(partly)', '(qismən)', '(kısmen)'),
    'whole':        ('(всё)', '(all)', '(hamısı)', '(tamamı)'),

    'placeSell':    ('Выставить на продажу', 'Place a sell order', 'Satışa çıxar', 'Satışa çıkar'),
    'placeBuy':     ('Выставить на покупку', 'Place a buy order', 'Alışa çıxar', 'Alışa çıkar'),
    'createBuyHint':('Создай ордер на покупку — цена и объём', 'Create a buy order — price and volume', 'Alış sifarişi yarat — qiymət və həcm', 'Alış emri oluştur — fiyat ve hacim'),
    'creating':     ('Создаю...', 'Creating...', 'Yaradılır...', 'Oluşturuluyor...'),
    'creatingOrder':('Создаю ордер…', 'Creating the order…', 'Sifariş yaradılır…', 'Emir oluşturuluyor…'),
    'reserving':    ('Резервирую ордер...', 'Reserving the order...', 'Sifariş rezerv olunur...', 'Emir rezerve ediliyor...'),
    'reserveFailed':('Не удалось зарезервировать ордер', 'Could not reserve the order', 'Sifarişi rezerv etmək alınmadı', 'Emir rezerve edilemedi'),
    'sellerFound':  ('Продавец найден', 'Seller found', 'Satıcı tapıldı', 'Satıcı bulundu'),
    'sellerWalletMissing': ('Кошелёк продавца не найден, обнови список', 'Seller wallet not found, refresh the list', 'Satıcının pul kisəsi tapılmadı, siyahını yeniləyin', 'Satıcı cüzdanı bulunamadı, listeyi yenileyin'),
    'notEnoughBalance': ('Недостаточно баланса', 'Not enough balance', 'Balans kifayət etmir', 'Bakiye yetersiz'),
    'notEnoughCoinsForOrder': ('Недостаточно монет для этого ордера', 'Not enough coins for this order', 'Bu sifariş üçün sikkə çatmır', 'Bu emir için coin yetersiz'),
    'confirmInWalletShort': ('Подтверди перевод в кошельке', 'Confirm the transfer in your wallet', 'Köçürməni pul kisəsində təsdiqlə', 'Transferi cüzdanınızda onaylayın'),
    'txCancelled':  ('Транзакция отменена', 'Transaction cancelled', 'Əməliyyat ləğv edildi', 'İşlem iptal edildi'),
    'cancel':       ('Отмена', 'Cancel', 'Ləğv et', 'İptal'),

    'labelQuantity':  ('КОЛИЧЕСТВО', 'QUANTITY', 'MİQDAR', 'MİKTAR'),
    'labelMyPrice':   ('МОЯ ЦЕНА (TON за 1М)', 'MY PRICE (TON per 1M)', 'MƏNİM QİYMƏTİM (1M üçün TON)', 'FİYATIM (1M için TON)'),
    'labelPricePerM': ('ЦЕНА (TON за 1 000 000)', 'PRICE (TON per 1,000,000)', 'QİYMƏT (1 000 000 üçün TON)', 'FİYAT (1.000.000 için TON)'),
    'labelWantBuy':   ('ХОЧУ КУПИТЬ', 'I WANT TO BUY', 'ALMAQ İSTƏYİRƏM', 'ALMAK İSTİYORUM'),

    'orderReserved':   ('Ордер зарезервирован', 'Order reserved', 'Sifariş rezerv olundu', 'Emir rezerve edildi'),
    'coinsReceived':   ('Монеты получены', 'Coins received', 'Sikkələr alındı', 'Coinler alındı'),
    'coinsFrozenNote': ('Монеты заморожены. Покупатель оплатит TON на твой кошелёк — тогда сделка закроется. Не оплатит за 30 минут — монеты вернутся.', 'Coins are frozen. The buyer will send TON to your wallet — then the deal closes. No payment within 30 minutes and the coins come back.', 'Sikkələr dondurulub. Alıcı TON-u pul kisənizə göndərəcək — sövdələşmə onda bağlanır. 30 dəqiqə ərzində ödəməsə, sikkələr qayıdır.', 'Coinler donduruldu. Alıcı cüzdanınıza TON gönderecek — işlem o zaman kapanır. 30 dakika içinde ödemezse coinler geri döner.'),
    'creditedToBalance': ('зачислено на баланс', 'credited to balance', 'balansa köçürüldü', 'bakiyeye eklendi'),
}

# ── 1. Дописываем ключи в словарь (ru + en) ──────────────────────────────────
p = 'frontend/src/i18n/translations.ts'
s = io.open(p, encoding='utf-8').read()


def вставить(текст, язык, индекс):
    """Добавить недостающие ключи в блок exchange нужного языка."""
    метки = [m.start() for m in re.finditer(r'^    exchange: \{', текст, re.M)]
    # en идёт первым в файле, ru вторым
    поз = метки[0 if язык == 'en' else 1]
    конец = текст.index('\n    },', поз)
    кусок = текст[поз:конец]
    новые = []
    for ключ, значения in СЛОВАРЬ.items():
        if re.search(r'\b' + ключ + r':', кусок):
            continue
        v = значения[индекс].replace("'", "\\'")
        новые.append("      %s: '%s'," % (ключ, v))
    if not новые:
        return текст, 0
    return текст[:конец] + '\n' + '\n'.join(новые) + текст[конец:], len(новые)


s, n_en = вставить(s, 'en', 1)
s, n_ru = вставить(s, 'ru', 0)
io.open(p, 'w', encoding='utf-8').write(s)
print('в словарь добавлено: en %d, ru %d' % (n_en, n_ru))

# ── 2. SQL для таблицы текстов (все четыре языка) ────────────────────────────
кав = lambda x: "'" + str(x).replace("'", "''") + "'"
строки = ['BEGIN;']
for ключ, (ru, en, az, tr) in СЛОВАРЬ.items():
    строки.append(
        'INSERT INTO ui_texts (key, screen, place, kind, ru, en, az, tr, "updatedAt") VALUES ('
        '%s, \'shop\', \'exchange\', \'label\', %s, %s, %s, %s, now()) '
        'ON CONFLICT (key) DO UPDATE SET ru=EXCLUDED.ru, en=EXCLUDED.en, az=EXCLUDED.az, '
        'tr=EXCLUDED.tr, "updatedAt"=now();'
        % (кав('exchange.' + ключ), кав(ru), кав(en), кав(az), кав(tr)))
строки.append('COMMIT;')
io.open('scripts/_exchange_texts.sql', 'w', encoding='utf-8').write('\n'.join(строки) + '\n')
print('ключей в SQL: %d' % len(СЛОВАРЬ))
