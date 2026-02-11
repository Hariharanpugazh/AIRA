# LiveKit Self-Hosted — Explanation & Usage

This document explains the design, purpose, and primary usage workflows for the LiveKit self-hosted admin dashboard project. It focuses on concepts, architecture, and how an operator or developer should think about using the system — not on installation or runtime commands.

## Project Purpose

This repository provides an admin/control plane for managing LiveKit-based deployments. It exposes multi-tenant project management, AI-driven agents, session/room orchestration, recording and transcription, SIP/telephony bridging, observability (metrics/audit logs), and automation rules.

The goal is to let organizations run LiveKit (real-time media) while operating a central dashboard that: creates rooms, manages tokens, configures agents (voice/text assistants), starts/stops recordings and egress jobs, and stores transcripts and audit records.

## High-level Architecture

- Backend (Rust): HTTP API implemented with Axum. Responsible for authentication, persistence (SeaORM), LiveKit orchestration, agent logic, ingress/egress handling, SIP integration, and background jobs.
- Frontend (Next.js): Admin UI that talks to the backend API to present dashboards, manage projects/agents, and view session details and transcripts.
- LiveKit Core: The real-time media layer (SFU, tracks, recordings). The backend instructs LiveKit to create rooms, generate tokens, and manage egress.
- External Integrations: STT/TTS/LLM providers for transcripts and agents, object storage for recordings, SIP trunks for telephony.

Key pieces and where to find them in the codebase:

- Backend wiring & routes: `backend/src/main.rs`
- Database entities: `backend/src/entity/*`
- API handlers: `backend/src/handlers/*`
- Service implementations (LiveKit, AI providers): `backend/src/services/*`
- DB migrations and seeds: `backend/migrations/*`
- Frontend API client: `frontend/lib/api.ts`
- Frontend UI pages and components: `frontend/app` and `frontend/components`

## Core Concepts

- Project: A tenant or logical namespace that groups agents, settings, storage, and permissions.
- Agent: A configured assistant (voice or LLM-backed bot) with properties such as model, voice, instructions, and behavior flags (e.g., allow interruption). Agent definitions are templates; Agent Instances are runtime copies attached to sessions.
- Session / Room: A LiveKit room representing an interaction. Sessions have lifecycle events, participants, recordings, and transcripts.
- Ingress: Bringing external audio/video (or SIP calls) into a LiveKit room.
- Egress: Recording or streaming out room media to storage or an external endpoint.
- Transcript: A time-aligned text output (STT) stored after recording or during sessions.
- Audit Log: Immutable records of system and admin actions for traceability.

## Primary Features (what the platform does)

- Multi-project management with per-project AI and storage configuration.
- Create, configure, and manage agents (voice/AI assistants).
- Start and control LiveKit sessions/rooms and attach agents.
- Record sessions and generate transcripts using pluggable STT providers.
- SIP telephony integration for inbound/outbound PSTN bridging.
- Egress workflows to save recordings or stream content to targets.
- Rules and automation for dispatching agents, triggering recordings, or starting egress based on conditions.
- Audit logging and metrics exposure for observability.

## Usage (operator / admin workflows)

These are conceptual workflows showing how someone uses the system day-to-day.

1) Onboard a Project
- Create a new `Project` entity to scope resources and settings.
- Configure project-level AI settings (STT/TTS/LLM provider choices and models) and storage targets for recordings.

2) Define Agents
- Add `Agent` definitions to a project with instructions, voice, model, and behaviour flags.
- Use the Welcome Message and instructions to shape an agent's role (IVR, assistant, moderator, etc.).

3) Run a Session with Agents
- Create a `Session` or room (ad-hoc or from templates) and invite participants.
- Attach one or more agents to the room; agent instances will be created and will join the session as participants.
- Use ingress to bring an external SIP call, audio stream, or media source into the room if needed.

4) Record and Transcribe
- Enable recording or egress for a session. The backend coordinates LiveKit to capture tracks and push them to storage or streaming endpoints.
- When recording/transcription is enabled, transcripts are created using the project's STT provider and stored alongside session metadata for search and review.

5) Telephony (SIP) Flows
- Configure SIP trunks and routing rules in `SIP` settings to map inbound PSTN calls to a project or a specific room/agent.
- Use the SIP integration for IVR flows, agent-assisted calls, or recording phone conversations into LiveKit sessions.

6) Monitoring and Troubleshooting
- Use analytics dashboard views to inspect active rooms, participant totals, and time-series metrics.
- Review audit logs for changes and security-related events.
- Check agent logs and transcripts to refine agent prompts and behavior.

7) Automation & Rules
- Create dispatch rules to automatically spawn agents when a session starts, or to start recording when conditions are met (e.g., participant count >= N).
- Use webhooks and rules to integrate downstream systems (e.g., ticketing, notifications) when sessions end or transcripts are available.

## Extensibility & Developer Guidance

- Adding a new AI/STT/TTS provider: Implement a service adapter in `backend/src/services` and add configuration surfaces to project AI settings. Surface provider choices in the frontend via the API.
- Extending Agent Behavior: Modify or add new services/handlers that manage Agent Instances; keep agent definitions stable in the DB and add migrations for new fields.
- New Egress/Storage Targets: Implement storage/egress adapters and add an egress configuration model so recordings can be routed to different sinks.
- Custom Rules/Workflows: Add new rule types in the rules handler and create corresponding UI components to let operators configure them.

## Operational Considerations (design-oriented)

- Migrations are run on startup; avoid editing applied migration files — add new migration files for schema changes.
- Treat sessions, transcripts, and audit logs as primary data; schema changes should preserve historical access.
- Tokens and API keys are per-project or global; design decisions about scoping affect how teams share or isolate access.
- LiveKit is the single source of truth for real-time media — the backend orchestrates and stores metadata but does not replace LiveKit's media capabilities.

## Where To Inspect Code (quick map)

- Backend entry & routes: `backend/src/main.rs`
- DB models / entities: `backend/src/entity/`
- Handlers and API routes: `backend/src/handlers/`
- Services (LiveKit, AI adapters): `backend/src/services/`
- Migrations: `backend/migrations/`
- Frontend API client: `frontend/lib/api.ts`
- Frontend UI: `frontend/app` and `frontend/components`

## Glossary

- LiveKit: Media server providing SFU, recording, and token-based auth.
- Ingress: Bringing external media (or SIP) into a LiveKit room.
- Egress: Persisting or streaming room media out of LiveKit.
- Agent: A configured assistant template; agent instance = runtime active participant.
- Audit Log: Immutable system event records for compliance.

## Next Steps (suggested improvements)

- Expand this explanation into a developer design doc including sequence diagrams and data model diagrams.
- Create an API reference document derived from `frontend/lib/api.ts` and the backend route handlers.
- Add a short Quickstart conceptual guide for new operators (what to configure first, what to expect when starting sessions).

---

If you want this written to `README.md` instead, or prefer separate developer docs (API reference, architecture diagram), tell me which one and I will create them next.
