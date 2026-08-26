## ADDED Requirements

### Requirement: Frozen post-apocalyptic scenario
The system SHALL initialize the same 8×6 post-apocalyptic arena for every first-cohort battle. Coordinates use zero-based `(x,y)` with `(0,0)` at top-left. Opaque walls occupy `(3,2)` and `(4,2)`; walkable half-cover occupies `(2,1)`, `(2,3)`, `(5,1)`, and `(5,3)`. All other cells are walkable floor.

The Survivor squad SHALL initialize as Scout `survivor-scout` at `(0,1)` with 7 HP, 3 normal damage, and range 5; Gunner `survivor-gunner` at `(0,3)` with 10 HP, 3 normal damage, and range 4; and Medic `survivor-medic` at `(1,4)` with 8 HP, 2 normal damage, and range 4. Raiders `raider-a`, `raider-b`, and `raider-c` SHALL initialize at `(5,1)`, `(6,3)`, and `(6,4)` respectively, each with 6 HP, 2 normal damage, and range 4. Every unit has 6 maximum AP and a normal attack cost of 3 AP.

#### Scenario: Starting the first battle
- **WHEN** the player starts the prototype battle
- **THEN** terrain, units, positions, HP, AP, phase, and round equal the frozen scenario definition

#### Scenario: Replaying after a result
- **WHEN** the player activates replay from a terminal result
- **THEN** the system creates a fresh copy of the frozen scenario with no carried battle state

### Requirement: Team-phase turn economy
The system SHALL alternate between player and enemy phases. Each surviving unit refreshes to 6 AP at the start of its team phase. Orthogonal movement costs 1 AP per traversed cell; normal attacks cost 3 AP; abilities use their specified cost. Ending the player phase discards unspent player AP.

#### Scenario: Player phase begins
- **WHEN** a new player phase starts
- **THEN** every surviving player unit has 6 AP and enemy units cannot be commanded by the player

#### Scenario: Action lacks AP
- **WHEN** a unit attempts an action whose cost exceeds its remaining AP
- **THEN** the system rejects the action without changing battle state

### Requirement: Legal grid movement and occupancy
The system SHALL allow orthogonal movement through walkable, unoccupied cells using deterministic shortest paths. Walls and living units block movement. A defeated unit is removed immediately and no longer occupies its cell. Shortest-path ties SHALL resolve by neighbor order up, left, right, down.

#### Scenario: Unit moves along a legal path
- **WHEN** the player selects a reachable empty cell
- **THEN** the selected unit moves there and spends AP equal to the resolved shortest-path length

#### Scenario: Destination is blocked
- **WHEN** the player selects a wall, occupied cell, or cell beyond remaining AP
- **THEN** no unit position or AP value changes

#### Scenario: Unit is defeated
- **WHEN** a unit reaches zero HP
- **THEN** it is removed from occupancy before the next command is evaluated

### Requirement: Deterministic ranged combat, range, and cover
The system SHALL use Manhattan distance for range. It SHALL use integer Bresenham traversal between attacker and target centers for line-of-sight; an intermediate opaque wall blocks the attack, while units and half-cover do not block line-of-sight. A legal normal attack always hits. A target standing on half-cover reduces incoming normal or Burst damage by 1, with minimum damage 1.

#### Scenario: Uncovered target is attacked
- **WHEN** an attacker spends 3 AP on an in-range target with unobstructed line-of-sight outside half-cover
- **THEN** the target loses the attacker's normal damage

#### Scenario: Half-covered target is attacked
- **WHEN** an attacker legally attacks a target standing on half-cover
- **THEN** the target loses normal damage minus 1, with minimum damage 1

#### Scenario: Line-of-sight is blocked
- **WHEN** an intermediate opaque wall lies on the Bresenham line to the target
- **THEN** the attack is rejected without consuming AP

### Requirement: Survivor abilities
Each Survivor SHALL have one once-per-battle deterministic ability. Scout's `Aimed Shot` costs 4 AP, has range 5, requires line-of-sight, deals 4 damage, and ignores half-cover mitigation. Gunner's `Burst` costs 5 AP, has range 4, requires line-of-sight to a primary enemy, and deals 3 damage to the primary plus every living enemy on an orthogonally adjacent cell; half-cover mitigation applies separately to each target. Medic's `Medkit` costs 3 AP, targets Medic or a living ally within Manhattan distance 3 without requiring line-of-sight, and restores 4 HP without exceeding maximum HP.

#### Scenario: Aimed Shot ignores cover
- **WHEN** Scout uses Aimed Shot on a legal half-covered target
- **THEN** the target loses 4 HP and Scout cannot use Aimed Shot again in that battle

#### Scenario: Burst affects adjacent enemies
- **WHEN** Gunner uses Burst on a legal primary target with another living enemy orthogonally adjacent to it
- **THEN** both targets take separately cover-mitigated Burst damage and Gunner cannot use Burst again in that battle

#### Scenario: Medkit heals without overheal
- **WHEN** Medic uses Medkit on a valid damaged ally
- **THEN** the ally recovers up to 4 HP without exceeding maximum HP and Medic cannot use Medkit again in that battle

### Requirement: Fully deterministic enemy activation
Raiders SHALL activate once each in ID order. During activation a Raider SHALL repeatedly: attack a legal lethal target; otherwise attack the legal target with lowest HP; otherwise move once to a reachable cell minimizing distance to a position from which any Survivor can be attacked, then reevaluate. Attack ties resolve by target HP, distance, then ID. Destination ties resolve by distance-to-attack, path length, Y, then X. A Raider may attack twice if AP permits. If no path or legal action exists, activation ends. The enemy phase stops immediately on terminal state.

#### Scenario: Enemy can defeat a unit
- **WHEN** a Raider can legally attack one or more Survivors and at least one attack is lethal
- **THEN** it attacks the lethal target selected by target HP, distance, then ID

#### Scenario: Enemy has legal nonlethal targets
- **WHEN** no legal attack is lethal but one or more Survivors are legal targets
- **THEN** the Raider attacks the target selected by HP, distance, then ID and reevaluates if AP remains

#### Scenario: Enemy cannot attack immediately
- **WHEN** a Raider has no legal target at its current cell
- **THEN** it performs at most one shortest-path move to the deterministically selected attack-approach cell and reevaluates

### Requirement: Battle completion and replay
The system SHALL enter victory immediately when all Raiders are defeated and defeat immediately when all Survivors are defeated. If Raiders remain after the enemy phase of round 8 completes, the system SHALL enter defeat instead of starting round 9. No mid-battle restart SHALL exist. Replay SHALL be available only from a terminal result.

#### Scenario: Last enemy is defeated
- **WHEN** the final living Raider reaches zero HP
- **THEN** the battle enters victory and accepts no further battle commands

#### Scenario: Round limit is reached
- **WHEN** the enemy phase of round 8 finishes while at least one Raider remains alive
- **THEN** the battle enters defeat and round 9 never starts

#### Scenario: Replay is requested
- **WHEN** the result screen is visible and the player activates replay
- **THEN** a fresh battle starts with a new battle identifier

#### Scenario: Frozen scenario has a verified winning path
- **WHEN** round 1 uses Scout Aimed Shot on `raider-a`, Gunner moves to `(2,3)` then normally attacks `raider-b`, Medic moves to `(2,4)` then normally attacks `raider-c`, and round 2 uses Scout normal attack on `raider-a`, Gunner Burst on `raider-b`, and Medic normal attack on `raider-c`
- **THEN** all Raiders reach zero HP during player phase of round 2 under the specified deterministic AI and the battle enters victory
