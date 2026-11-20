import React, { useState, useEffect } from 'react';
import { DesktopHost } from './components/desktop/DesktopHost';
import { MobileController } from './components/controller/MobileController';
import { GameView } from './components/desktop/GameView';
import { GarageView } from './components/desktop/GarageView';
import { SUPER_CARS, SuperCarConfig } from './types';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'desktop' | 'controller'>('desktop');
  const [gameState, setGameState] = useState<'garage' | 'racing'>('racing');
  const [selectedCar, setSelectedCar] = useState<SuperCarConfig>(SUPER_CARS[0]); // Default to RAPTOR
  const [roomId, setRoomId] = useState<string>('APEX99');
  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const roomParam = urlParams.get('room');

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
    } else {
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(randomCode);
    }

    if (modeParam === 'controller' || window.location.pathname.includes('/controller')) {
      setMode('controller');
    } else {
      setMode('desktop');
    }
  }, []);

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
