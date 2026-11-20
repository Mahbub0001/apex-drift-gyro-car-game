import React, { useState, useEffect } from 'react';
import { DesktopHost } from './components/desktop/DesktopHost';
import { MobileController } from './components/controller/MobileController';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'desktop' | 'controller'>('desktop');
  const [roomId, setRoomId] = useState<string>('APEX99');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    const roomParam = urlParams.get('room');

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
    } else {
      // Default generated room code if not provided
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

  return (
    <div className="min-h-screen bg-[#08090C] flex flex-col justify-center items-center p-4">
      <DesktopHost roomId={roomId} onLaunchGame={() => alert('Launching High-Speed Autumn Highway...')} />
    </div>
  );
};

export default App;
