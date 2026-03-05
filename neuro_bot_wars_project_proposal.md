# Project Proposal: Neuro Bot Wars

### An AI-Based Strategic Combat Simulation

**Course Title:** Artificial Intelligence Laboratory\
**Course No.:** CSE 3210

**Submitted By:**\
- Md Himel (Roll: 2107032)\
- Ariyan Aftab Spandan (Roll: 2107045)

------------------------------------------------------------------------

## 1. Abstract

**Neuro Bot Wars** is a comprehensive Artificial Intelligence project
designed to simulate a deterministic, turn-based tactical combat
environment. The project focuses on the implementation and comparative
analysis of distinct decision-making algorithms---specifically **Minimax
with Alpha-Beta Pruning** versus **Greedy Heuristics**---within a
controlled grid-based arena.

By pitting two autonomous agents against one another, the project aims
to demonstrate the efficacy of **long-term strategic planning** versus
**reactive, speed-oriented decision-making**.

------------------------------------------------------------------------

## 2. Thematic Background

The simulation is narratively grounded in a **post-apocalyptic setting**
following the collapse of human civilization. A supercomputer known as
**"ORACLE"** initiates *"The Last Simulation"* to preserve intelligence.

In this scenario, only the most effective Artificial Intelligence will
be archived for the future, necessitating a contest of logic and
strategy between autonomous agents.

------------------------------------------------------------------------

## 3. Project Objectives

The primary technical objectives of this project are:

-   Design a **6 × 6 grid-based arena** that supports deterministic
    gameplay.
-   Implement **two contrasting AI archetypes** (Strategic vs Reactive).
-   Integrate different algorithms for **navigation (pathfinding)** and
    **combat (adversarial search)**.
-   Evaluate how different algorithmic approaches handle **resource
    management (health)** and **positioning**.

------------------------------------------------------------------------

## 4. System Architecture and Algorithms

The system is built upon **two distinct phases**, utilizing specific
algorithms tailored to the requirements of each agent.

### 4.1 Agent 1: AEGIS (The Strategist)

**AEGIS** represents the **Blue Agent**, designed as a **Minimax
Strategist** focused on defense and foresight.

**Combat Algorithm** - Minimax with **Alpha-Beta Pruning** - Predicts
opponent actions several turns ahead to make optimal decisions in
adversarial scenarios.

**Navigation** - Uses **A\* Search** to navigate the maze efficiently.

**Behavioral Profile** - Strategic\
- Defensive\
- Focused on long-term survival

------------------------------------------------------------------------

### 4.2 Agent 2: VELO (The Assassin)

**VELO** represents the **Red Agent**, designed as a **Reactive AI**
focused on speed and aggression.

**Combat Algorithm** - **Greedy Heuristics** - Chooses actions based on
immediate gain and state evaluation instead of deep tree search. -
Results in **lower computational cost per turn**.

**Navigation** - Uses **A\* or Uniform Cost Search**, prioritizing
speed.

**Behavioral Profile** - Fast\
- Aggressive\
- Highly reactive

------------------------------------------------------------------------

## 5. Gameplay Mechanics

The simulation flow is divided into **two sequential phases** to test
different capabilities of the AI agents.

### Phase 1: Maze Navigation (The Race)

-   Both bots begin at predefined grid cells within a **static maze
    structure**.
-   The objective is to navigate to a fixed **"Power Room"**.
-   AEGIS and VELO **alternate turns**, moving one tile at a time.
-   This phase strictly evaluates **pathfinding efficiency**.

------------------------------------------------------------------------

### Phase 2: Combat (The Duel)

Once agents reach the arena, the system transitions to a **turn-based
duel**.

The agents utilize a variety of **moves and skills** to deplete the
opponent's health.

#### Movement Actions

-   **Advance:** Move 1 tile toward the opponent\
-   **Retreat:** Move 1 tile away to gain safety\
-   **Sidestep:** Lateral movement for better positioning\
-   **Hold Position:** Remain stationary to prepare defenses

#### Combat Capabilities

**Attacks** - Pulse Strike - Logic Burst - Elemental Beam

**Skills** - Predictive Guard - Counter Logic - Positional Control

------------------------------------------------------------------------

## 6. Victory and Defeat Conditions

The simulation enforces strict conditions to determine the **superior
intelligence**.

### Victory Conditions

Victory is achieved if:

-   The opponent's health is reduced to **zero**
-   The opponent **concedes defeat** based on strategic evaluation
-   The agent maintains **higher health percentage** when the maximum
    turn limit is reached

### Defeat Conditions

Defeat occurs if:

-   The agent's health reaches **zero**
-   The agent calculates a **hopeless state** and concedes
-   The agent has **lower health at the turn limit**

------------------------------------------------------------------------

## 7. Conclusion

**Neuro Bot Wars** serves as a robust platform for visualizing the
trade-offs between:

-   **Computational heaviness (Minimax)**
-   **Heuristic speed (Greedy Search)**

By placing these algorithms in a **direct deterministic conflict**, the
project provides clear insights into **AI strategy design**,
**adversarial decision-making**, and **combat logic implementation**.
