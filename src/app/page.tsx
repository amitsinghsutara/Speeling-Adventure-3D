import { GameShell } from "@/components/GameShell";

/**
 * Home route. This is a server component that renders only the lightweight
 * shell; the WebGL scene itself is loaded client-side inside GameShell.
 */
export default function HomePage() {
  return (
    <main className="game-root">
      <GameShell />
    </main>
  );
}
