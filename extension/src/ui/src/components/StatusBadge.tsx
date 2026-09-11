interface StatusBadgeProps {
  status: "idle" | "loading" | "success" | "error";
  message: string;
}

export default function StatusBadge({
  status,
  message,
}: StatusBadgeProps) {
  return (
    <div className={`status-badge ${status}`}>
      <span className="status-dot" />
      <span>{message}</span>
    </div>
  );
}