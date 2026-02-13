'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useRealtimeStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store';
import { apiFetch, getAccessToken, getApiWebSocketBaseUrl } from '@/lib/api';

interface Room {
  sid: string;
  name: string;
  numParticipants: number;
  numPublishers: number;
  maxParticipants: number;
  creationTime: number;
  turnPassword: string;
  enabledCodecs: string[];
  metadata: string;
  activeRecording: boolean;
}

interface RoomUpdate {
  type: 'room_created' | 'room_closed' | 'participant_joined' | 'participant_left' | 'track_published' | 'track_unpublished';
  room: Room;
  timestamp: string;
}

interface UseLiveRoomsOptions {
  pollInterval?: number;
  enableWebSocket?: boolean;
}

async function fetchRooms(): Promise<Room[]> {
  const data = await apiFetch<Array<{ sid: string; name: string; num_participants: number; creation_time: number; max_participants: number }>>('/api/livekit/rooms');
  return data.map((room) => ({
    sid: room.sid,
    name: room.name,
    numParticipants: room.num_participants,
    numPublishers: room.num_participants,
    maxParticipants: room.max_participants || 0,
    creationTime: room.creation_time,
    turnPassword: '',
    enabledCodecs: [],
    metadata: '',
    activeRecording: false,
  }));
}

export function useLiveRooms({ 
  pollInterval: customPollInterval, 
  enableWebSocket = true 
}: UseLiveRoomsOptions = {}) {
  const queryClient = useQueryClient();
  const { setRooms, updateRoom, removeRoom, connectionStatus } = useRealtimeStore();
  const { autoRefresh, refreshInterval } = useSettingsStore();
  
  // Determine poll interval
  const pollInterval = customPollInterval ?? (autoRefresh ? refreshInterval * 1000 : false);

  // Query for initial data and polling fallback
  const { 
    data: rooms = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    refetchInterval: typeof pollInterval === 'number' ? pollInterval : undefined,
    staleTime: 10000, // 10 seconds
  });

  // Sync to realtime store
  useEffect(() => {
    if (rooms.length > 0) {
      setRooms(rooms);
    }
  }, [rooms, setRooms]);

  // Handle WebSocket messages
  const handleMessage = useCallback((message: { type: string; data: unknown }) => {
    const normalizeRoom = (room: Record<string, unknown>): Room => ({
      sid: String(room.sid ?? ''),
      name: String(room.name ?? ''),
      numParticipants: Number(room.numParticipants ?? room.num_participants ?? 0),
      numPublishers: Number(room.numPublishers ?? room.num_publishers ?? room.num_participants ?? 0),
      maxParticipants: Number(room.maxParticipants ?? room.max_participants ?? 0),
      creationTime: Number(room.creationTime ?? room.creation_time ?? 0),
      turnPassword: String(room.turnPassword ?? ''),
      enabledCodecs: Array.isArray(room.enabledCodecs)
        ? (room.enabledCodecs as string[])
        : (Array.isArray(room.enabled_codecs) ? (room.enabled_codecs as string[]) : []),
      metadata: String(room.metadata ?? ''),
      activeRecording: Boolean(room.activeRecording ?? room.active_recording ?? false),
    });

    const update = message.data as RoomUpdate;

    switch (message.type) {
      case 'room_started':
      case 'room_created':
        if (update.room) {
          updateRoom(normalizeRoom(update.room as unknown as Record<string, unknown>));
          // Invalidate query to get fresh data
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
        }
        break;

      case 'room_finished':
      case 'room_closed':
        if (update.room?.name) {
          removeRoom(update.room.name);
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
        }
        break;

      case 'participant_joined':
      case 'participant_left':
      case 'track_published':
      case 'track_unpublished':
        if (update.room) {
          updateRoom(normalizeRoom(update.room as unknown as Record<string, unknown>));
        }
        break;

      case 'rooms_update':
        // Bulk update all rooms
        const roomsData = message.data as { rooms: Room[] };
        if (roomsData.rooms) {
          setRooms(
            roomsData.rooms.map((room) =>
              normalizeRoom(room as unknown as Record<string, unknown>)
            )
          );
        }
        break;
    }
  }, [updateRoom, removeRoom, setRooms, queryClient]);

  // WebSocket connection for real-time updates
  const { isConnected, send, reconnect } = useWebSocket({
    url: enableWebSocket
      ? (() => {
          if (typeof window === 'undefined') return '';
          const token = getAccessToken();
          const query = token ? `?token=${encodeURIComponent(token)}` : '';
          return `${getApiWebSocketBaseUrl()}/api/ws/events${query}`;
        })()
      : '',
    onMessage: handleMessage,
    onConnect: () => {
      // Subscribe to room events
      send({ type: 'subscribe', channels: ['rooms'] });
    },
  });

  return {
    rooms,
    isLoading,
    error,
    refetch,
    isConnected,
    connectionStatus,
    reconnect,
  };
}
