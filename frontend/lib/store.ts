import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Auth Store - User session state
// ============================================================================
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// ============================================================================
// Settings Store - Dashboard preferences
// ============================================================================
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (seconds: number) => void;
  setTimeRange: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      autoRefresh: true,
      refreshInterval: 30,
      timeRange: '24h',
      setTheme: (theme) => set({ theme }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      setTimeRange: (timeRange) => set({ timeRange }),
    }),
    {
      name: 'settings-storage',
    }
  )
);

// ============================================================================
// Real-time Store - Live data from WebSocket
// ============================================================================
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

interface Participant {
  sid: string;
  identity: string;
  name: string;
  state: 'JOINING' | 'JOINED' | 'ACTIVE' | 'DISCONNECTED';
  joinedAt: number;
  permission: {
    canSubscribe: boolean;
    canPublish: boolean;
    canPublishData: boolean;
  };
  tracks: Track[];
}

interface Track {
  sid: string;
  type: 'AUDIO' | 'VIDEO' | 'DATA';
  name: string;
  muted: boolean;
  width?: number;
  height?: number;
  simulcast: boolean;
  source: 'CAMERA' | 'MICROPHONE' | 'SCREEN_SHARE' | 'SCREEN_SHARE_AUDIO' | 'UNKNOWN';
}

interface RealtimeState {
  rooms: Room[];
  participants: Record<string, Participant[]>; // roomName -> participants
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastUpdate: number;
  setRooms: (rooms: Room[]) => void;
  updateRoom: (room: Room) => void;
  removeRoom: (roomName: string) => void;
  setParticipants: (roomName: string, participants: Participant[]) => void;
  addParticipant: (roomName: string, participant: Participant) => void;
  removeParticipant: (roomName: string, participantSid: string) => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  rooms: [],
  participants: {},
  connectionStatus: 'disconnected',
  lastUpdate: 0,
  setRooms: (rooms) => set({ rooms, lastUpdate: Date.now() }),
  updateRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.name === room.name ? room : r)),
      lastUpdate: Date.now(),
    })),
  removeRoom: (roomName) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.name !== roomName),
      lastUpdate: Date.now(),
    })),
  setParticipants: (roomName, participants) =>
    set((state) => ({
      participants: { ...state.participants, [roomName]: participants },
      lastUpdate: Date.now(),
    })),
  addParticipant: (roomName, participant) =>
    set((state) => ({
      participants: {
        ...state.participants,
        [roomName]: [...(state.participants[roomName] || []), participant],
      },
      lastUpdate: Date.now(),
    })),
  removeParticipant: (roomName, participantSid) =>
    set((state) => ({
      participants: {
        ...state.participants,
        [roomName]: (state.participants[roomName] || []).filter(
          (p) => p.sid !== participantSid
        ),
      },
      lastUpdate: Date.now(),
    })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));

// ============================================================================
// Notifications Store - Toast notifications
// ============================================================================
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

interface NotificationsState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
