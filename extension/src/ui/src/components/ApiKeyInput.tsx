import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  disabled?: boolean;
  isValidating?: boolean;
}

export default function ApiKeyInput({
  value,
  onChange,
  onValidate,
  disabled,
  isValidating,
}: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="field">
      <label htmlFor="api-key">API KEY</label>

      <div className="api-key-wrapper" style={{ display: "flex", gap: "8px" }}>
        <div style={{ display: "flex", flex: 1, position: "relative" }}>
          <KeyRound size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#4a5a52" }} />
          <input
            id="api-key"
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ENTER API KEY"
            disabled={disabled || isValidating}
            style={{ paddingLeft: "34px", flex: 1, width: "100%" }}
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label="Toggle API key visibility"
            style={{ position: "absolute", right: "6px", top: "6px", background: "none", border: "none", color: "#4a5a52", cursor: "pointer" }}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        
        <button
          type="button"
          onClick={onValidate}
          disabled={!value || disabled || isValidating}
          className="button secondary"
          style={{ whiteSpace: "nowrap" }}
        >
          {isValidating ? "VALIDATING..." : "VALIDATE"}
        </button>
      </div>
    </div>
  );
}