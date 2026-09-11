import type { Model } from "../services/api";

interface ModelSelectProps {
  models: Model[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ModelSelect({
  models,
  value,
  onChange,
  disabled,
}: ModelSelectProps) {
  return (
    <div className="field">
      <label htmlFor="model">CHOOSE MODEL</label>

      <select
        id="model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || models.length === 0}
      >
        <option value="">
          {models.length === 0
            ? "VALIDATE KEY FIRST"
            : "SELECT MODEL"}
        </option>

        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>

      {models.length > 0 && (
        <span className="model-count">
          {models.length} MODEL{models.length !== 1 ? "S" : ""} AVAILABLE
        </span>
      )}
    </div>
  );
}