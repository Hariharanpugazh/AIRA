import React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden selection:bg-primary/30">
            
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 blur-[120px] rounded-full opacity-20 pointer-events-none animate-pulse-slow" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 blur-[100px] rounded-full opacity-20 pointer-events-none" />

            
            <div className="w-full max-w-[480px] relative z-10 animate-fade-in">
                {children}
            </div>
        </div>
    );
}
