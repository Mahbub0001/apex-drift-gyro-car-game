import React, { useState, useEffect, useRef } from 'react';
import { HomeView } from './components/desktop/HomeView';
import { MobileController } from './components/controller/MobileController';
import { GameView } from './components/desktop/GameView';
import { GarageView } from './components/desktop/GarageView';
import { WebRTCHost } from './services/webrtc';
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

  const [gameState, setGameState] = useState<'home' | 'garage' | 'racing'>('home');
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
  const [openMpOnStart, setOpenMpOnStart] = useState<boolean>(false);
  const hostRef = useRef<WebRTCHost | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && roomParam.toUpperCase() !== roomId) {
      setRoomId(roomParam.toUpperCase());
    }
  }, [roomId]);

  // Persistent WebRTC Host: Starts listening on App load so phone pairing works on Home, Garage or Racing
  useEffect(() => {
    if (mode === 'controller') return;

    const host = new WebRTCHost(roomId);
    hostRef.current = host;

    host.init(
      (_input) => {
        // Connected phone sends gyro data
      },
      (connected) => {
        setIsPhoneConnected(connected);
      }
    );

    return () => {
      host.destroy();
      hostRef.current = null;
    };
  }, [mode, roomId]);

  if (mode === 'controller') {
    return <MobileController roomId={roomId} />;
  }

  if (gameState === 'home') {
    return (
      <HomeView
        selectedCar={selectedCar}
        onStartRacing={() => {
          setOpenMpOnStart(false);
          setGameState('racing');
        }}
        onOpenGarage={() => setGameState('garage')}
        onSelectCar={(car) => setSelectedCar(car)}
        roomId={roomId}
        isPhoneConnected={isPhoneConnected}
        onOpenMultiplayer={() => {
          setOpenMpOnStart(true);
          setGameState('racing');
        }}
      />
    );
  }

  if (gameState === 'garage') {
    return (
      <GarageView
        selectedCar={selectedCar}
        onSelectCar={(car) => {
          setSelectedCar(car);
          setGameState('racing');
        }}
        onOpenGyroModal={() => setGameState('home')}
        isPhoneConnected={isPhoneConnected}
        onBackToHome={() => setGameState('home')}
      />
    );
  }

  return (
    <GameView
      roomId={roomId}
      selectedCar={selectedCar}
      onOpenGarage={() => setGameState('garage')}
      onExit={() => {
        setOpenMpOnStart(false);
        setGameState('home');
      }}
      sharedHost={hostRef.current}
      isInitialPhoneConnected={isPhoneConnected}
      initialOpenMultiplayer={openMpOnStart}
    />
  );
};

export default App;
