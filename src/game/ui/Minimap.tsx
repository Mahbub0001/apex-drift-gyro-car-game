import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TrafficCarState, RemotePlayerState } from '../../types';

interface MinimapProps {
  playerPos: THREE.Vector3;
  playerHeading: number;
  splineCurve: THREE.CatmullRomCurve3;
  traffic: TrafficCarState[];
  opponents?: RemotePlayerState[];
  isMobile?: boolean;
  standalone?: boolean;
  className?: string;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPos,
  playerHeading,
  splineCurve,
  traffic,
  opponents = [],
  isMobile = false,
  standalone = true,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackLayerRef = useRef<HTMLCanvasElement | null>(null);

  // Precompute uniform-aspect circuit bounds + track projection so map proportions & car direction never distort!
  const mapMetrics = useMemo(() => {
    const pts = splineCurve.getPoints(180);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    pts.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    });

    const spanX = Math.max(10, maxX - minX);
    const spanZ = Math.max(10, maxZ - minZ);
    const startTangent = splineCurve.getTangent(0);
    const sampled = splineCurve.getPoints(120);

    return { pts, minX, maxX, minZ, maxZ, spanX, spanZ, startTangent, sampled };
  }, [splineCurve]);

  const canvasW = isMobile ? 116 : 136;
  const canvasH = isMobile ? 116 : 150;

  // Pre-render crisp offscreen background + glowing circuit spline whenever size or track changes
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    const pad = 13;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const scale = Math.min(availW / mapMetrics.spanX, availH / mapMetrics.spanZ);
    const offsetX = (canvasW - mapMetrics.spanX * scale) / 2;
    const offsetY = (canvasH - mapMetrics.spanZ * scale) / 2;

    const toMap = (x: number, z: number): [number, number] => [
      offsetX + (x - mapMetrics.minX) * scale,
      canvasH - offsetY - (z - mapMetrics.minZ) * scale
    ];

    // 1. Tactical Dark Radial Background + Subtle GPS Grid
    const bgGrad = octx.createRadialGradient(
      canvasW * 0.5,
      canvasH * 0.5,
      8,
      canvasW * 0.5,
      canvasH * 0.5,
      canvasW * 0.85
    );
    bgGrad.addColorStop(0, 'rgba(13, 24, 44, 0.92)');
    bgGrad.addColorStop(1, 'rgba(6, 10, 18, 0.96)');
    octx.fillStyle = bgGrad;
    octx.fillRect(0, 0, canvasW, canvasH);

    octx.strokeStyle = 'rgba(0, 242, 254, 0.06)';
    octx.lineWidth = 1;
    const step = 18;
    for (let gx = step; gx < canvasW; gx += step) {
      octx.beginPath();
      octx.moveTo(gx, 0);
      octx.lineTo(gx, canvasH);
      octx.stroke();
    }
    for (let gy = step; gy < canvasH; gy += step) {
      octx.beginPath();
      octx.moveTo(0, gy);
      octx.lineTo(canvasW, gy);
      octx.stroke();
    }

    // 2. Outer Cyan Track Glow
    octx.save();
    octx.beginPath();
    mapMetrics.pts.forEach((pt, i) => {
      const [mx, my] = toMap(pt.x, pt.z);
      if (i === 0) octx.moveTo(mx, my);
      else octx.lineTo(mx, my);
    });
    octx.closePath();
    octx.strokeStyle = 'rgba(0, 242, 254, 0.22)';
    octx.lineWidth = 10;
    octx.lineJoin = 'round';
    octx.lineCap = 'round';
    octx.stroke();

    // 3. Asphalt Track Ribbon
    octx.strokeStyle = 'rgba(20, 29, 46, 0.95)';
    octx.lineWidth = 6.5;
    octx.stroke();

    // 4. Illuminated Racing Line Gradient
    const trackGrad = octx.createLinearGradient(0, canvasH, canvasW, 0);
    trackGrad.addColorStop(0, '#00f2fe');
    trackGrad.addColorStop(0.5, '#38bdf8');
    trackGrad.addColorStop(1, '#a855f7');
    octx.strokeStyle = trackGrad;
    octx.lineWidth = 2.2;
    octx.stroke();
    octx.restore();

    // 5. Directional Forward Markers along circuit (every ~25%)
    for (const frac of [0.22, 0.48, 0.74]) {
      const idx = Math.floor(frac * mapMetrics.pts.length);
      const pt = mapMetrics.pts[idx];
      const tang = splineCurve.getTangent(frac);
      const [mx, my] = toMap(pt.x, pt.z);
      const rot = Math.atan2(tang.x, tang.z);
      octx.save();
      octx.translate(mx, my);
      octx.rotate(rot);
      octx.beginPath();
      octx.moveTo(0, -3);
      octx.lineTo(2.5, 2);
      octx.lineTo(-2.5, 2);
      octx.closePath();
      octx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      octx.fill();
      octx.restore();
    }

    // 6. Start / Finish Line Checkered Gate Perpendicular to Start Tangent
    const [startMx, startMy] = toMap(mapMetrics.pts[0].x, mapMetrics.pts[0].z);
    const startAngle = Math.atan2(mapMetrics.startTangent.x, mapMetrics.startTangent.z);
    octx.save();
    octx.translate(startMx, startMy);
    octx.rotate(startAngle);
    octx.fillStyle = '#ffffff';
    octx.fillRect(-5, -1.8, 10, 3.6);
    octx.fillStyle = '#090b10';
    octx.fillRect(-5, -1.8, 2.5, 1.8);
    octx.fillRect(0, -1.8, 2.5, 1.8);
    octx.fillRect(-2.5, 0, 2.5, 1.8);
    octx.fillRect(2.5, 0, 2.5, 1.8);
    octx.restore();

    trackLayerRef.current = offscreen;
  }, [mapMetrics, splineCurve, canvasW, canvasH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);
    if (trackLayerRef.current) {
      ctx.drawImage(trackLayerRef.current, 0, 0);
    }

    const pad = 13;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const scale = Math.min(availW / mapMetrics.spanX, availH / mapMetrics.spanZ);
    const offsetX = (canvasW - mapMetrics.spanX * scale) / 2;
    const offsetY = (canvasH - mapMetrics.spanZ * scale) / 2;

    const worldToMap = (x: number, z: number): [number, number] => [
      offsetX + (x - mapMetrics.minX) * scale,
      canvasH - offsetY - (z - mapMetrics.minZ) * scale
    ];

    // 1. Civilian Traffic Dots
    traffic.forEach((car) => {
      const [cx, cy] = worldToMap(car.position[0], car.position[2]);
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.fill();
    });

    // 2. Multiplayer Competitor Blips (Pulsing Ring + Initial)
    opponents.forEach((opp) => {
      const [ox, oy] = worldToMap(opp.position[0], opp.position[2]);
      const col = opp.color || '#a855f7';

      ctx.beginPath();
      ctx.arc(ox, oy, 6.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ox, oy, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // 3. Player Directional GPS Chevron & View Cone
    // IMPORTANT: world +X = canvas +X (right), world +Z = canvas -Y (up).
    // Forward direction is (sin(h), cos(h)), which in canvas is (+sin(h), -cos(h)) -> canvas CW rotation +playerHeading!
    const [px, py] = worldToMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(playerHeading);

    // Subtle forward vision cone
    const coneGrad = ctx.createLinearGradient(0, 0, 0, -18);
    coneGrad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
    coneGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -18);
    oConeArc(ctx);
    ctx.fillStyle = coneGrad;
    ctx.fill();

    // Glowing Cyan Player Chevron
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.2, 5.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5.2, 5.5);
    ctx.closePath();
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }, [playerPos, playerHeading, mapMetrics, traffic, opponents, canvasW, canvasH]);

  // Track completion %
  let closestT = 0;
  let minDSq = Infinity;
  for (let i = 0; i < mapMetrics.sampled.length; i++) {
    const pt = mapMetrics.sampled[i];
    const dx = playerPos.x - pt.x;
    const dz = playerPos.z - pt.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDSq) {
      minDSq = dSq;
      closestT = i / mapMetrics.sampled.length;
    }
  }
  const progressPercent = Math.min(100, Math.max(0, Math.round(closestT * 100)));

  if (isMobile) {
    return (
      <div className={`hud-glass-capsule p-1.5 rounded-2xl border border-cyan-500/35 flex flex-col items-center pointer-events-auto shadow-lg ${className}`}>
        <div className="flex items-center justify-between w-full text-[9px] uppercase font-bold text-gray-300 mb-1 px-1">
          <span className="tracking-wider">GPS</span>
          <span className="text-cyan-400 font-mono font-black">{progressPercent}%</span>
        </div>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          className="w-[74px] h-[74px] sm:w-20 sm:h-20 rounded-xl bg-black/50 border border-cyan-500/20 shadow-inner"
        />
      </div>
    );
  }

  const innerContent = (
    <>
      <div className="flex items-center justify-between w-full text-[10px] uppercase font-bold text-gray-300 mb-1.5 px-0.5">
        <span className="tracking-wider">GPS RADAR</span>
        <span className="text-cyan-400 font-mono font-bold">{progressPercent}%</span>
      </div>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        className="w-28 h-32 rounded-xl bg-black/50 border border-cyan-500/20 shadow-inner"
      />
    </>
  );

  if (!standalone) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        {innerContent}
      </div>
    );
  }

  return (
    <div className={`hud-glass-capsule p-3 rounded-2xl border border-cyan-500/30 flex flex-col items-center pointer-events-auto shadow-2xl ${className}`}>
      {innerContent}
    </div>
  );
};

function oConeArc(ctx: CanvasRenderingContext2D) {
  ctx.lineTo(9, -18);
  ctx.closePath();
}
