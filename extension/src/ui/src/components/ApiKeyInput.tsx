import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ApiKeyInput({
  value,
  onChange,
  disabled,
}: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="field">
      <label htmlFor="api-key">API KEY</label>

      <div className="api-key-wrapper">
        <KeyRound size={16} />

        <input
          id="api-key"
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ENTER API KEY"
          disabled={disabled}
        />

        <button
          className="icon-button"
          type="button"
          onClick={() => setShowKey(!showKey)}
          aria-label="Toggle API key visibility"
        >
          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}