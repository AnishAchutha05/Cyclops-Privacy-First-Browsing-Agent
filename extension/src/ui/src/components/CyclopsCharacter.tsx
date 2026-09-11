import type { CSSProperties } from "react";

export type CyclopsState =
  | "idle"
  | "thinking"
  | "executing"
  | "success"
  | "error";

interface CyclopsCharacterProps {
  state: CyclopsState;
  size?: number;
}

const CHARACTER_IMAGES: Record<CyclopsState, string> = {
  idle: "/assets/idle.png",
  thinking: "/assets/thinking.png",
  executing: "/assets/executing.png",
  success: "/assets/success.png",
  error: "/assets/error.png",
};

function CyclopsCharacter({
  state,
  size = 42,
}: CyclopsCharacterProps) {
  return (
    <div
      className="cyclops-character"
      style={
        {
          "--cyclops-size": `${size}px`,
        } as CSSProperties
      }
    >
      <img
        src={CHARACTER_IMAGES[state]}
        alt="CYCLOPS"
        className="cyclops-sprite"
      />
    </div>
  );
}

export default CyclopsCharacter;