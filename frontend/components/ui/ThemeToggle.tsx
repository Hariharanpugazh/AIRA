"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./Button";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-8 h-8" />;
    }

    const cycleTheme = () => {
        if (theme === "light") setTheme("dark");
        else if (theme === "dark") setTheme("system");
        else setTheme("light");
    };

    const getIcon = () => {
        if (theme === "light") return <Sun className="w-4 h-4" />;
        if (theme === "dark") return <Moon className="w-4 h-4" />;
        return <Monitor className="w-4 h-4" />;
    };

    const getLabel = () => {
        if (theme === "light") return "Light";
        if (theme === "dark") return "Dark";
        return "System";
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={cycleTheme}
            className="gap-2 text-muted-foreground hover:text-foreground transition-colors"
            title={`Current theme: ${getLabel()}. Click to cycle.`}
        >
            {getIcon()}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
