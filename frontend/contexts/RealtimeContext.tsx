'use client';

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRealtimeStore } from '@/lib/store';
import { getAccessToken, getApiWebSocketBaseUrl } from '@/lib/api';

interface RealtimeContextValue {
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastUpdate: number;
  reconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
  wsUrl?: string;
}

export function RealtimeProvider({ children, wsUrl }: RealtimeProviderProps) {
  const { 
    connectionStatus, 
    lastUpdate, 
    setConnectionStatus,
    setRooms,
    updateRoom,
    removeRoom,
    addParticipant,
    removeParticipant,
  } = useRealtimeStore();

  const defaultWsUrl = typeof window !== 'undefined' 
    ? `${getApiWebSocketBaseUrl()}/api/ws/events${getAccessToken() ? `?token=${encodeURIComponent(getAccessToken() || '')}` : ''}`
    : 'ws://localhost:8000/api/ws/events';

  const { isConnected, send, reconnect } = useWebSocket({
    url: wsUrl || defaultWsUrl,
    onMessage: (message) => {
      const normalizeRoom = (room: Record<string, unknown>) => ({
        sid: String(room.sid ?? ""),
        name: String(room.name ?? ""),
        numParticipants: Number(room.numParticipants ?? room.num_participants ?? 0),
        numPublishers: Number(room.numPublishers ?? room.num_publishers ?? room.num_participants ?? 0),
        maxParticipants: Number(room.maxParticipants ?? room.max_participants ?? 0),
        creationTime: Number(room.creationTime ?? room.creation_time ?? 0),
        turnPassword: String(room.turnPassword ?? ''),
        enabledCodecs: Array.isArray(room.enabledCodecs)
          ? room.enabledCodecs
          : (Array.isArray(room.enabled_codecs) ? room.enabled_codecs : []),
        metadata: String(room.metadata ?? ''),
        activeRecording: Boolean(room.activeRecording ?? room.active_recording ?? false),
      });

      switch (message.type) {
        case 'rooms_list':
          const roomsData = message.data as { rooms: unknown[] };
          setRooms(
            (roomsData.rooms || []).map((room) => normalizeRoom(room as Record<string, unknown>)) as never[]
          );
          break;

        case 'room_started':
        case 'room_updated':
          const roomData = message.data as { room: never };
          if (roomData.room) {
            updateRoom(normalizeRoom(roomData.room as unknown as Record<string, unknown>));
          }
          break;

        case 'room_finished':
          const finishedRoom = message.data as { room: { name: string } };
          if (finishedRoom.room?.name) {
            removeRoom(finishedRoom.room.name);
          }
          break;

        case 'participant_joined':
          const joinData = message.data as { roomName: string; participant: never };
          if (joinData.roomName && joinData.participant) {
            addParticipant(joinData.roomName, joinData.participant);
          }
          break;

        case 'participant_left':
          const leaveData = message.data as { roomName: string; participantSid: string };
          if (leaveData.roomName && leaveData.participantSid) {
            removeParticipant(leaveData.roomName, leaveData.participantSid);
          }
          break;

        case 'stats_update':
          // Handle real-time stats updates
          break;

        case 'error':
          console.error('WebSocket error:', message.data);
          break;
      }
    },
    onConnect: () => {
      setConnectionStatus('connected');
      // Subscribe to default channels
      send({ type: 'subscribe', channels: ['rooms', 'participants', 'stats'] });
    },
    onDisconnect: () => {
      setConnectionStatus('disconnected');
    },
    onError: () => {
      setConnectionStatus('error');
    },
  });

  const subscribe = (channel: string) => {
    if (isConnected) {
      send({ type: 'subscribe', channels: [channel] });
    }
  };

  const unsubscribe = (channel: string) => {
    if (isConnected) {
      send({ type: 'unsubscribe', channels: [channel] });
    }
  };

  // Sync connection status from WebSocket
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected, setConnectionStatus]);

  const value: RealtimeContextValue = {
    isConnected,
    connectionStatus,
    lastUpdate,
    reconnect,
    subscribe,
    unsubscribe,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
