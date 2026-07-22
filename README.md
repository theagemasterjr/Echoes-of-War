# Echoes of War

An interactive, cinematic journey through six chapters of the Second World War —
built for the Prometheus July AI Challenge. Players explore a 3D tabletop war-room
map, and each chapter centers on a **live AI conversation** with a fictional
composite character grounded in documented experiences, followed by a short
check-your-understanding activity.

The AI characters run through a shared constraint-tree engine: a per-chapter JSON
tree defines the persona, knowledge boundaries, and staged conversation route; the
engine enforces guardrails, tracks learning points, and steers the dialogue. A fast
model screens input and checks coverage; a stronger model plays the character.

## Run locally

```bash
npm install
# create .env.local containing:  ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000. Without a key everything works except live
conversations (the character asks you to repeat, by design).

## Deploy (Vercel)

1. Import the GitHub repo into Vercel (framework auto-detected: Next.js).
2. Add the `ANTHROPIC_API_KEY` environment variable in Project Settings.
3. Deploy. `/api/health` reports whether the key is present.

## For the team

- **Fill in a chapter:** see `docs/chapter-guide.md`.
- **Generate the real 3D models:** see `docs/model-prompts.md` (Meshy prompts).
- **Debug menu:** type `debug` anywhere in the app — jump to any chapter/beat,
  reset the save, or open the character test screen.
