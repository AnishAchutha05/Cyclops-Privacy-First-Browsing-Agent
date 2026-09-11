import type { Provider } from "../services/api";

interface Props {
  providers: Provider[];
  value: string;
  onChange: (value: string) => void;
}

export default function ProviderSelect({
  providers,
  value,
  onChange,
}: Props) {
  return (
    <div className="field">
      <label htmlFor="provider">AI PROVIDER</label>

      <select
        id="provider"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">SELECT PROVIDER</option>

        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  );
}