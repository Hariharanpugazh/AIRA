"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string;
    className?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, width = "max-w-2xl", className = "" }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
            // Prevent background scrolling
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />
            <div
                ref={modalRef}
                className={`relative w-full ${width} ${className} glass-card rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up bg-[#0a0a0a]/90`}
                onClick={(e) => e.stopPropagation()}
            >
                
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-display font-medium text-foreground">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-white/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                
                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                    {children}
                </div>

                
                {footer && (
                    <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3 rounded-b-xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
