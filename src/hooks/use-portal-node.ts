import { useEffect, useState } from "react";

export function usePortalNode(id: string) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNode(document.getElementById(id));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [id]);

  return node;
}
