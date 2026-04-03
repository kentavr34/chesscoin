// frontend/src/pages/GamePage.tsx
// МИНИМАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ — только доска, без бота, без сложных зависимостей

import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function GamePage() {
  const [game, setGame] = useState(new Chess());

  function onDrop(sourceSquare, targetSquare) {
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });
      
      if (move) {
        setGame(gameCopy);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return (
    <div style={{ padding: '20px', background: '#1e1e2e', minHeight: '100vh' }}>
      <h1 style={{ color: 'white', textAlign: 'center' }}>Шахматы ChessCoin</h1>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Chessboard 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardWidth={Math.min(500, window.innerWidth - 40)}
        />
      </div>
      <p style={{ color: 'white', textAlign: 'center', marginTop: '20px' }}>
        Игра: человек против человека
      </p>
    </div>
  );
}
