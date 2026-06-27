import "./molecule-loader.css";

export function MoleculeLoader({ text }: { text?: string }) {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="metabo-loader" aria-label="Loading">
          <div className="cell-core" />
          <span className="orbit orbit-1">
            <span className="particle p1" />
          </span>
          <span className="orbit orbit-2">
            <span className="particle p2" />
          </span>
          <span className="orbit orbit-3">
            <span className="particle p3" />
          </span>
        </div>
        {text && <p className="loading-status">{text}</p>}
      </div>
    </div>
  );
}
