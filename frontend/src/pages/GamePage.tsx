// frontend/src/pages/GamePage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { Button, Card, Text, Group, Badge, Stack } from '@mantine/core';

// Простой бот: делает случайный легальный ход
const makeRandomMove = (game: Chess): Chess | null => {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * moves.length);
  const randomMove = moves[randomIndex];
  
  const newGame = new Chess(game.fen());
  newGame.move({
    from: randomMove.from,
    to: randomMove.to,
    promotion: randomMove.promotion,
  });
  return newGame;
};

const GamePage: React.FC = () => {
  const [game, setGame] = useState(new Chess());
  const [isPlayerTurn, setIsPlayerTurn] = useState(true); // true = человек, false = бот
  const [gameMode, setGameMode] = useState<'pvp' | 'pve'>('pve'); // pve = против бота
  const [status, setStatus] = useState('Ваш ход');

  // Обновление статуса игры
  const updateGameStatus = useCallback((currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      const loser = currentGame.turn() === 'w' ? 'Белые' : 'Черные';
      setStatus(`Мат! Победили ${loser === 'Белые' ? 'Черные' : 'Белые'}.`);
      setIsPlayerTurn(false);
    } else if (currentGame.isCheck()) {
      setStatus(`Шах! Ходят ${currentGame.turn() === 'w' ? 'белые' : 'черные'}.`);
    } else if (currentGame.isDraw()) {
      setStatus('Ничья!');
      setIsPlayerTurn(false);
    } else {
      setStatus(`Ходят ${currentGame.turn() === 'w' ? 'белые' : 'черные'}.`);
    }
  }, []);

  // Обработка хода человека
  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      if (!isPlayerTurn && gameMode === 'pve') {
        setStatus('Сейчас ходит бот, подождите...');
        return false;
      }

      try {
        const move = {
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q', // Всегда ферзь для простоты
        };
        
        const gameCopy = new Chess(game.fen());
        const result = gameCopy.move(move);
        
        if (result) {
          setGame(gameCopy);
          updateGameStatus(gameCopy);
          
          // Если игра не закончена и мы играем против бота, передаем ход боту
          if (gameMode === 'pve' && !gameCopy.isGameOver()) {
            setIsPlayerTurn(false);
            setStatus('Бот думает...');
            
            // Ход бота с задержкой 0.3 секунды
            setTimeout(() => {
              const newGameAfterBot = makeRandomMove(gameCopy);
              if (newGameAfterBot) {
                setGame(newGameAfterBot);
                updateGameStatus(newGameAfterBot);
                setIsPlayerTurn(!newGameAfterBot.isGameOver());
                if (!newGameAfterBot.isGameOver()) {
                  setStatus(`Ходят ${newGameAfterBot.turn() === 'w' ? 'белые' : 'черные'}.`);
                }
              } else {
                // Если бот не может сходить (мат или пат), просто возвращаем управление
                setIsPlayerTurn(true);
                updateGameStatus(gameCopy);
              }
            }, 300);
          }
          return true;
        }
        return false;
      } catch (error) {
        console.error('Ошибка хода:', error);
        return false;
      }
    },
    [game, isPlayerTurn, gameMode, updateGameStatus]
  );

  // Новая игра
  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setIsPlayerTurn(true);
    updateGameStatus(newGame);
  };

  // Сменить режим
  const toggleMode = () => {
    const newMode = gameMode === 'pvp' ? 'pve' : 'pvp';
    setGameMode(newMode);
    resetGame();
  };

  // Эффект для начальной установки статуса
  useEffect(() => {
    updateGameStatus(game);
  }, [game, updateGameStatus]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a2a3a 0%, #0d1b2a 100%)',
      padding: '20px'
    }}>
      <Card 
        shadow="xl" 
        radius="md" 
        padding="lg"
        style={{ 
          maxWidth: '700px', 
          width: '100%',
          backgroundColor: 'rgba(30, 40, 50, 0.9)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Badge size="lg" color={gameMode === 'pve' ? 'violet' : 'blue'}>
              {gameMode === 'pve' ? '🤖 Против бота' : '👥 Два игрока'}
            </Badge>
            <Text size="sm" c="dimmed">
              Шахматы • ChessCoin
            </Text>
          </Group>
          
          <div style={{ 
            backgroundColor: '#2c3e2f', 
            borderRadius: '8px',
            padding: '10px'
          }}>
            <Chessboard 
              position={game.fen()} 
              onPieceDrop={onDrop}
              boardWidth={Math.min(600, window.innerWidth - 80)}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 20px 30px rgba(0,0,0,0.3)'
              }}
            />
          </div>
          
          <Card withBorder bg="dark.7" padding="sm">
            <Text ta="center" fw={700} size="lg" c={status.includes('Шах') ? 'yellow.5' : 'white'}>
              {status}
            </Text>
          </Card>
          
          <Group grow>
            <Button 
              onClick={resetGame} 
              variant="gradient" 
              gradient={{ from: 'teal', to: 'lime', deg: 90 }}
              size="md"
            >
              🔄 Новая игра
            </Button>
            <Button 
              onClick={toggleMode} 
              variant="light" 
              color={gameMode === 'pve' ? 'blue' : 'violet'}
              size="md"
            >
              {gameMode === 'pve' ? '👥 Режим 2 игроков' : '🤖 Против бота'}
            </Button>
          </Group>
          
          <Text size="xs" c="dimmed" ta="center">
            {gameMode === 'pve' 
              ? 'Бот играет случайные ходы (уровень для новичков)' 
              : 'Передавайте телефон другу или играйте на одном устройстве'}
          </Text>
        </Stack>
      </Card>
    </div>
  );
};

export default GamePage;
