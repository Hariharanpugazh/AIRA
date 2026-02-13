"use client";

import React from "react";
import PagesLayout from "../(pages)/layout";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // We simply reuse the existing pages layout (which applies DashboardLayout)
  return <PagesLayout>{children}</PagesLayout>;
}
