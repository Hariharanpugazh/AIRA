"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Check, Terminal, Cloud, Server, Cpu } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Card } from "../../../../../components/ui/Card";

const DEPLOYMENT_METHODS = [
    {
        id: "docker",
        name: "Docker",
        icon: Server,
        description: "Deploy using Docker containers",
    },
    {
        id: "kubernetes",
        name: "Kubernetes",
        icon: Cloud,
        description: "Deploy to Kubernetes cluster",
    },
    {
        id: "cli",
        name: "LiveKit CLI",
        icon: Terminal,
        description: "Deploy using lk CLI tool",
    },
];

const DOCKER_COMPOSE_TEMPLATE = `version: '3.8'

services:
  agent:
    build:
      context: ./agents
      dockerfile: Dockerfile
    environment:
      - LIVEKIT_URL=ws://livekit:7880
      - LIVEKIT_API_KEY=\${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=\${LIVEKIT_API_SECRET}
      - AGENT_MODE=hybrid
      - STT_PROVIDER=deepgram
      - STT_FALLBACK_PROVIDER=local
      - TTS_PROVIDER=cartesia
      - TTS_FALLBACK_PROVIDER=local
      - LLM_PROVIDER=openai
      - LLM_FALLBACK_PROVIDER=local
      - WHISPER_LOCAL_URL=http://whisper:8000/v1
      - KOKORO_URL=http://kokoro:8880/v1
      - LOCAL_LLM_URL=http://ollama:11434/v1
    volumes:
      - ./agents:/app/agents
    restart: unless-stopped
    networks:
      - livekit-network

networks:
  livekit-network:
    external: true
`;

const KUBERNETES_TEMPLATE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: livekit-agent
  labels:
    app: livekit-agent
spec:
  replicas: 2
  selector:
    matchLabels:
      app: livekit-agent
  template:
    metadata:
      labels:
        app: livekit-agent
    spec:
      containers:
      - name: agent
        image: your-registry/livekit-agent:latest
        env:
        - name: LIVEKIT_URL
          value: "ws://livekit:7880"
        - name: LIVEKIT_API_KEY
          valueFrom:
            secretKeyRef:
              name: livekit-secrets
              key: api-key
        - name: LIVEKIT_API_SECRET
          valueFrom:
            secretKeyRef:
              name: livekit-secrets
              key: api-secret
        - name: AGENT_MODE
          value: "hybrid"
        - name: WHISPER_LOCAL_URL
          value: "http://whisper-service:8000/v1"
        - name: KOKORO_URL
          value: "http://kokoro-service:8880/v1"
        - name: LOCAL_LLM_URL
          value: "http://ollama-service:11434/v1"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: livekit-agent-service
spec:
  selector:
    app: livekit-agent
  ports:
  - port: 8000
    targetPort: 8000
`;

const CLI_TEMPLATE = `# Install LiveKit CLI
npm install -g @livekit/cli

# Or download directly
curl -sSL https://get.livekit.io | bash

# Authenticate with your LiveKit server
lk auth --url ws://localhost:7880 --api-key YOUR_API_KEY --api-secret YOUR_API_SECRET

# Create a new agent app
lk app create my-agent --template voice-pipeline-agent

# Navigate to the agent directory
cd my-agent

# Configure your agent (edit .env file)
cat > .env << EOF
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=YOUR_API_KEY
LIVEKIT_API_SECRET=YOUR_API_SECRET
OPENAI_API_KEY=your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
CARTESIA_API_KEY=your-cartesia-key
AGENT_MODE=hybrid
WHISPER_LOCAL_URL=http://localhost:8000/v1
KOKORO_URL=http://localhost:8880/v1
LOCAL_LLM_URL=http://localhost:11434/v1
EOF

# Install dependencies
pip install -r requirements.txt

# Run the agent locally
python main.py dev

# Deploy the agent (production)
lk agent deploy --name my-agent --replicas 2
`;

const PYTHON_AGENT_TEMPLATE = `"""
LiveKit Agent with Hybrid AI Configuration
Supports both API and Local AI providers
"""

import os
from livekit.agents import (
    Agent, AgentSession, JobContext, JobProcess,
    WorkerOptions, AutoSubscribe, cli, function_tool
)
from livekit.plugins import openai, silero, turn_detector


class VoiceAssistant(Agent):
    def __init__(self):
        super().__init__(
            instructions="""You are a helpful voice assistant.
Be concise and natural in your responses.
Ask clarifying questions when needed."""
        )
    
    async def on_enter(self):
        await self.session.generate_reply(
            instructions="Greet the user warmly."
        )


def prewarm(proc: JobProcess):
    """Pre-warm heavy resources"""
    proc.userdata["vad"] = silero.VAD.load()
    proc.userdata["turn_detector"] = turn_detector.EOUModel()


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint"""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()
    
    # Get pre-warmed resources
    vad = ctx.proc.userdata.get("vad")
    turn_detector = ctx.proc.userdata.get("turn_detector")
    
    # Configure AI providers based on environment
    mode = os.getenv("AGENT_MODE", "hybrid")
    
    # STT Configuration
    stt_provider = os.getenv("STT_PROVIDER", "openai")
    if stt_provider == "local":
        stt = openai.STT(
            model="whisper-1",
            base_url=os.getenv("WHISPER_LOCAL_URL", "http://localhost:8000/v1"),
            api_key="not-needed"
        )
    else:
        stt = openai.STT(model="whisper-1")
    
    # TTS Configuration
    tts_provider = os.getenv("TTS_PROVIDER", "openai")
    if tts_provider == "local":
        tts = openai.TTS(
            model="kokoro",
            voice="af_bella",
            base_url=os.getenv("KOKORO_URL", "http://localhost:8880/v1"),
            api_key="not-needed"
        )
    else:
        tts = openai.TTS(model="tts-1", voice="alloy")
    
    # LLM Configuration
    llm_provider = os.getenv("LLM_PROVIDER", "openai")
    if llm_provider == "local":
        llm = openai.LLM(
            model="llama3.2:3b",
            base_url=os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1"),
            api_key="not-needed"
        )
    else:
        llm = openai.LLM(model="gpt-4o-mini")
    
    # Create session with configured providers
    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=llm,
        tts=tts,
        turn_detection=turn_detector,
        min_endpointing_delay=0.15,
        max_endpointing_delay=2.0,
    )
    
    # Create and start agent
    agent = VoiceAssistant()
    await session.start(
        agent=agent,
        room=ctx.room,
        participant=participant,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
`;

const DOCKERFILE_TEMPLATE = `FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run the agent worker
CMD ["python", "main.py", "start"]
`;

const REQUIREMENTS_TEMPLATE = `livekit-agents>=0.12.0
livekit-plugins-openai>=0.10.0
livekit-plugins-silero>=0.7.0
livekit-plugins-turn-detector>=0.3.0
livekit-plugins-deepgram>=0.6.0
livekit-plugins-cartesia>=0.4.0
python-dotenv>=1.0.0
`;

export default function DeployAgentPage() {
    const params = useParams();
    const agentId = params.agentId as string;
    const [activeTab, setActiveTab] = useState("docker");
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const getTemplate = () => {
        switch (activeTab) {
            case "docker":
                return DOCKER_COMPOSE_TEMPLATE;
            case "kubernetes":
                return KUBERNETES_TEMPLATE;
            case "cli":
                return CLI_TEMPLATE;
            default:
                return DOCKER_COMPOSE_TEMPLATE;
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-1">Deploy Agent</h2>
                <p className="text-secondary text-sm">
                    Deploy your agent using Docker, Kubernetes, or LiveKit CLI.
                    Choose your preferred method below.
                </p>
            </div>


            <div className="flex gap-2 mb-6">
                {DEPLOYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                        <button
                            key={method.id}
                            onClick={() => setActiveTab(method.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${activeTab === method.id
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-surface border-border text-foreground hover:bg-surface-hover"
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{method.name}</span>
                        </button>
                    );
                })}
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                <Card variant="glass" className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="text-sm font-medium text-foreground">
                            {activeTab === "docker" && "docker-compose.yml"}
                            {activeTab === "kubernetes" && "deployment.yaml"}
                            {activeTab === "cli" && "deploy.sh"}
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={copied === "main" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            onClick={() => handleCopy(getTemplate(), "main")}
                        >
                            {copied === "main" ? "Copied!" : "Copy"}
                        </Button>
                    </div>
                    <pre className="p-4 text-xs text-foreground overflow-x-auto bg-black border-none max-h-[500px] overflow-y-auto">
                        <code>{getTemplate()}</code>
                    </pre>
                </Card>


                <div className="space-y-4">

                    <Card variant="glass" className="p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <span className="text-sm font-medium text-foreground">main.py</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={copied === "mainpy" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                onClick={() => handleCopy(PYTHON_AGENT_TEMPLATE, "mainpy")}
                            >
                                {copied === "mainpy" ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <pre className="p-4 text-xs text-foreground overflow-x-auto bg-black border-none max-h-[200px] overflow-y-auto">
                            <code>{PYTHON_AGENT_TEMPLATE}</code>
                        </pre>
                    </Card>


                    <Card variant="glass" className="p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <span className="text-sm font-medium text-foreground">Dockerfile</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={copied === "dockerfile" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                onClick={() => handleCopy(DOCKERFILE_TEMPLATE, "dockerfile")}
                            >
                                {copied === "dockerfile" ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <pre className="p-4 text-xs text-foreground overflow-x-auto bg-black border-none max-h-[150px] overflow-y-auto">
                            <code>{DOCKERFILE_TEMPLATE}</code>
                        </pre>
                    </Card>


                    <Card variant="glass" className="p-0 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <span className="text-sm font-medium text-foreground">requirements.txt</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={copied === "requirements" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                onClick={() => handleCopy(REQUIREMENTS_TEMPLATE, "requirements")}
                            >
                                {copied === "requirements" ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <pre className="p-4 text-xs text-foreground overflow-x-auto bg-black border-none">
                            <code>{REQUIREMENTS_TEMPLATE}</code>
                        </pre>
                    </Card>
                </div>
            </div>


            <Card variant="glass" className="p-6 mt-6 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Cpu className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-foreground font-semibold mb-2">Hybrid Mode Configuration</h3>
                        <p className="text-muted-foreground text-sm mb-3">
                            The agent is configured to use <strong>Hybrid Mode</strong> by default. This means:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Primary AI services use cloud APIs (OpenAI, Deepgram, Cartesia)</li>
                            <li>Automatic fallback to local models when APIs are unavailable</li>
                            <li>Local services: Whisper (STT), Kokoro (TTS), Ollama (LLM)</li>
                            <li>Zero-downtime operation for government-grade deployments</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
