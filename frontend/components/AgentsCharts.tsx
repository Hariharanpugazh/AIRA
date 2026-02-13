"use client";

import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart as BarChartIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface AgentStatCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    info?: string;
}

interface ChartDataPoint {
    name: string;
    errors: number;
    sessions: number;
}

export function AgentStatCard({ title, value, subValue }: AgentStatCardProps) {
    return (
        <Card className="p-6 relative overflow-hidden group bg-surface border-border/40 shadow-sm hover:shadow-md transition-shadow">
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground tracking-[0.15em] uppercase">{title}</h3>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-foreground tracking-tight">{value}</span>
                    {subValue && <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">{subValue}</span>}
                </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
        </Card>
    );
}

export function AgentSessionsChart() {
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const createEmptyTimeline = (): ChartDataPoint[] => {
            const emptyData: ChartDataPoint[] = [];
            for (let i = 7; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                emptyData.push({
                    name: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    errors: 0,
                    sessions: 0,
                });
            }
            return emptyData;
        };

        const fetchSessionData = async () => {
            try {
                const points = await apiFetch<Array<{ timestamp: string; active_rooms?: number }>>(
                    '/api/analytics/timeseries?range=7d'
                );
                const normalized = (points || [])
                    .slice(0, 8)
                    .reverse()
                    .map((point) => ({
                        name: new Date(point.timestamp).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                        }),
                        errors: 0,
                        sessions: point.active_rooms || 0,
                    }));

                if (normalized.length > 0) {
                    setChartData(normalized);
                } else {
                    setChartData(createEmptyTimeline());
                }
            } catch (_error) {
                setChartData(createEmptyTimeline());
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchSessionData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="p-8 h-[450px] bg-surface border-border/40 shadow-sm transition-all">
            <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                         <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Agent Sessions Served</h3>
                         <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground shrink-0">i</div>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-[10px] font-bold tracking-tight">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#4f46e5]" />
                        <span className="text-muted-foreground/80">Total number of active sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500" />
                        <span className="text-muted-foreground/80">Agent dispatch errors</span>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse text-sm">
                        Loading session data...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm flex-col gap-2">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <BarChartIcon className="w-6 h-6 opacity-20" />
                        </div>
                        No session data available yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={6}>
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                            />
                            <Tooltip 
                                cursor={{ fill: 'rgba(79, 70, 229, 0.04)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-surface border border-border/40 p-3 rounded-xl shadow-xl space-y-2">
                                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{payload[0].payload.name}</p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between gap-8">
                                                        <span className="text-xs font-medium">Sessions</span>
                                                        <span className="text-xs font-bold text-primary">{payload[1]?.value || 0}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-8">
                                                        <span className="text-xs font-medium">Errors</span>
                                                        <span className="text-xs font-bold text-red-500">{payload[0]?.value || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={8} />
                            <Bar dataKey="sessions" radius={[4, 4, 0, 0]} barSize={8}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="oklch(0.58 0.25 258.33)" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
