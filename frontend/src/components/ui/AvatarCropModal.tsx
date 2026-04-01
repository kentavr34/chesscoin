/**
 * AvatarCropModal — обрезка аватара с pinch-to-zoom
 * Используется вместо прямой загрузки в ProfilePage
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export const AvatarCropModal: React.FC<Props> = ({ file, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imgSrc, setImgSrc] = useState('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [lastDist, setLastDist] = useState(0);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(false);

  // Responsive SIZE: smaller on mobile, 280px on desktop
  const SIZE = Math.min(280, Math.max(200, window.innerWidth - 40));

  // Загружаем файл
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // При загрузке изображения — центрируем и масштабируем чтобы заполнить круг
  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imgRef.current = img;
    const { naturalWidth: nw, naturalHeight: nh } = img;
    setImgSize({ w: nw, h: nh });
    // Масштаб чтобы изображение минимально покрывало круг
    const minScale = Math.max(SIZE / nw, SIZE / nh);
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  }, [SIZE]);

  // Рисуем превью на canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgSize.w === 0) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Круглая маска
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const drawW = imgSize.w * scale;
    const drawH = imgSize.h * scale;
    const drawX = (SIZE - drawW) / 2 + offset.x;
    const drawY = (SIZE - drawH) / 2 + offset.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [scale, offset, imgSize, SIZE]);

  // Touch: drag
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setDragging(true);
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastDist(Math.hypot(dx, dy));
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - lastPos.x;
      const dy = e.touches[0].clientY - lastPos.y;
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist > 0) {
        const factor = dist / lastDist;
        setScale(s => Math.max(SIZE / Math.max(imgSize.w, imgSize.h), Math.min(s * factor, 5)));
      }
      setLastDist(dist);
    }
  };

  const onTouchEnd = () => { setDragging(false); setLastDist(0); };

  // Mouse drag (десктоп)
  const onMouseDown = (e: React.MouseEvent) => { setDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset(o => ({ x: o.x + e.movementX, y: o.y + e.movementY }));
  };
  const onMouseUp = () => setDragging(false);

  // Wheel zoom (десктоп)
  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setScale(s => Math.max(SIZE / Math.max(imgSize.w, imgSize.h), Math.min(s * factor, 5)));
  };

  // Подтверждение — генерируем финальный WebP 256x256
  const handleConfirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    // Рендерим в 256x256
    const out = document.createElement('canvas');
    out.width = 256; out.height = 256;
    const ctx = out.getContext('2d')!;
    const img = imgRef.current!;

    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();

    const ratio = 256 / SIZE;
    const drawW = imgSize.w * scale * ratio;
    const drawH = imgSize.h * scale * ratio;
    const drawX = (256 - drawW) / 2 + offset.x * ratio;
    const drawY = (256 - drawH) / 2 + offset.y * ratio;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    out.toBlob(blob => {
      setLoading(false);
      if (blob) onConfirm(blob);
    }, 'image/webp', 0.9);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
      background: 'var(--avatar-crop-overlay-bg, rgba(0,0,0,0.88))', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ color: 'var(--color-text-primary, #F0F2F8)', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
        Customize avatar
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)', marginBottom: 20 }}>
        Drag and pinch to zoom
      </div>

      {/* Превью с маской */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: SIZE, height: SIZE, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{ borderRadius: '50%', display: 'block', border: '3px solid var(--color-accent, #F5C842)' }}
        />
        {imgSrc && (
          <img
            src={imgSrc}
            onLoad={onImgLoad}
            style={{ display: 'none' }}
            alt=""
          />
        )}
      </div>

      {/* Ползунок масштаба */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, width: SIZE }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted, #4A5270)' }}>−</span>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.01}
          value={scale}
          onChange={e => setScale(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--color-accent, #F5C842)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted, #4A5270)' }}>+</span>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={onCancel}
          style={{ padding: '11px 24px', background: 'transparent', border: '1px solid var(--avatar-crop-cancel-border, rgba(255,255,255,0.15))', borderRadius: 14, color: 'var(--color-text-secondary, #8B92A8)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ padding: '11px 28px', background: 'var(--color-accent, #F5C842)', borderRadius: 14, border: 'none', color: 'var(--color-bg-dark, #0B0D11)', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '⏳' : '✓ Done'}
        </button>
      </div>
    </div>
  );
};
