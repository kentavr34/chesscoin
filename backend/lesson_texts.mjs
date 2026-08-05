// Тексты уроков 121–300 на четырёх языках.
//
// Договорённость та же, что и в блоках 1–120:
//   lessons.theme.<блок>.explain — объяснение приёма, одно на блок;
//   lessons.item.<N>.title       — «<Название приёма> · <номер в блоке>».
//
// Объяснение пишется как объясняет тренер: сначала что видно на доске, потом
// почему это работает, в конце — на что смотреть в своей партии. Без «данный
// приём заключается в том, что».
export const БЛОКИ = {
  arabian: {
    name: { ru: 'Арабский мат', en: 'Arabian mate', az: 'Ərəb matı', tr: 'Arap matı' },
    explain: {
      ru: 'Ладья и конь ставят мат королю в углу: конь отнимает поля, ладья бьёт по последней линии, и уйти некуда. Рисунку тысяча лет, отсюда и имя. Узнав его один раз, вы будете видеть его в своих партиях.',
      en: 'Rook and knight mate a king in the corner: the knight takes the escape squares, the rook strikes along the back line, and there is nowhere to go. The pattern is a thousand years old — hence the name. Learn it once and you will start seeing it in your own games.',
      az: 'Top və at küncdəki şaha mat edir: at xanaları alır, top son xətt üzrə vurur və qaçmağa yer qalmır. Şəklin min ili var, adı da buradandır. Bir dəfə tanısanız, öz partiyalarınızda görməyə başlayacaqsınız.',
      tr: 'Kale ve at köşedeki şahı mat eder: at kaçış karelerini alır, kale son hattan vurur ve gidecek yer kalmaz. Desen bin yıllıktır, adı da buradan gelir. Bir kez tanıyınca kendi oyunlarınızda görmeye başlarsınız.',
    },
  },
  anastasia: {
    name: { ru: 'Мат Анастасии', en: 'Anastasia mate', az: 'Anastasiya matı', tr: 'Anastasia matı' },
    explain: {
      ru: 'Конь встаёт рядом с королём и отнимает у него поля, а ладья входит по вертикали сбоку — король зажат между своей пешкой и краем доски. Часто перед этим жертвуют ферзя, чтобы вскрыть нужную линию.',
      en: 'The knight settles next to the king and takes its squares, while the rook comes in on the file from the side — the king is squeezed between its own pawn and the edge. Often a queen is sacrificed first to open the file needed.',
      az: 'At şahın yanında dayanıb xanalarını alır, top isə yandan şaquli üzrə girir — şah öz piyadası ilə lövhənin kənarı arasında sıxılır. Tez-tez lazımi xətti açmaq üçün əvvəlcə vəzir qurban verilir.',
      tr: 'At şahın yanına yerleşip karelerini alır, kale ise yandan dikey hattan girer — şah kendi piyonu ile tahtanın kenarı arasında sıkışır. Gereken hattı açmak için önce çoğu zaman vezir feda edilir.',
    },
  },
  attraction: {
    name: { ru: 'Завлечение', en: 'Attraction', az: 'Cəlbetmə', tr: 'Çekme' },
    explain: {
      ru: 'Фигуру соперника заставляют встать на нужное поле — обычно жертвой, от которой нельзя отказаться. Король выходит под шах, ферзь попадает на вилку, ладья перекрывает своим же. Ищите жертву не там, где выгодно вам, а там, где сопернику НЕЧЕМ ответить, кроме взятия.',
      en: 'You force an enemy piece onto the square you need — usually with a sacrifice it cannot decline. The king steps into check, the queen lands on a fork, the rook blocks its own defender. Look for the sacrifice not where it profits you, but where the opponent has no reply except taking.',
      az: 'Rəqibin fiquru lazım olan xanaya çıxmağa məcbur edilir — adətən imtina edilə bilməyən qurbanla. Şah şaha düşür, vəzir çəngələ keçir, top öz müdafiəçisini bağlayır. Qurbanı sizə sərfəli olan yerdə yox, rəqibin götürməkdən başqa cavabı olmayan yerdə axtarın.',
      tr: 'Rakip taşı ihtiyacınız olan kareye zorlanır — genellikle reddedilemeyecek bir fedayla. Şah şah çekilen kareye çıkar, vezir çatala düşer, kale kendi savunucusunu kapatır. Fedayı size kâr getiren yerde değil, rakibin almaktan başka cevabı olmadığı yerde arayın.',
    },
  },
  clearance: {
    name: { ru: 'Освобождение поля', en: 'Clearance', az: 'Xananın boşaldılması', tr: 'Kare açma' },
    explain: {
      ru: 'Своя же фигура стоит на дороге — и её убирают с темпом, часто отдавая. Освободившаяся линия или поле решает партию за один ход. Признак: у вас есть красивый удар, который «почти проходит», и мешает ему собственная фигура.',
      en: 'Your own piece is in the way — so you move it with tempo, often giving it up. The freed line or square decides the game in one move. The clue: you have a beautiful blow that "almost works", and what stops it is a piece of your own.',
      az: 'Öz fiqurunuz yolu bağlayır — və o, tempo ilə kənara çəkilir, tez-tez verilir. Açılan xətt və ya xana partiyanı bir gedişdə həll edir. Əlamət: gözəl zərbəniz var, o «az qala alınır», amma öz fiqurunuz mane olur.',
      tr: 'Kendi taşınız yolu kapatıyor — onu tempoyla çekersiniz, çoğu zaman feda ederek. Açılan hat ya da kare oyunu tek hamlede bitirir. İpucu: "neredeyse işleyen" güzel bir vuruşunuz var ve engel kendi taşınız.',
    },
  },
  interference: {
    name: { ru: 'Перекрытие', en: 'Interference', az: 'Kəsmə', tr: 'Araya girme' },
    explain: {
      ru: 'Между защитником и тем, что он защищает, ставят фигуру — и связь рвётся. Ладья больше не держит поле, слон не смотрит на пункт. Ход часто выглядит нелепо: фигура становится под бой. Смотрите на ЛИНИИ соперника, а не на его фигуры.',
      en: 'A piece is planted between the defender and what it defends — and the link breaks. The rook no longer holds the square, the bishop no longer eyes the point. The move often looks absurd: the piece steps into capture. Watch the opponent LINES, not the pieces.',
      az: 'Müdafiəçi ilə müdafiə etdiyi arasında fiqur qoyulur — və əlaqə qırılır. Top artıq xananı tutmur, fil nöqtəyə baxmır. Gediş çox vaxt absurd görünür: fiqur zərbə altına girir. Rəqibin FİQURLARINA yox, XƏTLƏRİNƏ baxın.',
      tr: 'Savunucu ile savunduğu şey arasına bir taş konur — bağ kopar. Kale artık kareyi tutmaz, fil noktaya bakmaz. Hamle çoğu zaman saçma görünür: taş alınmaya girer. Rakibin taşlarına değil, HATLARINA bakın.',
    },
  },
  trapped: {
    name: { ru: 'Ловля фигуры', en: 'Trapped piece', az: 'Fiqurun tutulması', tr: 'Taş kapanı' },
    explain: {
      ru: 'Фигура забралась глубоко или зашла за материалом — и остаётся без ходов. Её не бьют, её запирают: отнимают поля одно за другим. Чаще всего попадаются слон, съевший пешку на краю, и ферзь, ушедший в набег.',
      en: 'A piece has gone too deep or grabbed material — and runs out of squares. You do not capture it, you lock it in: take away its squares one by one. The usual victims are a bishop that ate a wing pawn and a queen that went raiding.',
      az: 'Fiqur çox dərinə girib və ya material götürüb — və gedişsiz qalır. Onu vurmurlar, bağlayırlar: xanaları bir-bir alırlar. Ən çox kənar piyadanı yeyən fil və basqına çıxan vəzir tutulur.',
      tr: 'Bir taş fazla derine gitti ya da malzeme kaptı — ve karesiz kalır. Onu almazsınız, hapsedersiniz: karelerini tek tek alırsınız. En sık kurbanlar kanat piyonunu yiyen fil ve akına çıkan vezirdir.',
    },
  },
  doublecheck: {
    name: { ru: 'Двойной шах', en: 'Double check', az: 'İkiqat şah', tr: 'Çifte şah' },
    explain: {
      ru: 'Шах объявляют сразу две фигуры — закрыться или взять невозможно, король ОБЯЗАН идти. Поэтому двойной шах сильнее любого материала: под ним не считают, кто сколько отдал. Ищите вскрытие, при котором и уходящая фигура тоже даёт шах.',
      en: 'Two pieces give check at once — you cannot block and cannot capture, the king MUST move. That is why a double check beats any material count: under it, nobody cares what was given up. Look for a discovery where the departing piece also checks.',
      az: 'Şahı eyni anda iki fiqur elan edir — bağlamaq və götürmək mümkün deyil, şah GETMƏYƏ məcburdur. Buna görə ikiqat şah istənilən materialdan güclüdür. Açılan zaman gedən fiqurun da şah verdiyi variantı axtarın.',
      tr: 'Şahı aynı anda iki taş çeker — kapatmak da almak da olmaz, şah GİTMEK zorundadır. Bu yüzden çifte şah her türlü malzemeden güçlüdür. Açılırken giden taşın da şah çektiği varyantı arayın.',
    },
  },
  intermezzo: {
    name: { ru: 'Промежуточный ход', en: 'In-between move', az: 'Aralıq gediş', tr: 'Ara hamle' },
    explain: {
      ru: 'Вместо очевидного взятия сначала делают ход с угрозой посильнее — шах или нападение, — и только потом забирают. Соперник вынужден отвечать, а размен никуда не убежал. Правило: прежде чем брать обратно, спросите себя, нет ли хода злее.',
      en: 'Instead of the obvious recapture you first make a move with a bigger threat — a check or an attack — and only then take. The opponent has to answer, and the exchange is not going anywhere. Rule: before recapturing, ask whether there is a nastier move.',
      az: 'Aydın götürmə əvəzinə əvvəlcə daha güclü hədə ilə gediş edilir — şah və ya hücum, — sonra götürülür. Rəqib cavab verməyə məcburdur, mübadilə isə heç yerə qaçmır. Qayda: geri götürməzdən əvvəl daha sərt gediş olub-olmadığını soruşun.',
      tr: 'Bariz geri almak yerine önce daha büyük tehdit içeren bir hamle yapılır — şah ya da saldırı — ve ancak sonra alınır. Rakip cevap vermek zorunda, değişim ise kaçmıyor. Kural: geri almadan önce daha sert bir hamle var mı diye sorun.',
    },
  },
  kingattack: {
    name: { ru: 'Атака на короля', en: 'Attack on the king', az: 'Şaha hücum', tr: 'Şaha saldırı' },
    explain: {
      ru: 'Король соперника укрыт рокировкой, но прикрытие можно снести. Считают не фигуры, а темпы: каждый ход обязан быть с угрозой, иначе соперник успеет подтянуть защиту. Начинают с той фигуры, которая ближе всех к королю и стоит дешевле всех.',
      en: 'The enemy king sits behind a castled shelter — but the shelter can be torn down. You count tempi, not pieces: every move must carry a threat, otherwise the defence arrives in time. Start with the piece that is closest to the king and cheapest.',
      az: 'Rəqibin şahı rokirovka arxasındadır, amma örtüyü dağıtmaq olar. Fiqurlar yox, tempolar sayılır: hər gediş hədə daşımalıdır, yoxsa rəqib müdafiəni çəkməyə macal tapar. Şaha ən yaxın və ən ucuz fiqurdan başlayın.',
      tr: 'Rakip şah rok arkasında duruyor ama siper yıkılabilir. Taş değil, tempo sayılır: her hamle bir tehdit taşımalı, yoksa savunma yetişir. Şaha en yakın ve en ucuz taştan başlayın.',
    },
  },
  sacrifice: {
    name: { ru: 'Жертва', en: 'Sacrifice', az: 'Qurban', tr: 'Feda' },
    explain: {
      ru: 'Отдают материал, чтобы получить то, что дороже: мат, вскрытую линию, проходную. Жертва считается до конца — иначе это подарок. Если после отдачи вы не видите форсированной цепочки до выигрыша, значит, жертвы нет.',
      en: 'You give material to get something worth more: mate, an open line, a passed pawn. A sacrifice is calculated to the end — otherwise it is a gift. If after giving it up you cannot see a forced chain to the win, then there is no sacrifice.',
      az: 'Daha dəyərlisini almaq üçün material verilir: mat, açılmış xətt, keçici piyada. Qurban sona qədər hesablanır — əks halda bu hədiyyədir. Verdikdən sonra qələbəyə qədər məcburi zəncir görmürsünüzsə, qurban yoxdur.',
      tr: 'Daha değerlisini almak için malzeme verilir: mat, açık hat, geçer piyon. Feda sonuna kadar hesaplanır — yoksa hediyedir. Verdikten sonra kazanca giden zorunlu zinciri göremiyorsanız, feda yok demektir.',
    },
  },
  exposedking: {
    name: { ru: 'Открытый король', en: 'Exposed king', az: 'Açıq şah', tr: 'Açıkta kalan şah' },
    explain: {
      ru: 'Король остался без прикрытия — в центре или с разрушенными пешками. Пока он открыт, материал вторичен: важнее подключить каждую фигуру к охоте. Ищите шахи и угрозы, которые ГОНЯТ короля, а не просто беспокоят его.',
      en: 'The king is left without cover — in the centre or with a broken pawn shield. While it is exposed, material is secondary: what matters is bringing every piece into the hunt. Look for checks and threats that DRIVE the king, not merely annoy it.',
      az: 'Şah örtüksüz qalıb — mərkəzdə və ya piyada divarı dağılmış halda. O açıq olduqca material ikinci dərəcəlidir: hər fiquru ova qoşmaq vacibdir. Şahı sadəcə narahat edən yox, QOVAN şahları və hədələri axtarın.',
      tr: 'Şah siperini kaybetti — merkezde ya da piyon duvarı yıkılmış halde. Açıktayken malzeme ikincildir: her taşı ava katmak önemlidir. Şahı sadece rahatsız eden değil, KOVALAYAN şahları ve tehditleri arayın.',
    },
  },
  quietmove: {
    name: { ru: 'Тихий ход', en: 'Quiet move', az: 'Sakit gediş', tr: 'Sessiz hamle' },
    explain: {
      ru: 'Самый сильный ход бывает без шаха и без взятия. Он просто отнимает у короля последнее поле, или ставит фигуру так, что защититься уже нечем. Такие ходы труднее всего найти: глаз ищет удар, а решает тишина.',
      en: 'The strongest move is often neither a check nor a capture. It simply takes the king last square, or places a piece so that no defence remains. These are the hardest to find: the eye hunts for a blow, while silence decides.',
      az: 'Ən güclü gediş çox vaxt nə şah, nə götürmədir. O sadəcə şahın son xanasını alır və ya fiquru elə qoyur ki, müdafiə qalmır. Belə gedişləri tapmaq ən çətinidir: göz zərbə axtarır, həll isə sükutdadır.',
      tr: 'En güçlü hamle çoğu zaman ne şah ne de alıştır. Sadece şahın son karesini alır ya da taşı savunma kalmayacak şekilde koyar. Bunları bulmak en zorudur: göz vuruş arar, kararı sessizlik verir.',
    },
  },
  zugzwang: {
    name: { ru: 'Цугцванг', en: 'Zugzwang', az: 'Sıxışdırma', tr: 'Zugzwang' },
    explain: {
      ru: 'Позиция держится, пока не надо ходить — но ходить обязан. Любой ход портит: король уступает поле, пешка отдаёт пункт. Приём окончаний: не улучшайте свою позицию, отнимайте ходы у чужой.',
      en: 'The position holds as long as nobody has to move — but move you must. Every move spoils something: the king gives up a square, a pawn concedes a point. An endgame device: do not improve your position, take away the opponent moves.',
      az: 'Mövqe gediş etmək lazım olmayana qədər dayanır — amma gediş etmək məcburidir. Hər gediş zərər verir: şah xananı güzəştə gedir, piyada nöqtəni verir. Sonluq üsulu: öz mövqeyinizi yaxşılaşdırmayın, rəqibin gedişlərini alın.',
      tr: 'Konum kimse oynamak zorunda değilken durur — ama oynamak zorundasınız. Her hamle bir şeyi bozar: şah kare verir, piyon nokta bırakır. Bir final tekniği: kendi konumunuzu iyileştirmeyin, rakibin hamlelerini alın.',
    },
  },
  defender: {
    name: { ru: 'Снятие защитника', en: 'Removing the defender', az: 'Müdafiəçinin götürülməsi', tr: 'Savunucuyu kaldırma' },
    explain: {
      ru: 'Пункт держится одной фигурой — уберите её, и всё рушится. Защитника бьют, отгоняют или отвлекают. Прежде чем считать длинные варианты, посмотрите: КТО именно держит то поле, куда вы хотите попасть.',
      en: 'A point is held by a single piece — remove it and everything collapses. The defender is captured, chased away or diverted. Before calculating long lines, look: WHO exactly holds the square you want to reach.',
      az: 'Nöqtəni bir fiqur saxlayır — onu götürün, hər şey dağılır. Müdafiəçini vururlar, qovurlar və ya yayındırırlar. Uzun variantları hesablamazdan əvvəl baxın: getmək istədiyiniz xananı məhz KİM saxlayır.',
      tr: 'Bir noktayı tek taş tutar — onu kaldırın, her şey çöker. Savunucu alınır, kovulur ya da saptırılır. Uzun varyantları hesaplamadan önce bakın: gitmek istediğiniz kareyi tam olarak KİM tutuyor.',
    },
  },
  xray: {
    name: { ru: 'Рентген', en: 'X-ray', az: 'Rentgen', tr: 'Röntgen' },
    explain: {
      ru: 'Дальнобойная фигура смотрит на цель СКВОЗЬ другую фигуру. Пока проход закрыт, угрозы не видно — но стоит фигуре в середине сдвинуться, и удар готов. Смотрите на линии ферзя, ладьи и слона до конца доски, а не до первой преграды.',
      en: 'A long-range piece eyes the target THROUGH another piece. While the path is blocked the threat is invisible — but the moment the piece in the middle moves, the blow is ready. Follow queen, rook and bishop lines to the edge of the board, not to the first obstacle.',
      az: 'Uzaqvuran fiqur hədəfə başqa fiqurun İÇİNDƏN baxır. Yol bağlı olduqca hədə görünmür — amma ortadakı fiqur tərpənən kimi zərbə hazırdır. Vəzir, top və filin xətlərini ilk maneəyə qədər yox, lövhənin sonuna qədər izləyin.',
      tr: 'Uzun menzilli taş hedefe başka bir taşın İÇİNDEN bakar. Yol kapalıyken tehdit görünmez — ama ortadaki taş kımıldadığı anda vuruş hazırdır. Vezir, kale ve fil hatlarını ilk engele kadar değil, tahtanın sonuna kadar izleyin.',
    },
  },
  backrank: {
    name: { ru: 'Мат по последней горизонтали', en: 'Back-rank mate', az: 'Son üfüqi üzrə mat', tr: 'Son yatay matı' },
    explain: {
      ru: 'Король заперт собственными пешками, и ладья или ферзь входят на последнюю горизонталь. Смертельно именно потому, что выглядит безобидно: пешки же защищают. Привычка сильного игрока — заранее делать «форточку».',
      en: 'The king is shut in by its own pawns, and a rook or queen lands on the back rank. It is deadly precisely because it looks harmless — the pawns are protecting, after all. A strong player habit: make luft in advance.',
      az: 'Şah öz piyadaları ilə bağlanıb və top və ya vəzir son üfüqiyə girir. Məhz zərərsiz göründüyü üçün ölümcüldür: axı piyadalar qoruyur. Güclü oyunçunun vərdişi — əvvəlcədən «pəncərə» açmaq.',
      tr: 'Şah kendi piyonlarıyla kapanmıştır ve kale ya da vezir son yatayına iner. Zararsız göründüğü için tam da ölümcüldür: piyonlar koruyor sonuçta. Güçlü oyuncunun alışkanlığı — önceden hava deliği açmak.',
    },
  },
  smothered: {
    name: { ru: 'Спёртый мат', en: 'Smothered mate', az: 'Boğulmuş mat', tr: 'Boğma mat' },
    explain: {
      ru: 'Король окружён своими же фигурами, и конь ставит мат — закрыться нечем, конь через фигуры перепрыгивает. Классический рисунок: шах ферзём, король в угол, ферзь жертвуется на поле рядом, конь заканчивает.',
      en: 'The king is boxed in by its own pieces, and a knight delivers mate — nothing can block, the knight jumps over. The classic pattern: queen check, king to the corner, queen sacrifices next to it, knight finishes.',
      az: 'Şah öz fiqurları ilə əhatələnib və at mat edir — bağlamaq mümkün deyil, at fiqurların üstündən tullanır. Klassik şəkil: vəzirlə şah, şah küncə, vəzir yanındakı xanada qurban, at tamamlayır.',
      tr: 'Şah kendi taşlarıyla kuşatılmıştır ve at mat eder — kapatacak bir şey yok, at üzerinden atlar. Klasik desen: vezirle şah, şah köşeye, vezir yanındaki karede feda, atı bitirir.',
    },
  },
  matein2: {
    name: { ru: 'Мат в 2 хода', en: 'Mate in 2', az: '2 gedişə mat', tr: '2 hamlede mat' },
    explain: {
      ru: 'Два хода — и партия кончена, но перебирать наугад бесполезно. Сначала смотрят, куда королю ВООБЩЕ можно уйти, потом ищут ход, который отнимает эти поля. Часто первый ход не шах, а именно отнятие полей.',
      en: 'Two moves and the game is over — but guessing at random is useless. First see where the king CAN go at all, then find the move that takes those squares away. Often the first move is not a check but exactly that removal of squares.',
      az: 'İki gediş — və partiya bitir, amma təsadüfi axtarmaq faydasızdır. Əvvəlcə şahın ÜMUMİYYƏTLƏ hara gedə biləcəyinə baxın, sonra bu xanaları alan gedişi tapın. Çox vaxt ilk gediş şah yox, məhz xanaların alınmasıdır.',
      tr: 'İki hamle ve oyun biter — ama rastgele denemek işe yaramaz. Önce şahın nereye gidebildiğine bakın, sonra o kareleri alan hamleyi bulun. İlk hamle çoğu zaman şah değil, tam da o kare almasıdır.',
    },
  },
  matein3: {
    name: { ru: 'Мат в 3 хода', en: 'Mate in 3', az: '3 gedişə mat', tr: '3 hamlede mat' },
    explain: {
      ru: 'Три хода держать в голове труднее, поэтому считают не ходы, а КАРТИНУ мата: где будет стоять король и какие фигуры его добьют. Определив картину, ищут путь к ней — так вариант складывается сам.',
      en: 'Three moves are harder to hold in the head, so you calculate not moves but the mating PICTURE: where the king will stand and which pieces finish it. Once the picture is fixed, you look for the road to it — and the line assembles itself.',
      az: 'Üç gedişi başda saxlamaq çətindir, ona görə gedişləri yox, matın ŞƏKLİNİ hesablayırlar: şah harada duracaq və hansı fiqurlar onu bitirəcək. Şəkil müəyyən olunanda ona gedən yol axtarılır — variant özü yığılır.',
      tr: 'Üç hamleyi akılda tutmak zordur, bu yüzden hamleleri değil mat RESMİNİ hesaplarsınız: şah nerede duracak ve hangi taşlar bitirecek. Resim belirlenince ona giden yol aranır — varyant kendiliğinden kurulur.',
    },
  },
  queenend: {
    name: { ru: 'Ферзевое окончание', en: 'Queen endgame', az: 'Vəzir sonluğu', tr: 'Vezir finali' },
    explain: {
      ru: 'Ферзь один стоит целой армии, поэтому здесь всё решают шахи и проходные. Главная забота — прикрыть своего короля: без укрытия соперник даст вечный шах и спасётся. Считайте, куда пойдёт ваш король, ещё до того, как двинете пешку.',
      en: 'A queen alone is worth an army, so checks and passed pawns decide everything. Your main worry is shelter for your own king: without it the opponent gives perpetual check and escapes. Work out where your king goes before you push the pawn.',
      az: 'Vəzir tək başına bütöv orduya dəyər, ona görə burada şahlar və keçici piyadalar həll edir. Əsas qayğı — öz şahını qorumaq: sığınacaq olmasa rəqib əbədi şah verib xilas olacaq. Piyadanı sürməzdən əvvəl şahınızın hara gedəcəyini hesablayın.',
      tr: 'Vezir tek başına bir orduya bedeldir, bu yüzden burada şahlar ve geçer piyonlar karar verir. Asıl derdiniz kendi şahınıza siper bulmak: sipersiz rakip ebedi şah verip kurtulur. Piyonu itmeden önce şahınızın nereye gideceğini hesaplayın.',
    },
  },
};
