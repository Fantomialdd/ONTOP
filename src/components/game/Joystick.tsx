import { useRef, useState, type PointerEvent } from "react";

/** Joystick tactile (mobile) : renvoie un vecteur entre -1 et 1. */
export function Joystick({ onChange }: { onChange: (v: { x: number; y: number }) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const actif = useRef(false);
  const [k, setK] = useState({ x: 0, y: 0 });
  const maj = (e: PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setK({ x, y }); onChange({ x, y });
  };
  const fin = () => { actif.current = false; setK({ x: 0, y: 0 }); onChange({ x: 0, y: 0 }); };
  return (
    <div ref={base} className="absolute bottom-4 left-4 z-[2000] h-28 w-28 touch-none rounded-full border-4 border-border bg-background/40 md:hidden"
      onPointerDown={(e) => { actif.current = true; e.currentTarget.setPointerCapture(e.pointerId); maj(e); }}
      onPointerMove={(e) => { if (actif.current) maj(e); }}
      onPointerUp={fin} onPointerCancel={fin}>
      <div className="absolute h-10 w-10 rounded-full border-4 border-border bg-primary"
        style={{ left: `calc(50% + ${k.x * 36}px - 20px)`, top: `calc(50% + ${k.y * 36}px - 20px)` }} />
    </div>
  );
}
