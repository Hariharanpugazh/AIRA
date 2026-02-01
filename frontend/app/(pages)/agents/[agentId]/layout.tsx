"use client";

import AgentLayout from "../../../../components/agent/AgentLayout";

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {


    // React.use() wrapper to unwrap params in Next.js 15+ if needed, 
    // but for standard client component usage we can use them directly or via hook.
    // Since this is a client component layout, props are passed.

    return (
        <AgentLayout>
            {children}
        </AgentLayout>
    );
}
