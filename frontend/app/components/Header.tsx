"use client";

import React, { useState, useRef, useEffect } from "react";
import { ClockIcon, RefreshCwIcon, CalendarIcon, ChevronDownIcon, CheckIcon } from "./icons";
import { Button } from "@/components/ui/Button";
import { useClickOutside } from "../../hooks/useClickOutside";

interface HeaderProps {
  projectName: string;
  sectionName?: string;
  pageName: string;
  showTimeRange?: boolean;
  actionButton?: React.ReactNode;
  onRefresh?: () => Promise<void>;
  onTimeRangeChange?: (range: string) => void;
  onAutoRefreshChange?: (interval: number) => void;
}

const TIME_RANGES = [
  { label: "Past hour", value: "1h" },
  { label: "Past 3 hours", value: "3h" },
  { label: "Past 6 hours", value: "6h" },
  { label: "Past 12 hours", value: "12h" },
  { label: "Past 24 hours", value: "24h" },
  { label: "Past 7 days", value: "7d" },
  { label: "Past 30 days", value: "30d" },
  { label: "Past 60 days", value: "60d" },
];

const REFRESH_INTERVALS = [
  { label: "Auto-refresh off", value: 0 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "5m", value: 300000 },
];

export default function Header({
  projectName,
  sectionName,
  pageName,
  showTimeRange = true,
  actionButton,
  onRefresh,
  onTimeRangeChange,
  onAutoRefreshChange
}: HeaderProps) {
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);
  const [isAutoRefreshOpen, setIsAutoRefreshOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState("24h");
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState("Updated now");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localTimezone, setLocalTimezone] = useState("");

  const timeRangeRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<HTMLDivElement>(null);

  useClickOutside(timeRangeRef as React.RefObject<HTMLElement>, () => setIsTimeRangeOpen(false));
  useClickOutside(autoRefreshRef as React.RefObject<HTMLElement>, () => setIsAutoRefreshOpen(false));

  // Initialize timezone on client
  useEffect(() => {
    setLocalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Handle manual refresh
  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle auto-refresh interval
  useEffect(() => {
    if (refreshInterval === 0 || !onRefresh) return;

    const intervalId = setInterval(handleRefresh, refreshInterval);
    return () => clearInterval(intervalId);
  }, [refreshInterval, onRefresh]);

  // Update "time ago" display
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
      if (diff < 60) {
        setTimeAgo("Updated now");
      } else if (diff < 3600) {
        setTimeAgo(`Updated ${Math.floor(diff / 60)}m ago`);
      } else {
        setTimeAgo(`Updated ${Math.floor(diff / 3600)}h ago`);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const handleRangeSelect = (value: string) => {
    setSelectedRange(value);
    if (onTimeRangeChange) onTimeRangeChange(value);
    setIsTimeRangeOpen(false);
  };

  const handleIntervalSelect = (value: number) => {
    setRefreshInterval(value);
    if (onAutoRefreshChange) onAutoRefreshChange(value);
    setIsAutoRefreshOpen(false);
  };

  const getRangeLabel = () => {
    return TIME_RANGES.find(r => r.value === selectedRange)?.label.replace("Past ", "Past ") || "Past 24h";
  };

  const getRefreshLabel = () => {
    if (refreshInterval === 0) return "Auto-refresh";
    return REFRESH_INTERVALS.find(r => r.value === refreshInterval)?.label || "Auto-refresh";
  };

  return (
    <header className="h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border/50 z-20 transition-all">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 mb-0.5">
          <span>{projectName}</span>
          {sectionName && (
            <>
              <span className="opacity-40">/</span>
              <span>{sectionName}</span>
            </>
          )}
          <span className="opacity-40">/</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{pageName}</h1>
      </div>

      <div className="flex items-center gap-3">
        {showTimeRange && (
          <div className="flex items-center gap-2">

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-muted-foreground text-xs shadow-sm min-w-[120px] justify-center">
              <ClockIcon className="w-3.5 h-3.5" />
              <span>{isRefreshing ? "Updating..." : timeAgo}</span>
            </div>


            <div className="relative" ref={autoRefreshRef}>
              <Button
                variant="outline"
                size="sm"
                className={`hidden md:flex h-8 gap-2 bg-surface border-border text-muted-foreground hover:text-foreground text-xs font-normal ${refreshInterval > 0 ? "text-primary border-primary/20 bg-primary/5" : ""}`}
                onClick={() => setIsAutoRefreshOpen(!isAutoRefreshOpen)}
              >
                <div className={isRefreshing ? "animate-spin" : ""}>
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                </div>
                <span className="hidden lg:inline">{getRefreshLabel()}</span>
                <ChevronDownIcon className="w-3.5 h-3.5 ml-1 opacity-50" />
              </Button>

              {isAutoRefreshOpen && (
                <div className="absolute top-full mt-2 right-0 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="py-1">
                    {REFRESH_INTERVALS.map((interval) => (
                      <button
                        key={interval.value}
                        onClick={() => handleIntervalSelect(interval.value)}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-surface-hover flex items-center justify-between group ${refreshInterval === interval.value ? "text-primary font-medium" : "text-muted-foreground"
                          }`}
                      >
                        {interval.label}
                        {refreshInterval === interval.value && <CheckIcon className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>


            <div className="relative" ref={timeRangeRef}>
              <Button
                variant="outline"
                size="sm"
                className="flex h-8 gap-2 bg-surface border-border text-muted-foreground hover:text-foreground text-xs font-normal min-w-[100px] justify-between"
                onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{getRangeLabel()}</span>
                </div>
                <ChevronDownIcon className="w-3.5 h-3.5 ml-1 opacity-50" />
              </Button>

              {isTimeRangeOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-2 border-b border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Quick Ranges</span>
                  </div>
                  <div className="py-1 max-h-[300px] overflow-y-auto">
                    {TIME_RANGES.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => handleRangeSelect(range.value)}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-surface-hover flex items-center justify-between ${selectedRange === range.value ? "text-primary font-medium bg-primary/5" : "text-muted-foreground"
                          }`}
                      >
                        {range.label}
                        {selectedRange === range.value && <CheckIcon className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border p-1">
                    <button className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors">
                      Custom range
                    </button>
                  </div>
                  {localTimezone && (
                    <div className="px-4 py-2 bg-surface/50 border-t border-border text-[10px] text-muted-foreground">
                      Local timezone: {localTimezone}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {actionButton && (
          <div className="border-l border-border pl-3 ml-1">
            {actionButton}
          </div>
        )}
      </div>
    </header>
  );
}
