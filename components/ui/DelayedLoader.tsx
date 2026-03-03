"use client";

import { useState, useEffect } from "react";
import { AiraLoader } from "./AiraLoader";

interface DelayedLoaderProps {
  delay?: number; // delay in milliseconds, default 1000ms (1 second)
}

export const DelayedLoader = ({ delay = 1000 }: DelayedLoaderProps) => {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!showLoader) {
    return null;
  }

  return <AiraLoader />;
};
