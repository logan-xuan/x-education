import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { CSSProperties } from 'react';

const packets = Array.from({ length: 68 }, (_, index) => ({
  left: (index * 61.8034 + 7) % 100,
  size: 30 + (index % 5) * 9,
  delay: -(index % 17) * 0.21,
  duration: 3.3 + (index % 7) * 0.24,
  rotation: (index % 2 ? 1 : -1) * (8 + (index % 24)),
  drift: (index % 2 ? 1 : -1) * (20 + (index % 75)),
}));

export default function RedPacketRain({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return createPortal(
    <div className="red-packet-rain" data-testid="red-packet-rain">
      <div className="rain-announcement" role="status">
        恭喜你答对了！ <span aria-hidden="true">✦</span>
      </div>
      <button type="button" className="rain-close" onClick={onClose}>
        <X size={17} />
        收起红包雨
      </button>
      <div className="rain-particles" aria-hidden="true">
        {packets.map((p, i) => (
          <span
            key={i}
            className={`rain-packet packet-color-${i % 3}`}
            style={
              {
                '--packet-left': `${p.left}%`,
                '--packet-size': `${p.size}px`,
                '--packet-delay': `${p.delay}s`,
                '--packet-duration': `${p.duration}s`,
                '--packet-rotation': `${p.rotation}deg`,
                '--packet-drift': `${p.drift}px`,
                '--packet-static-top': `${12 + ((i * 19) % 75)}%`,
              } as CSSProperties
            }
          >
            <i className="packet-flap" />
            <b className="packet-seal">福</b>
          </span>
        ))}
      </div>
    </div>,
    document.body,
  );
}
