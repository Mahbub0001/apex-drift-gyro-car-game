import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TrafficCarState, RemotePlayerState } from '../../types';

interface MinimapProps {
  playerPos: THREE.Vector3;
  playerHeading: number;
  splineCurve: THREE.CatmullRomCurve3;
  traffic: TrafficCarState[];
  opponents?: RemotePlayerState[];
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPos,
  playerHeading,
  splineCurve,
  traffic,
  opponents = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Coordinate mapping parameters (Track spans X: -100 to +100, Z: 0 to 1200)
    const mapMinX = -120;
    const mapMaxX = 120;
    const mapMinZ = -20;
    const mapMaxZ = 1250;

    const worldToMap = (x: number, z: number): [number, number] => {
      const normX = (x - mapMinX) / (mapMaxX - mapMinX);
      const normZ = (z - mapMinZ) / (mapMaxZ - mapMinZ);
      // Map X to canvas width with padding, Z to height (inverted: top is finish)
      const mapX = 20 + normX * (width - 40);
      const mapY = height - 20 - normZ * (height - 40);
      return [mapX, mapY];
    };

    // 1. Draw Track Spline Path
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const points = splineCurve.getPoints(80);
    points.forEach((pt, i) => {
      const [mx, my] = worldToMap(pt.x, pt.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.stroke();

    // Inner Glowing Line
    ctx.beginPath();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2;
    points.forEach((pt, i) => {
      const [mx, my] = worldToMap(pt.x, pt.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.stroke();

    // 2. Draw Civilian Traffic Blips
    traffic.forEach((car) => {
      const [cx, cy] = worldToMap(car.position[0], car.position[2]);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb800'; // Amber traffic dot
      ctx.fill();
    });

    // 3. Draw Multiplayer Competitor Blips
    opponents.forEach((opp) => {
      const [ox, oy] = worldToMap(opp.position[0], opp.position[2]);
      ctx.beginPath();
      ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = opp.color || '#a855f7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 4. Draw Player Chevron Indicator
    const [px, py] = worldToMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    // Heading rotation: in 2D canvas, heading 0 is forward (+Z in 3D is up in canvas)
    ctx.rotate(-playerHeading);

    // Glowing Cyan Arrow
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }, [playerPos, playerHeading, splineCurve, traffic, opponents]);

  // Track progress percentage
  const progressPercent = Math.min(100, Math.max(0, Math.round((playerPos.z / 1200) * 100)));

  return (
    <div className="glass-panel p-3 rounded-2xl border border-cyan-500/30 flex flex-col items-center shadow-xl shadow-black/60 pointer-events-auto">
      <div className="flex items-center justify-between w-full text-[10px] uppercase font-bold text-gray-400 mb-1 px-1">
        <span>RADAR MAP</span>
        <span className="text-cyan-400 font-mono">{progressPercent}%</span>
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={220}
        className="w-28 h-44 rounded-xl bg-black/40 border border-white/5"
      />
    </div>
  );
};
