export default function LoadingButton({
  activeAction,
  action,
  loadingLabel = "Working...",
  label,
  className = "",
  children,
  type = "button",
  onClick,
}) {
  const isLoading = activeAction === action;
  const buttonText = isLoading ? loadingLabel : children || label || "Action";

  return (
    <button
      type={type}
      className={`action-button ${className}`.trim()}
      onClick={onClick}
      disabled={Boolean(activeAction)}
      aria-busy={isLoading}
      aria-label={typeof buttonText === "string" ? buttonText : undefined}
    >
      {isLoading && <span className="button-spinner" aria-hidden="true" />}
      <span className="button-label">{buttonText}</span>
    </button>
  );
}
