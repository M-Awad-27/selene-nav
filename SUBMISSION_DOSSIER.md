# ALRAKIS // SELENE-NAV — ISLAMABAD SUBMISSION DOSSIER (v2.0)
### 2026 NASA Space Apps Challenge · Virtual Islamabad Chapter
**Team**: Team Alrakis (Muhammad Awad)  
**Lead Email**: mawad27727@gmail.com | **Phone**: +92 311 8179260  
**Selected Challenge**: Lunar Landing Site Navigator  
**Project Title**: ALRAKIS // SELENE-NAV — Lunar South Pole Horizon Raycaster & Agile Mission Decision Deck  

---

## ⚠️ CRITICAL SUBMISSION DEADLINES (PAKISTAN STANDARD TIME - PKT)

| Deadline | Cutoff Time (PKT) | Platform | Mandatory Requirement |
| :--- | :--- | :--- | :--- |
| **LOCAL DEADLINE (CRITICAL)** | **Sunday, 15 Nov @ 3:30 PM PKT** | **Islamabad Local Judging Google Form** | Form link published on [Space Apps Islamabad Page](https://www.spaceappschallenge.org/2026/local-events/islamabad/). **Take a screenshot of the confirmation page upon submission!** |
| **GLOBAL DEADLINE** | **Sunday, 15 Nov @ 11:59 PM PKT** | **spaceappschallenge.org** | Official Global Project Page (Description, Video Link, Code Repository, Citations). |

> **IMPORTANT**: The 11:59 PM global cutoff does **NOT** extend local judging eligibility. Missing the 3:30 PM PKT Google Form disqualifies the project from local awards!  
> **Emergency Contact**: If the Google Form link is missing or errors on Sunday, immediately message Islamabad Local Lead Abdullah Zafar on the official Islamabad Discord (`https://discord.com/invite/8rK9ya92z`) with team name `Alrakis` and screenshot.

---

## 1. READY-TO-PASTE SUBMISSION FIELDS

### 1.1 Short Summary (Max 300 words)
```text
ALRAKIS // SELENE-NAV is an interactive web application that helps lunar mission planners, educators, and the public rapidly evaluate and compare Lunar South Pole landing sites and dates. By fusing topocentric Sun and Earth ephemeris calculations (validated against NASA's JPL Horizons System) with 360-degree Lunar Orbiter Laser Altimeter (LOLA) topographic horizon silhouettes, SELENE-NAV visualizes local crater-rim shadowing, calculates live countdowns to sunset and Earthset, compares vertical vs. horizontal solar array power output (W/m²), and enables side-by-side contingency comparisons when launch dates slip.
```

### 1.2 Detailed Description, User Journey & Limits
```text
OPERATIONAL CONTEXT & WORKFLOW:
Missions to the Moon's South Pole face severe illumination and Direct-to-Earth (DTE) communication constraints driven by the Moon's low 1.54° axial tilt and deep cratered topography. A launch slip of several days or a site move of just two kilometers can plunge a lander into a 150-hour cryogenic shadow behind a massif ridge.

SELENE-NAV solves this by unifying four core capabilities:
1. 360° Lander's-Eye Topographic Horizon Raycaster: Evaluates airless line-of-sight against true LOLA terrain silhouettes across 360 azimuth rays (0° to 359°), accounting for spherical curvature drop and an adjustable 0–15 m lander solar mast.
2. Launch-Slip & Site-Swap Contingency Matrix: Directly compares Site A vs. Site B or nominal launch dates vs. +7d, +14d, +29d delayed dates, calculating exact deltas in sunlight hours, electrical wattage, and DTE coverage.
3. Live Sunset & Earthset Countdowns: Solves horizon-crossing timestamps via fast bisection search to warn of impending solar blackout or loss of signal.
4. Dual-Persona Cockpit: Seamlessly switches between Flight Dynamics telemetry (raw azimuth/elevation vectors, vertical array flux, slope hazard ratings) and an interactive Educator/Public Explorer deck explaining the 1.54° axial tilt and cold-trap physics.

DATA INTEGRATION & MODEL LIMITS:
All 360° terrain skyline masks are derived from NASA LOLA Digital Elevation Models (80 m/px polar stereographic GDR) out to a 150 km radial distance, labeled as [PRE-COMPUTED LOLA 80M DEM]. Real-time topocentric ephemerides are computed via IAU-standard libration algorithms at 60 FPS, with verification against NASA JPL Horizons (coord@301, QUANTITIES='4') yielding sub-arcminute residuals (|Δ| < 0.05°). Multi-bounce thermal scattering is not modeled and noted for future development.
```

### 1.3 Official NASA Datasets & Citations
```text
1. NASA/JPL Horizons On-Line Ephemeris System API (https://ssd.jpl.nasa.gov/api/horizons.api) — used for topocentric airless Sun (ID 10) and Earth (ID 399) azimuth/elevation verification from lunar coordinates (coord@301).
2. NASA GSFC Planetary Geodesy Data Archive (PGDA) & MIT/PDS Lunar Orbiter Laser Altimeter (LOLA) South Pole DEMs (https://pgda.gsfc.nasa.gov/products/81 & https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE/) — used to generate polar stereographic basemaps, slope hazard values, and 360° terrain horizon rings.
3. LPI/USRA Lunar South Pole Atlas (https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/) — reference landing coordinates and Permanently Shadowed Region (PSR) polygon boundaries.
```

### 1.4 AI Tool Disclosure Statement
```text
In compliance with 2026 NASA Space Apps Challenge rules, Team Alrakis declares that Google Gemini was utilized during the hackathon as a software architecture thought partner, technical documentation drafting assistant, and TypeScript code co-pilot. All scientific formulas, ephemeris verifications, UI implementations, and testing were reviewed, verified, and integrated by Muhammad Awad. No NASA logos, flags, or official mission patches were utilized in any generated content.
```

---

## 2. 30-SECOND DEMO VIDEO SCRIPT & STORYBOARD

* **Format**: Max 30 seconds · Spoken English or English Captions · 1080p Full HD screen recording.
* **Hosting**: YouTube (Public/Unlisted) or Google Drive ("Anyone with the link can view").
* **Verification**: Test the video link in an **Incognito / Private Window** prior to submitting.

| Timestamp | Screen Action | Voiceover Narration |
| :--- | :--- | :--- |
| **0:00 – 0:06** | View starts on Q1 Polar Map zooming into Shackleton Rim; Sun grazing vector skims horizon. | *"At the Moon's South Pole, moving a landing site by 2 kilometers or delaying launch by 7 days can mean the difference between sunlit power and a 150-hour cryogenic blackout."* |
| **0:06 – 0:15** | Q2 360° Skyline Panorama & 3D Crater Mesh active; adjusting Mast Height Slider from 0m to 12m. | *"Meet SELENE-NAV by Team Alrakis. Our 360-degree Horizon Raycaster models surrounding crater rims in real time, calculating live countdowns to sunset and Earthset with an adjustable solar mast."* |
| **0:15 – 0:24** | Click into Q4 Contingency Diff Matrix; select +14d launch slip and watch deltas update. | *"When a launch slips, our Contingency Diff Engine compares Site A versus Site B side-by-side—quantifying vertical solar wattage, Earth communication windows, and feasibility scores in milliseconds."* |
| **0:24 – 0:30** | Toggle to Educator Mode; show 1.54° axial tilt card and interactive array calculator. | *"Switch seamlessly to Educator Mode to explore the physics of lunar eternal light. SELENE-NAV: Agile navigation for humanity's return to the Moon."* |

---

## 3. 5-PILLAR JUDGING ALIGNMENT SCORECARD

| Official Judging Pillar | Criterion | SELENE-NAV Proof Point |
| :--- | :--- | :--- |
| **1. Impact** | Who benefits & what becomes possible | Enables CLPS and Artemis mission planners to perform rapid contingency trades when launches slip; provides students an intuitive window into lunar polar illumination. |
| **2. Creativity** | Original contribution | Replaces static ephemeris tables with a 360° Lander's-Eye Skyline Raycaster, a 0–15m Solar Mast Clearance Simulator, and a Side-by-Side Contingency Diff Matrix. |
| **3. Validity** | Sound science & checked limits | Models zero-refraction airless geometry, curvature drop, $0.53^\circ$ solar disk partial eclipsing, and $\pm 6.68^\circ/\pm 7.90^\circ$ Earth libration—validated within $0.05^\circ$ of NASA JPL Horizons. |
| **4. Relevance** | Direct response to challenge | Fulfills all 7 Lunar Landing Site Navigator objectives using NASA JPL Horizons and NASA GSFC LOLA DEM datasets. |
| **5. Presentation** | Clarity, UI & open-source quality | Custom SELENE-TACTICAL avionics design system, dual persona switcher, 30s demo video, and open-source MIT GitHub repository. |
