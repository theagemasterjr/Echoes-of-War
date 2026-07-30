![alt text](image.png)

# Echoes of War

> *World War II history you don't just read. You speak to it.*

**▶ Play it now: [echoes-of-war-chi.vercel.app](https://echoes-of-war-chi.vercel.app)**
Nothing to install, no sign-up. Best in Chrome and desktop, with sound on.

---

## Inspiration

History is locked behind **walls of text**, and for dyslexic kids, that wall is a door that never opens.

According to the Yale Center for Dyslexia, around **1 in 5 kids have dyslexia**. Most of them are just as curious about history as anyone else, but almost everything we use to teach it is dense reading: thick textbooks, long paragraphs, small print, complicated words. So the kids who struggle with reading get labeled as **"bad at history"** when they were never actually given a fair way in. They don't lack curiosity or intelligence. **They lack a format.**

And it's not only dyslexic kids. Most kids read a chapter, pass the quiz, and forget it, because reading about people isn't the same as **meeting them**. Facts without a human attached don't stick. That's the wall Echoes of War was built to remove.

## What it does

Echoes of War is a **voice-powered World War II learning adventure**. Kids don't read about the war. **They walk into it and talk to it.** Players progress through **six chapters**:

**Chapter 1: The Spark** — Talk with Zofia, a student in 1930s Warsaw, and piece together how one unfair peace treaty set the world on the road to war.

**Chapter 2: Standing Alone** — Meet Tom, a young Spitfire pilot in Kent, and learn how Britain fought off an air assault the summer it stood alone.

**Chapter 3: A World at War** — Stand with Ray, a US Navy sailor at Pearl Harbor, on the morning the war became the whole world's war.

**Chapter 4: Turning the Tide** — Join Nikolai, a front-line medic in the ruins of Stalingrad, days after the battle that turned the war around.

**Chapter 5: The Road Back** — Talk with Ted, a medical orderly in Normandy, and uncover how a secret trick and one weather forecast made D-Day possible.

**Chapter 6: The Cost of Victory** — Sit with Dr. Hale in Hiroshima as the war ends, and hear four voices from the same morning — then decide what you think for yourself.

Each chapter opens with a cinematic mission brief that sets the stakes and asks one question: **do you accept?**

Inside each chapter, players sit across from a person from the past and hold **live spoken conversations** with AI characters. They ask their own questions, in their own words, and the character answers back with lifelike voice and a synced talking animation, in **short, spoken-style sentences shown one at a time like film subtitles**. Never a paragraph, never jargon. Every screen uses **plain everyday words**, an optional **dyslexia-friendly font (OpenDyslexic)**, and **voice narration** so kids can listen instead of read, which is beneficial for students with dyslexia.

Learning is checked through **conversation and hands-on minigames**, never a reading-comprehension quiz. Behind the scenes, an intent classification system listens to every question, figures out which learning objective it relates to, and checks it off in real time, so progress always reflects **real understanding**. After the final chapter, an end-of-game screen celebrates the journey with a recap of every chapter.

The result: a dyslexic kid and a bookworm have the **exact same experience**, ask the same questions, and walk away knowing the same history. Reading speed stops mattering. **Curiosity is the only requirement.**

## How we built it

The core loop is **speech in, speech out**. The player's voice is captured with a smart silence buffer so pauses to think never cut them off. The character's reply is converted to speech using the **ElevenLabs Flash v2.5** model, chosen for its speed and natural delivery, and text and talking animations are **gated on actual audio playback** so words and sound always line up.

The heart of the project is our **LLM constraining system**, built to solve a hard problem: a free-talking AI character in a kids' history game can drift off topic, invent facts, break character, or be tricked by players. The constraint tree keeps every conversation **safe, accurate, and on a teaching path** while still letting kids ask anything in their own words.

Every character is defined by a **constraint tree, not a prompt**. Each chapter's character is a single data file: who they are (name, role, exact date and place, voice), what they know, what they **cannot** know (anything after their moment in time), how they deflect questions at the edge of their knowledge, and a staged route of **learning objectives** the conversation must eventually teach. The character's instructions are then **rebuilt every single turn**: universal guardrails (kid-friendly plain language, short subtitle-sized sentences, stay in period, never glorify war, never break character), plus the persona, the knowledge boundaries, the rules for the current stage, and the learning objectives that have not come up yet. The character always answers what the kid actually asked, but is constantly steered toward what is left to teach.

The architecture is **one strong model acting with four watchers on it — three cheap models and a rule-based checker**. Every player message is **screened before the character ever sees it**: a small, fast model (GPT-4o-mini) checks for abuse and jailbreak attempts like "ignore your instructions," and flagged messages never reach the character. The player instead gets a pre-written, in-character deflection, with rate limiting in front of everything. **GPT-4o plays the character**, hard-capped in length so replies stay subtitle-sized. In parallel, adding **zero latency**, GPT-4o-mini classifies which objective the player's question is about.

**Learning is measured, not assumed.** As a student talks with a character, the app quietly checks whether the history is actually being learned. Two separate checks run after every reply: one looks for real topic words in the character's answers (needing more than one signal, so a single stray word never counts), and an **AI grader** reads the whole conversation and asks "was this idea really explained?" — so an answer in everyday kid language still counts. Credit only comes from what the character actually taught; a student just asking about a topic doesn't tick the box. Students are never locked in, they can move on whenever they're ready, but if objectives are still unfinished, the app checks first and gently encourages them to stay and keep learning.

**Everything fails safely.** If anything goes wrong behind the scenes — a check errors, the internet hiccups — the conversation keeps going: the character simply asks the student to repeat themselves, in character, and a missed check just catches up on the next reply. The screen never breaks or goes blank. And a permanent **"AI-generated, may contain errors"** label stays on screen at all times during conversations, so students and teachers always know they're talking to an AI.

On top of that sits the game layer: chapter briefs, scrollable mission text, responsive character models that stay centered on any screen, minigames per chapter, and rate limits tuned so a player can complete all six chapters in one sitting with room to spare.

## Challenges we ran into

The hardest problem was **constraining a free-talking AI**. Our original objective tracker was hit or miss, sometimes failing even when players said an objective word for word, and an unconstrained character could drift, invent facts, or be tricked. Solving it meant rethinking the architecture into the **constraint tree system**: a dedicated intent classifier where "no match" is the default, dual grading of what was actually taught, and pre-screening of every message before the character sees it.

**Audio sync** was another battle. Early builds showed text and started animations before any sound played, which broke the illusion instantly. We had to restructure the pipeline so everything waits for real audio playback, while also attacking latency at the root so responses feel immediate.

We also fought plenty of classic game bugs: character models that behaved in debug mode but drifted in the normal flow, background text bleeding into minigame letters, and mission briefs that locked scrolling unless you skipped them.

**Accessibility** was a challenge we did not fully see until real users showed us. We ran a **pilot program with 10 dyslexic players**, and their early feedback was humbling: without a dyslexic-friendly font or text-to-speech, the experience felt **too fast-paced** and it was **confusing for them to retain information**. That feedback reshaped our priorities. We added the **OpenDyslexic font** and **full voice narration** so every part of the game can be heard, not just read, making Echoes of War far more accessible.

After using the accessibility features, **9 out of 10** participants said that the narration made the historical content easier to follow, and **8 out of 10** said they would prefer learning history through Echoes of War over a traditional textbook lesson.

## Accomplishments that we're proud of

We built a **full six-chapter experience** where every major interaction happens through natural speech. Our **constraint tree architecture**, one strong model acting with four watchers on it, keeps characters **safe, historically accurate, and always on a teaching path** while staying low cost, and a writer-editable data file decides what each character is allowed to be. Objective tracking rewards **genuine understanding** instead of keyword luck, since only what the character actually teaches earns credit. The conversation flow feels alive: fast responses, synced voice and animation, and characters that hold up to open-ended questioning, **deflect jailbreak attempts in character**, and never crash the experience even when an AI call fails. Most of all, we are proud that Echoes of War makes a heavy, important subject feel **personal and engaging**, for every kind of learner.

## What we learned

We learned that **voice-first design changes everything**: timing, buffering, and sync issues that would be invisible in a text app become dealbreakers when a character is speaking to you. We learned that **one AI model rarely fits every job**, and that pairing a powerful conversational model with a small, focused classifier gives better results than forcing one model to do both. Our dyslexic pilot group taught us that **accessibility cannot be an afterthought**: testing with real, diverse learners early surfaced problems we never would have caught ourselves. And we learned that **polish is integral**: when the experience feels seamless, players stop noticing the technology and start engaging with the history.

We also learned the craft of **bringing history to life in 3D**. Over the course of the project we taught ourselves to develop full character models — from Zofia at her desk in Warsaw to Dr. Hale in Hiroshima — along with every object on the war-room table: the wooden timeline figures, the sealed letters of December, the pieces of Operation Uranus. Each model had to survive a demanding pipeline: generation, rigging, animation retargeting, and careful tuning of scale, lighting, and framing so that a seated medic in Stalingrad and a sailor at Pearl Harbor read at the same visual weight on screen. We came away with a real appreciation for the discipline hiding inside every asset — that a believable character is equal parts geometry, animation, and staging — and with a **reusable workflow** for turning a historical concept into a game-ready model, which will pay off directly as we expand into new eras.

## What's next for Echoes of War

Our next step is bringing Echoes of War into real classrooms. We are planning to **reach out to middle schools and high schools** so students can use the app in their **social studies courses**, giving teachers a hands-on, accessible way to teach World War II. Alongside that, we want to expand into **new eras**, from the ancient world to the Cold War, each with its own cast of characters and missions, and add **teacher dashboards**, adaptive difficulty, richer character memory across chapters, and multiplayer missions where students investigate history together. The long-term vision is simple: **make talking to the past the most natural way to learn it.**

We also want Echoes of War to speak every student's language. A future update will make the platform **fully multilingual**, with characters that can listen and reply in **Spanish, French, Hindi, Mandarin, and more** — so a student can ask Zofia about the war in the language they think in, and hear her answer back in it. History class shouldn't depend on which language you grew up with, and **talking to the past should work in any tongue.** In short, we want Echoes of War to become a history platform used all around the world.
