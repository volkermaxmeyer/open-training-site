# PRD — Pickleball Training System

> Snapshot of 6 November 2026, copied from the private project and not updated here. The maintained version and the files it names (system facts, feedback loop, decision log and others) are private. Open Training, the part in this repository, is the live site described in the [README](../README.md).

## Problem
Each interface solves one problem. Each problem says how well it is evidenced.

1. **Coach — the coach plans alone, and the second court runs without him.** The club has grown; its advanced group (~15 players) spans a wide level range. One playing Übungsleiter leads it and plays on one court; the second court runs on a playing co-coach or peer. So every session must work in a mixed group and be self-explanatory on the court where he is not. *Evidence: observed by Volker as the group's Übungsleiter* → the project notes (Starting point).
2. **Open Training — players without a coach have no plan at hand.** In a fixed group of 2–4, one or two want to train, not only play, but have no plan they can pull up quickly, so they just play or drill without reading the game. The good drills reach only players on court with Volker. *Evidence: an owner hypothesis from the business case, not yet tested; outside sources are mostly coaching blogs with their own interest* → prd-open-training-site-v1, decision-log.
3. **Overview — experienced players and coaches cannot see what is inside.** They decide whether to trust a training system before they use it, and from the outside there is nothing to judge it by. *Evidence: a hypothesis, not yet tested* → feedback-loop.

**If nothing changes:** the advanced group trains on what one person prepares that week, the second court depends on improvising, and what has been learned from the videos stays with one person.

## What makes this possible
- **The Base.** Good coaching knowledge is scattered across hundreds of YouTube videos, mostly as pair drills, without a target picture, a level or a link to what to read in a game. The Base turns it into one source that all three interfaces read: ladders, drills, themes, a session frame and cue playbooks in one shared vocabulary. *Evidence: the source playlist and the videos reviewed from it* → system-facts.
- **The Quality loop.** It keeps that source correct and makes it better with every session that runs.

## Goal and success measure
**More good training happens, with and without a coach.** *Good* means: played through without help · it helped, the players would come back · the drill held up on court. Behaviour counts before opinion → feedback-loop.

| Part | Measured by | Threshold | When evaluated |
|---|---|---|---|
| Coach | coach sessions run, drills that became `tested` | every session that runs is recorded with feedback, and at least one drill becomes `tested` after it | monthly row |
| Open Training | groups that play a session and groups that come back, through the club's coaches | one question, is it needed? What counts as "played" and "came back" is written with a date before the link goes out | lean group test, decision by 2027-01-15 |
| Overview | three short talks at the court | holds if ≥ 2 of 3 explain it right **and** would use something | after the talks |
| Base | drills that held up (`tested` + `favorite`), guard warnings | the first drill reaches `favorite` by 2027-01-31 | monthly row |

Each part runs as a four-week experiment whose "go on" is decided beforehand. The first monthly row after the baseline is 2026-12.

## System model
One **Base** that is the single source. Three **Interfaces** that only read it: Coach, Open Training, Overview. One **Quality loop** that keeps the Base correct and makes it better with use. Building blocks in detail → README.

```text
  ┌───────────────────────────────────────────────────────────────┐
  │ PICKLEBALL TRAINING SYSTEM                                    │
  │ One base · three interfaces · one quality loop                │
  └───────────────────────────────────────────────────────────────┘

  THREE INTERFACES  (they only read the Base)

  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
  │ INTERFACE 1       │ │ INTERFACE 2       │ │ INTERFACE 3       │
  │ Coach             │ │ Open Training     │ │ Overview          │
  │                   │ │                   │ │                   │
  │ PURPOSE           │ │ PURPOSE           │ │ PURPOSE           │
  │ Plan a good       │ │ Let players       │ │ Show advanced     │
  │ session for the   │ │ train well        │ │ players what the  │
  │ advanced group    │ │ without a coach   │ │ system contains   │
  │                   │ │                   │ │                   │
  │ IN USE            │ │ IN USE            │ │ IN USE            │
  │ Theme → drills →  │ │ Pick 1 of 9 goals │ │ Shots, moments,   │
  │ session + Court   │ │ → 30-min session, │ │ combos, games     │
  │ Card              │ │ 3 drills          │ │ on one page       │
  └────────┬──────────┘ └────────┬──────────┘ └────────┬──────────┘
           ▼                     ▼                     ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ BASE                                                          │
  │ Purpose: one source of truth that every interface reads       │
  │ In use:  pick from it, never copy from it                     │
  │                                                               │
  │ Where to?         Ladder               2 pictures per skill   │
  │ With what?        Drill Library        120 drills             │
  │ What this week?   Theme Pool           ~13 themes             │
  │ How?              Session Template     120-min frame          │
  │ What to read?     Tactical Cues        decisions at the ball  │
  │ Head?             Mental Strength      routines, reset        │
  │ The plan?         Strategy Playbook    opponents, roles       │
  │ Getting better?   Feedback Loop        status + log           │
  └───────────────────────────────────────────────────────────────┘
                                 │ keeps it trustworthy
                                 ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ QUALITY                                                       │
  │ Purpose: the Base stays correct and gets better with use      │
  │ In use:  3 guard scripts check it · ~5 min feedback after     │
  │          each session · monthly outcome check                 │
  └───────────────────────────────────────────────────────────────┘
```

## What it has produced so far
- A base of drills, ladders, themes and cue playbooks, built from reviewed source videos. Counts with their counting commands: system-facts.
- Coach-led sessions run on court with this base; the records are in `sessions/`.
- A public coach-less training site, live since 2026-11-04 → prd-open-training-site-v1.
- An overview page of what the base contains → `dashboard/`.
- A business case for reaching players beyond the own group: conditional go → decision-log.

## How it is kept honest
- Three guard scripts check the controlled vocabulary, cue consistency and links → datenmodell, `app/tooling/README.md`.
- Every key decision is dated with its reason → decision-log.
- Status only moves on court: a drill is `tested` after it ran, not after it was written → feedback-loop.

## What is not proven yet
Read system-facts first. In short: writing has outrun testing. No drill has reached `favorite`, no real group has answered on the site, and the strategy `Teach:` fields have never run on court. This is the main open question of the whole system, not a footnote.

## Shared principles
1. **One source, interfaces only read.** Pick from the Base, never copy from it.
2. **Practice decides, not planning.** Quality grows from sessions that ran → feedback-loop.
3. **Training design follows the nine principles** (playtime, reading, purpose, Friendly → Competition → Game-like, ~70 % success, constraints over coaching) → trainingsprinzipien.
4. **Honest status.** A number carries its date and counting command; what is unproven is said so.
5. **Free and non-commercial.** Source videos are credited and played from YouTube → prd-open-training-site-v1.

## The parts
Each block has the same fields. **Built** lines carry their source.

### Coach
- **Purpose:** plan a good session for the advanced group in one pass: theme → drills → cues → session → Court Card for the co-coach.
- **For whom:** the group's playing Übungsleiter (Volker); a playing co-coach on the second court.
- **Built:**
  - A manual workflow, no tool: session-build-workflow, with the frame in session-template.
  - Coach-led sessions ran on court; records in `sessions/` → system-facts.
- **Known limits:** the peer-friendly drill filter favours pair forms, while four per court is the standard; one court rule in the session template failed on court and waits for a decision.
- **Not doing:** a coach app. Archived 2026-11-04 → prd-coach-app-v0.1.

### Open Training
- **Purpose:** a group of 2–4 players picks a session for what it wants to get better at and plays it without a coach.
- **For whom:** the phone holder and co-players of a group; Volker as curator.
- **Built:** the live site with one session per player goal → prd-open-training-site-v1; feedback route → feedback-loop.
- **Known limits:** no answer from a real group yet; the first feedback rows were the owner's own tests.
- **Not doing:** → prd-open-training-site-v1.

### Overview
- **Purpose:** show advanced players with some coaching experience what the system contains: shots, when in the point, combos, games. It shows, it does not explain.
- **For whom:** experienced players and coaches.
- **Built:** one page with four tabs on a data snapshot → `dashboard/README.md`, decision-log.
- **Known limits:** the trust hypothesis is untested; the data is a snapshot refreshed by hand.
- **Not doing:** explain method, merges or gaps; that stays in shot-inventory.

### Base
- **Purpose:** one source of truth for what to train (ladder), with what (drills), when (themes), how (session frame), what to read and plan (cue and strategy playbooks).
- **For whom:** the three interfaces; Volker as curator.
- **Built:**
  - Eight building blocks with one shared competency vocabulary → datenmodell.
  - New drills come from videos through a fixed recipe → drill-ingest-workflow.
- **Known limits:** few drills are proven on court and none is `favorite` yet; the strategy `Teach:` fields have never run on court; which shot a drill trains is recorded by hand, not as a field → shot-inventory.
- **Not doing:** a ball machine as a training source → trainingsprinzipien.

### Quality loop
- **Purpose:** the Base stays correct and gets better with use.
- **For whom:** Volker as curator; indirectly every interface.
- **Built, on three cadences, each with its state:**
  - **Per edit — running:** three guard scripts, 0 errors on 2026-11-06 → `app/tooling/README.md`, system-facts.
  - **Per session — running, lagging behind:** about five minutes of drill status and one practice-log line → feedback-loop. One session is not written up yet, and no drill has had a clean second run.
  - **Per month — not started:** the outcome check, behaviour before opinion, rule written before the test. Only the baseline (2026-11-05) exists; the first row is 2026-12 → feedback-loop.
- **Known limits:** the count guard covers only the drill counts; other numbers in prose are recounted by hand. The link guard checks links to headings, not plain file links.
- **Not doing:** automatic status changes. Volker approves every status change.

## Direction
Three bets:
1. **Open Training:** a lean group test through the club's coaches answers one question by 2027-01-15: is it needed? Only if it holds in the club does the Berlin community come next → decision-log.
2. **Coach and Base:** close the loop. Run drills a second clean time until the first reach `favorite` (threshold above).
3. **Overview:** test the trust hypothesis in three short talks at the court.

The detailed order and the open points live in the project notes.
