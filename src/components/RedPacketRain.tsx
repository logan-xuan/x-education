import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Gift, Hand, RotateCcw, Sparkles, Timer, X } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import type { Rules } from '../../shared/model';
import {
  drawPrize,
  rainPrizes,
  ROUND_SECONDS,
  swipeHitsRect,
  type Point,
  type RainPrize,
} from '../lib/packet-game';

const packets = Array.from({ length: 68 }, (_, index) => ({
  left: (index * 61.8034 + 7) % 100,
  size: 40 + (index % 5) * 8,
  delay: -(index % 17) * 0.25,
  duration: 5 + (index % 7) * 0.3,
  rotation: (index % 2 ? 1 : -1) * (8 + (index % 24)),
  drift: (index % 2 ? 1 : -1) * (20 + (index % 75)),
}));
interface Capture {
  packetId: number;
  prize: RainPrize;
  x: number;
  y: number;
}
interface Swipe {
  from: Point;
  to: Point;
  padding: number;
}
const money = (value: number) => value.toLocaleString('zh-CN');

export default function RedPacketRain({
  rules,
  onClose,
  onReplay,
}: {
  rules: Rules;
  onClose: () => void;
  onReplay: () => void;
}) {
  const prizes = useMemo(() => rainPrizes(rules), [rules]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const caught = useRef(new Map<number, Capture>());
  const ended = useRef(false);
  const deadline = useRef(Date.now() + ROUND_SECONDS * 1000);
  const root = useRef<HTMLDivElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const packetElements = useRef<(HTMLSpanElement | null)[]>([]);
  const lastPoint = useRef(new Map<number, { point: Point; time: number }>());
  const swipes = useRef<Swipe[]>([]),
    frame = useRef(0);
  const finish = useCallback(() => {
    ended.current = true;
    setFinished(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSeconds(left);
      if (!left) {
        finish();
        clearInterval(timer);
      }
    }, 250);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [finish]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const application = document.getElementById('root');
    const previousInert = application?.inert;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (application) application.inert = true;
    close.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const buttons = [
        ...(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      if (application) application.inert = previousInert || false;
      document.removeEventListener('keydown', keydown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);
  useEffect(() => {
    if (finished)
      root.current
        ?.querySelector<HTMLButtonElement>('.rain-play-again')
        ?.focus({ preventScroll: true });
  }, [finished]);

  const openPacket = useCallback(
    (packetId: number, x: number, y: number) => {
      if (ended.current || caught.current.has(packetId)) return;
      if (Date.now() >= deadline.current) {
        finish();
        return;
      }
      const capture: Capture = {
        packetId,
        prize: drawPrize(prizes),
        x: Math.max(82, Math.min(x, window.innerWidth - 82)),
        y: Math.max(175, Math.min(y, window.innerHeight - 235)),
      };
      caught.current.set(packetId, capture);
      setCaptures([...caught.current.values()]);
      const available = packetElements.current.filter(
        (node) => node && getComputedStyle(node).display !== 'none',
      ).length;
      if (caught.current.size >= available) finish();
    },
    [prizes, finish],
  );

  function point(event: PointerEvent<HTMLDivElement>, start = false) {
    if (ended.current) return;
    const to = { x: event.clientX, y: event.clientY },
      now = Date.now();
    const previous = lastPoint.current.get(event.pointerId);
    const from = !start && previous && now - previous.time < 200 ? previous.point : to;
    lastPoint.current.set(event.pointerId, { point: to, time: now });
    swipes.current.push({ from, to, padding: event.pointerType === 'touch' ? 14 : 5 });
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const gestures = swipes.current.splice(0);
      packetElements.current.forEach((node, id) => {
        if (!node || caught.current.has(id) || !node.getClientRects().length) return;
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
        if (
          gestures.some((gesture) => swipeHitsRect(gesture.from, gesture.to, rect, gesture.padding))
        ) {
          openPacket(id, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      });
    });
  }
  function catchOne() {
    const available = packetElements.current.flatMap((node, id) => {
      if (!node || caught.current.has(id) || !node.getClientRects().length) return [];
      const rect = node.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight ? [{ id, rect }] : [];
    });
    const packet = available[Math.floor(Math.random() * available.length)];
    if (packet)
      openPacket(
        packet.id,
        packet.rect.left + packet.rect.width / 2,
        packet.rect.top + packet.rect.height / 2,
      );
  }
  const total = captures.reduce((sum, item) => sum + item.prize.value, 0);
  const latest = captures.at(-1);
  function collection() {
    return (
      <div className="rain-prize-counts">
        {prizes.map((prize) => (
          <div
            key={prize.kind}
            className={`rain-prize-count prize-${prize.kind}`}
            data-prize={prize.kind}
          >
            <span>
              {prize.kind === 'fixed' ? <Crown size={15} /> : <Gift size={15} />}
              {prize.name}
            </span>
            <strong>
              {money(prize.value)}
              <small>元</small>
            </strong>
            <b data-testid={`prize-count-${prize.kind}`}>
              {captures.filter((item) => item.prize.kind === prize.kind).length} 张
            </b>
          </div>
        ))}
      </div>
    );
  }
  return createPortal(
    <div
      ref={root}
      className={`red-packet-rain ${finished ? 'rain-finished' : 'rain-playing'}`}
      data-testid="red-packet-rain"
      role="dialog"
      aria-modal="true"
      aria-label="接红包小游戏"
    >
      <div className="rain-game-backdrop" aria-hidden="true" />
      <div className="rain-announcement" role="status">
        <h2>
          <Sparkles size={19} />
          恭喜你答对了！<span aria-hidden="true">✦</span>
        </h2>
        <p>
          <Hand size={14} />
          鼠标划过 · 手指滑动，接住你的惊喜
        </p>
      </div>
      <button ref={close} type="button" className="rain-close" onClick={onClose}>
        <X size={17} />
        收起红包雨
      </button>
      {!finished ? (
        <>
          <div className="rain-game-progress">
            <span className={seconds <= 5 ? 'rain-time almost-done' : 'rain-time'}>
              <Timer size={17} />
              {seconds} 秒
            </span>
            <span>
              已接 <b data-testid="rain-caught-count">{captures.length}</b> 个
            </span>
            <span>
              合计 <strong data-testid="rain-total">{money(total)}</strong> 元
            </span>
          </div>
          <div
            className="rain-particles"
            aria-hidden="true"
            onPointerDown={(event) => {
              if (event.pointerType === 'touch')
                event.currentTarget.setPointerCapture(event.pointerId);
              point(event, true);
            }}
            onPointerMove={(event) => point(event)}
            onPointerUp={(event) => {
              point(event);
              lastPoint.current.delete(event.pointerId);
            }}
            onPointerCancel={(event) => lastPoint.current.delete(event.pointerId)}
            onPointerLeave={(event) => lastPoint.current.delete(event.pointerId)}
          >
            {packets.map((p, i) => (
              <span
                key={i}
                ref={(node) => {
                  packetElements.current[i] = node;
                }}
                data-packet-id={i}
                className={`rain-packet packet-color-${i % 3} ${caught.current.has(i) ? 'packet-caught' : ''}`}
                style={
                  {
                    '--packet-left': `${p.left}%`,
                    '--packet-size': `${p.size}px`,
                    '--packet-delay': `${p.delay}s`,
                    '--packet-duration': `${p.duration}s`,
                    '--packet-rotation': `${p.rotation}deg`,
                    '--packet-drift': `${p.drift}px`,
                    '--packet-static-top': `${25 + ((i * 19) % 45)}%`,
                  } as CSSProperties
                }
              >
                <i className="packet-flap" />
                <b className="packet-seal">福</b>
              </span>
            ))}
          </div>
          <div className="rain-reveals" aria-hidden="true">
            {captures.slice(-6).map((item) => (
              <div
                key={item.packetId}
                className={`rain-reveal prize-${item.prize.kind}`}
                style={{ left: item.x, top: item.y }}
              >
                <span>✦ {item.prize.name} ✦</span>
                <strong>
                  {money(item.prize.value)}
                  <small>元</small>
                </strong>
              </div>
            ))}
          </div>
          <section className="rain-collection" aria-label="本轮红包收获">
            <div className="rain-collection-top">
              <div>
                <h3>我的红包收获</h3>
                <small>课堂里的小小奖励</small>
              </div>
              <button type="button" className="rain-catch-one" onClick={catchOne}>
                <Gift size={16} />
                接一个红包
              </button>
            </div>
            {collection()}
            <p className="rain-latest" role="status" aria-live="polite">
              {latest
                ? `接到${latest.prize.name}，${money(latest.prize.value)}元！太棒啦！`
                : '划到红包就能打开，看看你会收获什么吧！'}
            </p>
          </section>
        </>
      ) : (
        <section className="rain-summary" aria-labelledby="rain-summary-title">
          <span className="rain-summary-symbol">
            <Gift size={34} />
          </span>
          <p className="rain-summary-kicker">本轮惊喜 · 开箱完成</p>
          <h2 id="rain-summary-title">红包收好啦！</h2>
          <p className="rain-summary-intro">
            {captures.length
              ? `你接住了 ${captures.length} 个红包，每一份都是好想法的奖励。`
              : '刚刚热身完？再试一次，把小惊喜接到手里吧！'}
          </p>
          <div className="rain-summary-total">
            <span>奖励面额合计</span>
            <strong>
              {money(total)}
              <small>元</small>
            </strong>
          </div>
          {collection()}
          <div className="rain-summary-actions">
            <button type="button" className="rain-play-again" onClick={onReplay}>
              <RotateCcw size={17} />
              再玩一次
            </button>
            <button type="button" onClick={onClose}>
              完成
            </button>
          </div>
        </section>
      )}
    </div>,
    document.body,
  );
}
