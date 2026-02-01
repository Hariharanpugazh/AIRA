'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useRealtimeStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store';

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
  const response = await fetch('/api/livekit/rooms', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch rooms: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.rooms || [];
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
    const update = message.data as RoomUpdate;

    switch (message.type) {
      case 'room_started':
      case 'room_created':
        if (update.room) {
          updateRoom(update.room);
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
          updateRoom(update.room);
        }
        break;

      case 'rooms_update':
        // Bulk update all rooms
        const roomsData = message.data as { rooms: Room[] };
        if (roomsData.rooms) {
          setRooms(roomsData.rooms);
        }
        break;
    }
  }, [updateRoom, removeRoom, setRooms, queryClient]);

  // WebSocket connection for real-time updates
  const { isConnected, send, reconnect } = useWebSocket({
    url: enableWebSocket 
      ? `${typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'ws:'}//${typeof window !== 'undefined' ? window.location.host : 'localhost'}/api/ws/events`
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
