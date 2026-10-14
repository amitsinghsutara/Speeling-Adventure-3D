export interface LoadingScreenProps {
  message: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="overlay overlay--loading" role="status" aria-live="polite">
      <p className="overlay__title">Spelling Adventure 3D</p>
      <p className="overlay__subtitle">{message}</p>
      <div className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
