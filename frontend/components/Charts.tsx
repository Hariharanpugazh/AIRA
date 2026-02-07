"use client";

import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from "recharts";

// Colors from Relatim Design System - Adjusted for Light/Dark visibility
const COLORS = ["var(--color-primary)", "var(--color-accent)", "var(--color-muted)", "var(--color-secondary)"];

interface DataPoint {
    timestamp: string;
    [key: string]: any;
}

export function StatsLineChart({ data, dataKey = "value", color = "#00F0FF" }: { data: any[]; dataKey?: string; color?: string }) {
    return (
        <div className="h-[200px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <defs>
                        <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                        dataKey="timestamp"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                        itemStyle={{ color: "var(--foreground)", fontSize: "12px" }}
                        labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px" }}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: color, stroke: "var(--background)" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function PlatformDonutChart({ data }: { data: { name: string; value: number }[] }) {
    return (
        <div className="h-[200px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", borderRadius: "8px" }}
                        itemStyle={{ color: "var(--foreground)" }}
                    />
                </PieChart>
            </ResponsiveContainer>


            <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center gap-2 pr-4">
                {data.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-mono text-foreground">{entry.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
