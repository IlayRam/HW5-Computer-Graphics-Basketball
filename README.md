# Computer Graphics - Exercise 6 - WebGL Basketball Court - Noam shildekraut, Ilay Ram

## Getting Started
1. Clone this repository to your local machine
2. Make sure you have Node.js installed
3. Start the local web server: `node index.js`
4. Open your browser and go to http://localhost:8000

## Complete Instructions
**All detailed instructions, requirements, and specifications can be found in:**
`basketball_exercise_instructions.html`

## Group Members
**MANDATORY: Add the full names of all group members here:**
- Noam shildekraut
- Ilay Ram

## Technical Details
- Run the server with: `node index.js`
- Access at http://localhost:8000 in your web browser

## Additional Features
- Free-throw lines, three-point lines, center circle.
- Semi-transparent shooter’s square etched into each backboard
- High-resolution wood texture on the court and realistic orange/black seam texture on the basketball
- Hoop rims built from torus (tube) geometry instead of simple line segments
- Score Board + 24 seconds clock
- Stadium environment with bleachers on all sides
- Wind effect with adjustable intensity and direction
- Game teams statistics display (points, shots attemps, shots made, shooting %, combo streak)
- Extra 3 points for swishes (shots made without touching the rim) and +1 for every combo streak
- Ball physics with realistic bounce and spin
- Ball trail effect
- Sound effects
- Leaderboard with local storage for time challenge mode
- Visual effects for successful shots (Burning rim effect) + Sound Effects
- Messages for successful shots and misses
- Multiple camera preset positions for fast switching:
  - **Z** – Aerial view
  - **X** – VIP seating team 1 
  - **C** – VIP seating team 2
  - **V** – Behind the basket team 1 view
  - **B** – Behind the basket team 2 view
- Ball Control using keyboard:
  - **W/S** - Ball throw power (+/-)
  - **J/K** - Wind intensity (+/-)
  - **SPACE** - Shoot the ball
  - **M** - Choose play mode (Normal, Free-Throw, 60 Seconds Time Challenge)
  - **R** - Reset ball position, physics, shot power and velocity
  - **Arrow keys** - Move the ball around the court


## Screenshots

<!-- ——— Demo videos (2×2) ——— -->
<p align="center">
  <video width="48%" controls muted>
    <source src="Screenshots/moving%20around%20the%20court.mp4" type="video/mp4">
  </video>
  <video width="48%" controls muted>
    <source src="Screenshots/successful%20shot.mp4" type="video/mp4">
  </video>
</p>
<p align="center">
  <video width="48%" controls muted>
    <source src="Screenshots/failed%20shot.mp4" type="video/mp4">
  </video>
  <video width="48%" controls muted>
    <source src="Screenshots/wind%2Btime%20violation.mp4" type="video/mp4">
  </video>
</p>

<!-- ——— Image grid (3×2) ——— -->
<p align="center">
  <img src="Screenshots/Picture1.png" width="32%" />
  <img src="Screenshots/Picture2.png" width="32%" />
  <img src="Screenshots/Picture3.png" width="32%" />
</p>
<p align="center">
  <img src="Screenshots/Picture4.png" width="32%" />
  <img src="Screenshots/Picture5.png" width="32%" />
  <img src="Screenshots/Picture6.png" width="32%" />
</p>
