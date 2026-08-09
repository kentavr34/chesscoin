# Карта файлов и функций

Снимок от 05.08.2026. Пересобрать одной командой:

```bash
python project_management/tools/deadcode.py --full
```

Файл — **производный**: правится не он, а код. Инструмент ничего не удаляет
и не может; удаление — только с подтверждением Кенана.

```
==========================================================================
                          КАРТА ФАЙЛОВ И ФУНКЦИЙ                          
==========================================================================

── ФРОНТ (frontend/src) ──
   файлов: 99    строк: 28243  
   файлов-сирот: 22   в них строк: 2684   (9.5% слоя)
   запускается снаружи: 0    (тесты, воркеры — не балласт)
   мёртвый экспорт: 99  
   выключенных веток: 8   
      сирота  components/ui/GameSetupModal.tsx                       371 стр.
      сирота  components/game/WaitingForOpponent.tsx                 310 стр.
      сирота  components/game/EventEffects.tsx                       240 стр.
      сирота  components/ui/BattleCard.tsx                           164 стр.
      сирота  lib/chessOpenings.ts                                   150 стр.
      сирота  components/game/MoveAnnouncer.tsx                      146 стр.
      сирота  components/ui/PromptModal.tsx                          136 стр.
      сирота  components/ui/StatBox.tsx                              136 стр.
      сирота  components/exchange/CandleChart.tsx                    130 стр.
      сирота  components/ui/Button.tsx                               111 стр.
      сирота  components/ui/JarvisInfoModal.tsx                      111 стр.
      сирота  lib/styles.ts                                          107 стр.
      сирота  components/ui/Text.tsx                                  95 стр.
      сирота  components/ui/Card.tsx                                  80 стр.
      сирота  components/game/CapturedPieces.tsx                      78 стр.
      сирота  components/game/CoinPopup.tsx                           74 стр.
      сирота  components/ui/Heading.tsx                               72 стр.
      сирота  components/ui/FloatingCoins.tsx                         56 стр.
      сирота  components/ui/EmptyState.tsx                            41 стр.
      сирота  hooks/useBreakpoint.ts                                  40 стр.
      сирота  components/ui/Skeleton.tsx                              34 стр.
      сирота  components/ui/AvatarCropModal.tsx                        2 стр.
      ветка   components/profile/PgnReplayModal.tsx    флаг playing (setPlaying не включает)
      ветка   pages/BattleHistoryPage.tsx              флаг showSort (setShowSort не включает)
      ветка   pages/BattlesPage.tsx                    флаг showHistory (setShowHistory не включает)
      ветка   pages/BattlesPage.tsx                    флаг showQuick (setShowQuick не включает)
      ветка   pages/GamePage.tsx                       флаг showDonateMenu (setShowDonateMenu не включает)
      ветка   pages/LessonLearnPage.tsx                флаг playing (setPlaying не включает)
      ветка   pages/PuzzleDailyPage.tsx                флаг showInfo (setShowInfo не включает)
      ветка   pages/WarsPage.tsx                       флаг isCommander (setIsCommander не включает)

── БЭКЕНД (backend/src) ──
   файлов: 67    строк: 18944  
   файлов-сирот: 0    в них строк: 0      (0.0% слоя)
   запускается снаружи: 12   (тесты, воркеры — не балласт)
   мёртвый экспорт: 72  
   выключенных веток: 0   

--------------------------------------------------------------------------
самопроверка пройдена: живые образцы в сироты не попали
строк в файлах, до которых нельзя дойти от точки входа: 2684

Как читать. «Сирота» — файл, до которого нет пути по импортам: скорее всего
балласт, но сначала проверь, не тянет ли его сборщик по имени (страницы,
воркеры, скрипты). «Мёртвый экспорт» — имя объявлено на вывоз, но никто его
не ввозит; часто это остаток от переезда. «Выключенная ветка» — флаг заведён
со значением «нет», и включить его нечем: ровно так 315 строк панели
TON-кошелька дожили до 05.08.2026, скрывая единственную рабочую отвязку.

Инструмент НИЧЕГО НЕ УДАЛЯЕТ и не может: удаление — только с подтверждением.


```
