import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HomeView } from './components/desktop/HomeView';
import { MobileController } from './components/controller/MobileController';
import { GameView } from './components/desktop/GameView';
import { GarageView } from './components/desktop/GarageView';
import { WebRTCHost } from './services/webrtc';
import { SUPER_CARS, SuperCarConfig, GameSettings, DEFAULT_GAME_SETTINGS } from './types';
import { isMobileDevice } from './utils/device';

const SETTINGS_STORAGE_KEY = 'apex_drift_settings_v1';

function loadSavedSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_GAME_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export const App: React.FC = () => {
  const [mode, setMode] = useState<'desktop' | 'controller' | 'mobile_game'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (
        urlParams.get('mode') === 'controller' ||
        window.location.pathname.includes('/controller')
      ) {
        return 'controller';
      }
      if (urlParams.get('mode') === 'desktop') {
        return 'desktop';
      }
      if (urlParams.get('mode') === 'game') {
        return 'mobile_game';
      }
      if (isMobileDevice()) {
        return 'mobile_game';
      }
    }
    return 'desktop';
  });

  const [gameState, setGameState] = useState<'home' | 'garage' | 'racing'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mp')) {
        return 'racing';
      }
      if (isMobileDevice() && urlParams.get('mode') !== 'desktop') {
        return 'racing';
      }
    }
    return 'home';
  });

  const [selectedCar, setSelectedCar] = useState<SuperCarConfig>(SUPER_CARS[0]);
  const [settings, setSettings] = useState<GameSettings>(loadSavedSettings);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) return roomParam.toUpperCase();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      if (window.crypto?.getRandomValues) {
        const bytes = new Uint8Array(6);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => chars[b % chars.length]).join('');
      }
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    return 'APEX99';
  });

  const [isPhoneConnected, setIsPhoneConnected] = useState<boolean>(false);
  const [openMpOnStart, setOpenMpOnStart] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!new URLSearchParams(window.location.search).get('mp');
    }
    return false;
  });
  const hostRef = useRef<WebRTCHost | null>(null);
  const [sharedHost, setSharedHost] = useState<WebRTCHost | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && roomParam.toUpperCase() !== roomId) {
      setRoomId(roomParam.toUpperCase());
    }
  }, [roomId]);

  // Initialize Persistent WebRTC Host ONLY in Desktop Host mode (prevents PeerJS ID collisions!)
  useEffect(() => {
    if (mode !== 'desktop') return;

    const host = new WebRTCHost(roomId);
    hostRef.current = host;
    setSharedHost(host);

    host.init(
      (_input) => {
        // Active callback is attached when GameView mounts
      },
      (connected) => {
        setIsPhoneConnected(connected);
      }
    );

    return () => {
      host.destroy();
      hostRef.current = null;
      setSharedHost(null);
    };
  }, [mode, roomId]);

  // 1. Phone Controller Gamepad Mode
  if (mode === 'controller') {
    return <MobileController roomId={roomId} />;
  }

  // 2. Direct Mobile Game Mode
  if (mode === 'mobile_game') {
    if (gameState === 'garage') {
      return (
        <GarageView
          selectedCar={selectedCar}
          onSelectCar={(car) => {
            setSelectedCar(car);
            setGameState('racing');
          }}
          isPhoneConnected={false}
          isMobileMode={true}
          onBackToHome={() => setGameState('racing')}
        />
      );
    }

    return (
      <GameView
        roomId={roomId}
        selectedCar={selectedCar}
        onOpenGarage={() => setGameState('garage')}
        onExit={() => setGameState('racing')}
        sharedHost={null}
        isInitialPhoneConnected={false}
        initialOpenMultiplayer={openMpOnStart}
        isMobileMode={true}
        settings={settings}
        onUpdateSettings={updateSettings}
        onSwitchToController={() => setMode('controller')}
      />
    );
  }

  // 3. Desktop Mode
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
        settings={settings}
        onUpdateSettings={updateSettings}
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
      sharedHost={sharedHost}
      isInitialPhoneConnected={isPhoneConnected}
      initialOpenMultiplayer={openMpOnStart}
      isMobileMode={false}
      settings={settings}
      onUpdateSettings={updateSettings}
    />
  );
};

export default App;
