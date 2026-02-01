"use client";

import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
        <Card variant="glass" className="p-6 relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">{title}</h3>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground font-display">{value}</span>
                    {subValue && <span className="text-sm text-cyan-400 font-medium">{subValue}</span>}
                </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
    );
}

export function AgentSessionsChart() {
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessionData = async () => {
            try {
                const response = await fetch('/api/analytics/sessions?days=8');
                if (response.ok) {
                    const data = await response.json();
                    setChartData(data.sessions || []);
                } else {
                    // Generate empty data for last 8 days if API fails
                    const emptyData: ChartDataPoint[] = [];
                    for (let i = 7; i >= 0; i--) {
                        const date = new Date();
                        date.setDate(date.getDate() - i);
                        emptyData.push({
                            name: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                            errors: 0,
                            sessions: 0
                        });
                    }
                    setChartData(emptyData);
                }
            } catch (error) {
                
                setChartData([]);
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
        <Card variant="glass" className="p-6 h-[400px]">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Agent Sessions Served</h3>
                    <span className="text-muted-foreground text-sm cursor-help hover:text-foreground transition-colors">ⓘ</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Agent dispatch errors</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500" />
                        <span className="text-muted-foreground">Total number of active sessions</span>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Loading session data...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No session data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={0} barCategoryGap="20%">
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="errors" stackId="a" fill="#EF4444" radius={[0, 0, 4, 4]} barSize={40} />
                            <Bar dataKey="sessions" stackId="a" fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.sessions > 10 ? '#06B6D4' : 'rgba(6, 182, 212, 0.5)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
