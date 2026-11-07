# OBSCURA: the full solution guide

> **This spoils everything.** If you have not explored the archive yet, close this file and go and look. It is much better to find things.

This is for whoever maintains OBSCURA. It lists every secret, how to reach it, and where it lives in the code.

## The unlock chain

| Entry | Opens when |
| --- | --- |
| OBS-0001 The Last Light | Always |
| OBS-0002 Signal Lost | Always |
| OBS-0003 The Infinite Hallway | The Last Light is complete |
| OBS-0004 Forgotten Coordinates | Signal Lost **and** The Infinite Hallway are complete |
| OBS-0013 The Quiet Room | Hidden. Reached by identifier or by URL |
| OBS-0000 THE_ORIGIN | Hidden. Reached by identifier or by URL |

Hidden entries can always be opened by typing their identifier at the archive prompt, or by going to `#/room/013` or `#/origin` directly. Opening one is what discovers it. After that it appears in the index. Rules live in `src/core/access.js`, data in `src/core/catalog.js`.

## The seven fragments

Each fragment is a line of the archive's fictional history. They are shown on THE_ORIGIN, with the visitor's identifier written into the last one.

| | Where | How |
| --- | --- | --- |
| **F1** | The Last Light | Hold the light **perfectly still** on the empty spot right of centre (57% across, 50% down) for four seconds. A message fades in. The light must move slower than 40 px/s. |
| **F2** | Signal Lost | Decode the third transmission with the keyword **LIGHT**. |
| **F3** | The Infinite Hallway | Walk **seven steps forward** with no turns. |
| **F4** | Forgotten Coordinates | Enter the full coordinate **04h 17m −39°**. |
| **F5** | The entrance | Click the leaning word **supposed** in the opening message. It pulses faintly after 14 seconds if you have not found it. |
| **F6** | The archive | Type **lumen** on the archive screen while no field is focused, or enter `lumen` at the prompt. The screen dims. |
| **F7** | The Quiet Room | Press **stay**, then keep the pointer still for 14 seconds. |

Recovering three fragments awards *A Pattern*. Recovering all seven awards *The Whole Story*.

## Room by room

### 001 The Last Light

Five messages. Each is revealed by keeping the light within 60% of its radius for about 1.1 seconds; brushing past decays the exposure. Finding all five completes the room. The message for the keyword says **YOU CARRY A LIGHT. ITS OLD NAME IS LUMEN.** It is the clue for both **LIGHT** (Signal Lost) and **lumen** (the archive).

"Read the messages as text" reveals everything for accessibility and still counts.
Logic: `src/core/lights.js`. Room: `src/rooms/last-light.js`.

### 002 Signal Lost

| Transmission | Solution |
| --- | --- |
| TX 01 | Frequency offset **7** |
| TX 02 | **Invert phase** on, offset **11** |
| TX 03 | Keyword **LIGHT** (F2) |

The meter peaks only at the exact answer. Each transmission has three hints, and after the third a "Reveal the answer" button appears. Logic: `src/core/cipher.js`.

### 003 The Infinite Hallway

Positions are strings of moves from the start (`L`, `F`, `R`). Three are special, and finding all three completes the room.

| Place | How |
| --- | --- |
| **The Threshold** (F3) | `FFFFFFF`: seven forward |
| **The Numbered Door** | `LLRR`: left, left, right, right. It says "13" and tells you to type it into the archive. This is the route to the Quiet Room |
| **The Same Place** | `RRR`: three rights. It sends you back to the start (*Wrong Turn*) |

A whisper along the way points at each of them. Logic: `src/core/hallway.js`.

### 004 Forgotten Coordinates

Three faint stars, visible only at zoom 3.4 or more, each beside a named star:

| Faint star | Beside | Piece |
| --- | --- | --- |
| FS1 | Vesper | 04h |
| FS2 | Halcyon | 17m |
| FS3 | Mirelle | −39° |

Together: **04h 17m −39°**. Typing any style (`04h 17m -39`, `4 17 -39`, `04:17 -39°`) works. A wrong coordinate pans the map there and says nothing answers. The right one flies to the spot, lights a star and completes the room. After all three hints, "Read the coordinate pieces as text" reveals the pieces. Logic: `src/core/starmap.js`.

### The Quiet Room (OBS-0013)

Press **stay** and keep the pointer still. Moving more than 60 px resets the vigil, but keyboard and assistive-technology users are never penalised. After 14 seconds the room speaks, gives F7 and awards *Observed*.

### THE_ORIGIN (OBS-0000)

Shows recovered fragments and redacts the rest, so visiting early is harmless. Every "fragment recovered" notification says it is *filed under OBS-0000*, which is the pointer to this page.

## Other hidden things

| Interaction | Result |
| --- | --- |
| `OBS-0404` at the prompt | *Dead Link* achievement |
| `hint` at the prompt | Gives the next hint for an unrecovered fragment |
| `whoami` at the prompt | Prints your visitor identifier |
| Idle on the archive for 45 s | The console says something, up to three times |
| Rows lean toward the pointer | Cosmetic, pointer only |

## Achievements

*Unexpected Visitor* (enter the archive), *Leaning Word*, *Say It Out Loud*, *Dead Link*, *Wrong Turn*, *The Threshold*, *First Light*, *Receiver*, *Cartographer*, *Every Room*, *First Entry* (find THE_ORIGIN), *A Pattern*, *The Whole Story*, *Observed*, *Signal Sent* (prepare a transmission).

## Extending it

- **Add a fragment:** append to `FRAGMENTS` in `src/core/catalog.js` with two hints. The count, the journal and THE_ORIGIN pick it up, and the tests check hint counts.
- **Add a room:** add an entry to `ENTRIES`, a module in `src/rooms/` exporting `mount(container, ctx)`, and register it in `src/rooms/index.js`. Put its logic in `src/core/` with tests. The unlock-graph test will fail if you create a cycle.
- **Add an achievement:** append to `ACHIEVEMENTS`. Give it a `rule` to award it automatically, or dispatch `{ type: 'achievement/award', id }` from the thing that triggers it.
