"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, getMe, getAccessToken } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const isPublicRoute = (path: string) => {
        return path === "/login" || path === "/register";
    };

    const checkAuth = React.useCallback(async () => {
        const token = getAccessToken();

        if (!token) {
            setUser(null);
            setIsLoading(false);
            if (!isPublicRoute(pathname)) {
                router.push("/login");
            }
            return;
        }

        try {
            const userData = await getMe();
            setUser(userData);
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
            if (!isPublicRoute(pathname)) {
                router.push("/login"); // Only redirect if auth fails on a protected route
            }
        } finally {
            setIsLoading(false);
        }
    }, [pathname, router]);

    useEffect(() => {
        checkAuth();
    }, []); // Only run once on mount

    // Effect to handle route protection
    useEffect(() => {
        if (!isLoading && !user && !isPublicRoute(pathname)) {
            // Double check token existence before redirecting to be safe, 
            // largely handled by checkAuth but safety for route changes
            const token = getAccessToken();
            if (!token) {
                router.push("/login");
            }
        }
    }, [pathname, isLoading, user, router]);


    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        refreshUser: checkAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
