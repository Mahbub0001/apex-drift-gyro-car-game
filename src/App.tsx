import React, { useState, useEffect } from 'react';
import { DesktopHost } from './components/desktop/DesktopHost';
import { MobileController } from './components/controller/MobileController';
import { GameView } from './components/desktop/GameView';
import { GarageView } from './components/desktop/GarageView';
import { SUPER_CARS, SuperCarConfig } from './types';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'desktop' | 'controller'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'controller' || window.location.pathname.includes('/controller')
        ? 'controller'
        : 'desktop';
    }
    return 'desktop';
  });

  const [gameState, setGameState] = useState<'garage' | 'racing'>('racing');
  const [selectedCar, setSelectedCar] = useState<SuperCarConfig>(SUPER_CARS[0]); // Default to RAPTOR

  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) return roomParam.toUpperCase();
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    return 'APEX99';
  });

  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && roomParam.toUpperCase() !== roomId) {
      setRoomId(roomParam.toUpperCase());
    }
  }, [roomId]);

  if (mode === 'controller') {
    return <MobileController roomId={roomId} />;
  }

  if (gameState === 'garage') {
    return (
      <GarageView
        selectedCar={selectedCar}
        onSelectCar={(car) => {
          setSelectedCar(car);
          setGameState('racing');
        }}
        onOpenGyroModal={() => setGameState('racing')}
        isPhoneConnected={isPhoneConnected}
      />
    );
  }

  return (
    <GameView
      roomId={roomId}
      selectedCar={selectedCar}
      onOpenGarage={() => setGameState('garage')}
      onExit={() => setGameState('garage')}
    />
  );
};

export default App;
