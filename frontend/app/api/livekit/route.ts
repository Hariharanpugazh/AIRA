/**
 * LiveKit Admin API Routes
 * 
 * This file provides API routes for the frontend admin dashboard
 * to interact with the self-hosted LiveKit server.
 * 
 * Routes:
 * - GET /api/livekit/rooms - List all rooms
 * - POST /api/livekit/rooms - Create a room
 * - DELETE /api/livekit/rooms/[name] - Delete a room
 * - GET /api/livekit/token - Generate access token
 * - GET /api/livekit/participants - List participants
 * - GET /api/livekit/health - Check LiveKit server health
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient, AccessToken, VideoGrant } from 'livekit-server-sdk';

// LiveKit Configuration - Production safe (no hardcoded secrets)
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'http://livekit:7880';  // Docker internal URL
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'ws://livekit:7880';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Validate required secrets at startup
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('FATAL: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
}

// Initialize Room Service Client
function getRoomService() {
    return new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

// =============================================================================
// ROOMS
// =============================================================================

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    try {
        switch (action) {
            case 'rooms':
                return await listRooms();
            case 'participants':
                const roomName = searchParams.get('room');
                if (!roomName) {
                    return NextResponse.json({ error: 'Room name required' }, { status: 400 });
                }
                return await listParticipants(roomName);
            case 'health':
                return await checkHealth();
            case 'stats':
                return await getStats();
            case 'token':
                const identity = searchParams.get('identity') || 'user';
                const room = searchParams.get('room') || 'default-room';
                return await generateToken(identity, room);
            default:
                return NextResponse.json({
                    message: 'LiveKit Admin API',
                    endpoints: [
                        'GET ?action=rooms - List all rooms',
                        'GET ?action=participants&room=<name> - List participants',
                        'GET ?action=health - Check server health',
                        'GET ?action=stats - Get server statistics',
                        'GET ?action=token&identity=<id>&room=<name> - Generate token',
                        'POST - Create a room',
                        'DELETE - Delete a room',
                    ]
                });
        }
    } catch (error) {
        console.error('LiveKit API Error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to LiveKit server', details: String(error) },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, roomName, options } = body;

        switch (action) {
            case 'create-room':
                return await createRoom(roomName, options);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('LiveKit API Error:', error);
        return NextResponse.json(
            { error: 'Failed to process request', details: String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomName } = body;

        if (!roomName) {
            return NextResponse.json({ error: 'Room name required' }, { status: 400 });
        }

        const roomService = getRoomService();
        await roomService.deleteRoom(roomName);

        return NextResponse.json({ success: true, message: `Room ${roomName} deleted` });
    } catch (error) {
        console.error('LiveKit API Error:', error);
        return NextResponse.json(
            { error: 'Failed to delete room', details: String(error) },
            { status: 500 }
        );
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function listRooms() {
    const roomService = getRoomService();
    const rooms = await roomService.listRooms();

    return NextResponse.json({
        rooms: rooms.map(room => ({
            sid: room.sid,
            name: room.name,
            numParticipants: room.numParticipants,
            numPublishers: room.numPublishers,
            maxParticipants: room.maxParticipants,
            creationTime: room.creationTime ? new Date(Number(room.creationTime) * 1000).toISOString() : null,
            emptyTimeout: room.emptyTimeout,
            departureTimeout: room.departureTimeout,
        })),
        count: rooms.length,
    });
}

async function listParticipants(roomName: string) {
    const roomService = getRoomService();
    const participants = await roomService.listParticipants(roomName);

    return NextResponse.json({
        participants: participants.map(p => ({
            sid: p.sid,
            identity: p.identity,
            name: p.name,
            state: p.state,
            joinedAt: p.joinedAt ? new Date(Number(p.joinedAt) * 1000).toISOString() : null,
            isPublisher: p.isPublisher,
            tracks: p.tracks?.length || 0,
        })),
        count: participants.length,
    });
}

async function createRoom(roomName: string, options: Record<string, unknown> = {}) {
    const roomService = getRoomService();

    const room = await roomService.createRoom({
        name: roomName,
        emptyTimeout: options.emptyTimeout as number || 300,
        maxParticipants: options.maxParticipants as number || 100,
    });

    return NextResponse.json({
        success: true,
        room: {
            sid: room.sid,
            name: room.name,
            emptyTimeout: room.emptyTimeout,
            maxParticipants: room.maxParticipants,
        },
    });
}

async function checkHealth() {
    try {
        const response = await fetch(`${LIVEKIT_URL}/healthz`);
        const healthy = response.ok;

        return NextResponse.json({
            status: healthy ? 'healthy' : 'unhealthy',
            serverUrl: LIVEKIT_URL,
            wsUrl: LIVEKIT_WS_URL,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({
            status: 'unreachable',
            error: String(error),
            serverUrl: LIVEKIT_URL,
            timestamp: new Date().toISOString(),
        });
    }
}

async function getStats() {
    const roomService = getRoomService();
    const rooms = await roomService.listRooms();

    let totalParticipants = 0;
    let totalPublishers = 0;

    for (const room of rooms) {
        totalParticipants += room.numParticipants || 0;
        totalPublishers += room.numPublishers || 0;
    }

    return NextResponse.json({
        activeRooms: rooms.length,
        totalParticipants,
        totalPublishers,
        timestamp: new Date().toISOString(),
    });
}

async function generateToken(identity: string, roomName: string) {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        ttl: '1h',
    });

    const grant: VideoGrant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
    };

    token.addGrant(grant);

    const jwt = await token.toJwt();

    return NextResponse.json({
        token: jwt,
        identity,
        roomName,
        wsUrl: LIVEKIT_WS_URL,
        expiresIn: '1h',
    });
}
