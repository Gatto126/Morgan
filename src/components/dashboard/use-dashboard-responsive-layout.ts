"use client";

import { useEffect, useState } from "react";

export function useDashboardResponsiveLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const baseMargin = isMobile ? 0 : 24;

  return {
    isMobile,
    marginLeft: baseMargin,
    marginRight: baseMargin,
    yAxisWidth: isMobile ? 0 : 50
  };
}
