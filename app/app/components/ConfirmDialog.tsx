"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 160,
        background: "rgba(3,3,12,.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        style={{
          width: "min(440px, 100%)",
          background: "linear-gradient(180deg,#14142b,#101023)",
          border: "1px solid #292b43",
          borderRadius: 16,
          padding: 22,
          boxShadow: "0 24px 70px rgba(0,0,0,.45)",
          color: "#f0f0f5",
        }}
      >
        <h2 id="confirm-dialog-title" style={{ margin: 0, fontSize: 18 }}>
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          style={{ margin: "10px 0 20px", color: "#8d92aa", fontSize: 13, lineHeight: 1.6 }}
        >
          {description}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              border: "1px solid #2a2d40",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#c6cad8",
              background: "#17172d",
              font: "600 13px inherit",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "10px 14px",
              color: "#fff",
              background: danger ? "#b4232f" : "linear-gradient(90deg,#1196fc,#5d0dfa)",
              font: "600 13px inherit",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
