import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import "./BottomSheet.css";

interface BottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
  mobileOnly?: boolean;
}

export default function BottomSheet({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className = "",
  mobileOnly = false,
}: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(max-width: 720px)").matches
  );
  const canRender = !mobileOnly || isMobileViewport;

  useEffect(() => {
    if (!mobileOnly) return;
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [mobileOnly]);

  useEffect(() => {
    if (!open || !canRender) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canRender, onClose, open]);

  if (!open || !canRender) return null;

  return (
    <div
      className={`bottom-sheet-backdrop${mobileOnly ? " bottom-sheet-backdrop--mobile-only" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onMouseDown={onClose}
    >
      <section
        className={`bottom-sheet ${className}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bottom-sheet__handle" aria-hidden="true" />
        <header className="bottom-sheet__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={`${title} sluiten`}>
            <X size={20} />
          </button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
        {footer && <footer className="bottom-sheet__footer">{footer}</footer>}
      </section>
    </div>
  );
}
