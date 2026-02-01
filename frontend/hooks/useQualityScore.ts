'use client';

import { useMemo } from 'react';

/**
 * Connection statistics used for quality calculation
 */
export interface ConnectionStats {
  rtt: number;              // Round-trip time in ms
  jitter: number;           // Jitter in ms
  packetLoss: number;       // Packet loss rate (0-1)
  bitrate: number;          // Current bitrate in bps
  targetBitrate: number;    // Target/max bitrate in bps
  framesDropped?: number;   // Video frames dropped
  framesReceived?: number;  // Total video frames received
  audioLevel?: number;      // Audio input level (0-1)
  timestamp?: number;       // Measurement timestamp
}

/**
 * Quality score result with detailed breakdown
 */
export interface QualityResult {
  score: 0 | 1 | 2 | 3 | 4; // 0=unknown, 1=poor, 2=fair, 3=good, 4=excellent
  label: 'unknown' | 'poor' | 'fair' | 'good' | 'excellent';
  mos: number;              // Mean Opinion Score (1-5 scale)
  factors: string[];        // Contributing factors
  recommendations: string[]; // Suggested improvements
}

/**
 * Thresholds for quality scoring
 */
const THRESHOLDS = {
  rtt: { excellent: 50, good: 100, fair: 200 },           // ms
  jitter: { excellent: 10, good: 30, fair: 50 },          // ms
  packetLoss: { excellent: 0.005, good: 0.02, fair: 0.05 }, // fraction
  bitrateRatio: { excellent: 0.9, good: 0.7, fair: 0.5 }, // actual/target
};

/**
 * Calculate Mean Opinion Score (MOS) using E-model simplified formula
 * Based on ITU-T G.107 / G.109 standards
 */
function calculateMOS(stats: ConnectionStats): number {
  // R-factor calculation (simplified E-model)
  // R = 93.2 - Id - Ie-eff where:
  // Id = delay impairment
  // Ie-eff = equipment impairment (packet loss)
  
  const baseR = 93.2;
  
  // Delay impairment (Id) - based on one-way delay
  const oneWayDelay = stats.rtt / 2;
  let Id = 0;
  if (oneWayDelay > 177.3) {
    Id = 0.024 * oneWayDelay + 0.11 * (oneWayDelay - 177.3);
  } else {
    Id = 0.024 * oneWayDelay;
  }
  
  // Jitter impairment contribution
  const jitterImpairment = stats.jitter * 0.1;
  
  // Equipment impairment (Ie-eff) - based on packet loss
  // Using codec-agnostic approximation
  const packetLossPercent = stats.packetLoss * 100;
  const burstRatio = 1; // Assume random loss (no burst)
  const Ie_eff = 0 + 95 * (packetLossPercent / (packetLossPercent + burstRatio));
  
  // Calculate R-factor
  const R = Math.max(0, Math.min(100, baseR - Id - Ie_eff - jitterImpairment));
  
  // Convert R-factor to MOS
  // MOS = 1 + 0.035*R + R*(R-60)*(100-R)*7*10^-6
  let MOS: number;
  if (R < 0) {
    MOS = 1;
  } else if (R > 100) {
    MOS = 4.5;
  } else {
    MOS = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  }
  
  return Math.round(MOS * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine quality score based on MOS and connection stats
 */
function determineScore(mos: number, stats: ConnectionStats): QualityResult['score'] {
  // MOS-based primary scoring
  if (mos >= 4.0) return 4; // excellent
  if (mos >= 3.5) return 3; // good
  if (mos >= 2.5) return 2; // fair
  if (mos >= 1.5) return 1; // poor
  return 1; // poor
}

/**
 * Get quality label from score
 */
function getLabel(score: QualityResult['score']): QualityResult['label'] {
  const labels: Record<QualityResult['score'], QualityResult['label']> = {
    0: 'unknown',
    1: 'poor',
    2: 'fair',
    3: 'good',
    4: 'excellent',
  };
  return labels[score];
}

/**
 * Analyze contributing factors
 */
function analyzeFactors(stats: ConnectionStats): string[] {
  const factors: string[] = [];
  
  if (stats.rtt > THRESHOLDS.rtt.fair) {
    factors.push(`High latency: ${Math.round(stats.rtt)}ms RTT`);
  } else if (stats.rtt > THRESHOLDS.rtt.good) {
    factors.push(`Moderate latency: ${Math.round(stats.rtt)}ms RTT`);
  }
  
  if (stats.jitter > THRESHOLDS.jitter.fair) {
    factors.push(`High jitter: ${Math.round(stats.jitter)}ms`);
  } else if (stats.jitter > THRESHOLDS.jitter.good) {
    factors.push(`Moderate jitter: ${Math.round(stats.jitter)}ms`);
  }
  
  if (stats.packetLoss > THRESHOLDS.packetLoss.fair) {
    factors.push(`High packet loss: ${(stats.packetLoss * 100).toFixed(1)}%`);
  } else if (stats.packetLoss > THRESHOLDS.packetLoss.good) {
    factors.push(`Moderate packet loss: ${(stats.packetLoss * 100).toFixed(2)}%`);
  }
  
  const bitrateRatio = stats.bitrate / stats.targetBitrate;
  if (bitrateRatio < THRESHOLDS.bitrateRatio.fair) {
    factors.push(`Low bitrate: ${Math.round(stats.bitrate / 1000)}kbps (${Math.round(bitrateRatio * 100)}% of target)`);
  } else if (bitrateRatio < THRESHOLDS.bitrateRatio.good) {
    factors.push(`Reduced bitrate: ${Math.round(stats.bitrate / 1000)}kbps`);
  }
  
  if (stats.framesDropped && stats.framesReceived) {
    const dropRate = stats.framesDropped / (stats.framesReceived + stats.framesDropped);
    if (dropRate > 0.05) {
      factors.push(`Frame drops: ${(dropRate * 100).toFixed(1)}%`);
    }
  }
  
  return factors;
}

/**
 * Generate recommendations for improvement
 */
function generateRecommendations(stats: ConnectionStats, score: QualityResult['score']): string[] {
  const recommendations: string[] = [];
  
  if (stats.rtt > THRESHOLDS.rtt.good) {
    recommendations.push('Consider using a closer server region');
    recommendations.push('Check for network congestion');
  }
  
  if (stats.jitter > THRESHOLDS.jitter.good) {
    recommendations.push('Network stability issue - consider wired connection');
    recommendations.push('Check for competing network traffic');
  }
  
  if (stats.packetLoss > THRESHOLDS.packetLoss.good) {
    recommendations.push('Enable packet loss concealment');
    recommendations.push('Check for wireless interference');
    recommendations.push('Consider reducing video quality to prioritize reliability');
  }
  
  const bitrateRatio = stats.bitrate / stats.targetBitrate;
  if (bitrateRatio < THRESHOLDS.bitrateRatio.good) {
    recommendations.push('Bandwidth constrained - reduce resolution or framerate');
    recommendations.push('Check for bandwidth-heavy applications');
  }
  
  if (score <= 2 && recommendations.length === 0) {
    recommendations.push('General network issues detected - try refreshing connection');
  }
  
  return recommendations;
}

/**
 * Hook to calculate connection quality score from stats
 */
export function useQualityScore(stats: ConnectionStats | null): QualityResult {
  return useMemo(() => {
    if (!stats) {
      return {
        score: 0,
        label: 'unknown',
        mos: 0,
        factors: [],
        recommendations: [],
      };
    }
    
    const mos = calculateMOS(stats);
    const score = determineScore(mos, stats);
    const label = getLabel(score);
    const factors = analyzeFactors(stats);
    const recommendations = generateRecommendations(stats, score);
    
    return {
      score,
      label,
      mos,
      factors,
      recommendations,
    };
  }, [stats]);
}

/**
 * Utility to get quality color based on score
 */
export function getQualityColor(score: QualityResult['score']): string {
  const colors: Record<QualityResult['score'], string> = {
    0: 'text-gray-400',
    1: 'text-red-500',
    2: 'text-yellow-500',
    3: 'text-green-400',
    4: 'text-green-500',
  };
  return colors[score];
}

/**
 * Utility to get quality background color based on score
 */
export function getQualityBgColor(score: QualityResult['score']): string {
  const colors: Record<QualityResult['score'], string> = {
    0: 'bg-gray-400/20',
    1: 'bg-red-500/20',
    2: 'bg-yellow-500/20',
    3: 'bg-green-400/20',
    4: 'bg-green-500/20',
  };
  return colors[score];
}
