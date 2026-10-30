import type { ReactNode } from "react";

export function Fenetre({ titre, onFermer, children, large }: { titre: string; onFermer: () => void; children: ReactNode; large?: boolean }) {
  return (
    <div className="fixed inset-0 z-[3000] grid place-items-center bg-background/70 p-3" onClick={onFermer}>
      <div className={`pixel-box max-h-[88vh] w-full overflow-auto p-4 ${large ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-pixel text-xs text-accent">{titre}</h2>
          <button className="pixel-btn !px-2 !py-1" onClick={onFermer} aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
