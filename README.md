# ALRAKIS // SELENE-NAV
### Lunar South Pole Landing Site Navigator, 360° Topographic Horizon Raycaster & Agile Mission Decision Deck

**NASA Space Apps Challenge 2026** — Virtual Islamabad Chapter  
**Team**: Team Alrakis (Muhammad Awad)  
**Lead Contact**: mawad27727@gmail.com  
**License**: MIT Open-Source License  

---

## 1. Project Overview & Operational Problem

Missions to the Lunar South Pole (Artemis, CLPS, VIPER) operate under extreme lighting and communications constraints driven by the Moon’s low 1.54° axial tilt and rugged crater topography:
- **Low Grazing Sun (0° to 3.5°)**: Small terrain features cast deep multi-kilometer shadows, producing abrupt cryogenic blackouts.
- **Earth Libration (±6.68° lat, ±7.90° lon)**: Direct-to-Earth (DTE) radio links dip below crater rims in cyclic 27.2-day draconic and 27.5-day anomalistic patterns.
- **Launch Delay Vulnerability**: When launch schedules slip by days or weeks, previously sunlit landing targets become plunged into darkness, demanding immediate contingency site-swap analysis.

**ALRAKIS // SELENE-NAV** replaces fragmented ephemeris tables and static imagery with a unified client-side decision cockpit featuring:
1. **360° Topographic Horizon Raycaster**: Evaluates airless line-of-sight against true LOLA terrain silhouettes.
2. **Launch-Slip & Site-Swap Contingency Matrix**: Quantifies deltas in sunlight hours, solar array flux ($W/m^2$), and DTE coverage.
3. **Sunset & Earthset Countdowns**: Live operational timers warning of impending thermal freeze or loss of signal.
4. **Dual-Persona Interface**: Instant switch between Flight Dynamics Engineering telemetry and Educational / Public Explorer mode.

---

## 2. Core Mathematical & Engineering Models

### 2.1 South Polar Stereographic Map Projection
Converts selenographic coordinates ($\phi \le -80^\circ$, East-positive $\lambda$) to planar coordinates with true scale at $-90^\circ$:
$$\rho = 2 \cdot R_{\text{Moon}} \cdot \tan\left(\frac{90^\circ + \phi}{2}\right)$$
$$X = \rho \cdot \sin(\lambda), \quad Y = \rho \cdot \cos(\lambda) \quad (R_{\text{Moon}} = 1737.4\text{ km})$$

### 2.2 Airless Topographic Horizon Masking
Computes angular obstruction accounting for zero atmospheric refraction and spherical curvature drop across distance $d$:
$$\alpha_i(d, \theta) = \arctan\left(\frac{[h_i - (h_0 + h_{\text{mast}})] - \frac{d^2}{2 R_{\text{Moon}}}}{d}\right)$$
$$H_{\text{topo}}(\theta) = \max_{d \in (0, 150\text{ km}]} [\alpha_i(d, \theta)]$$

### 2.3 Solar Disk Illumination Fraction & Array Flux
Models partial solar disk eclipsing ($R_{\text{sun}} = 0.266^\circ$) by crater ridges:
$$f_{\text{sun}}(t) = \text{clamp}\left(\frac{\text{El}_{\text{Sun}}(t) + R_{\text{sun}} - H_{\text{topo}}(\text{Az}_{\text{Sun}}(t))}{2 R_{\text{sun}}}, 0, 1\right)$$
$$P_{\text{vertical}}(t) = I_0 \cdot f_{\text{sun}}(t) \cdot \cos(\text{El}_{\text{Sun}}(t)) \cdot \eta_{\text{PV}} \cdot A_{\text{panel}} \quad (I_0 = 1361\text{ W/m}^2)$$
$$P_{\text{horizontal}}(t) = I_0 \cdot f_{\text{sun}}(t) \cdot \sin(\text{El}_{\text{Sun}}(t)) \cdot \eta_{\text{PV}} \cdot A_{\text{panel}}$$

### 2.4 Direct-to-Earth (DTE) Link Status
Evaluates geometric line-of-sight with safety margin against multipath interference:
$$\text{DTE Active} \iff \text{El}_{\text{Earth}}(t) > H_{\text{topo}}(\text{Az}_{\text{Earth}}(t)) + \theta_{\text{margin}} \quad (\theta_{\text{margin}} = 1.0^\circ)$$

### 2.5 Composite Mission Feasibility Score (0–100 Scale)
$$\text{Score} = 40 \left(\frac{T_{\text{sun}}}{T}\right) + 35 \left(\frac{T_{\text{DTE}}}{T}\right) + 15 \left(1 - \frac{\text{MaxEclipse}}{72\text{h}}\right) + 10 \left(1 - \frac{\text{Slope}}{15^\circ}\right)$$

---

## 3. NASA Data Sources & Official Citations

1. **NASA/JPL Horizons On-Line Ephemeris System API** (`https://ssd.jpl.nasa.gov/api/horizons.api`)  
   Topocentric airless ephemerides for Sun (ID 10) and Earth (ID 399) from lunar coordinates (`coord@301`).
2. **NASA GSFC Planetary Geodesy Data Archive (PGDA)** (`https://pgda.gsfc.nasa.gov/products/81`)  
   LOLA South Pole DEM mosaic (Barker et al.) at 5 m/px and 80 m/px for elevation profiles and landing hazard slope maps.
3. **MIT / PDS LOLA Gridded Data Records (GDR)** (`https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE/`)  
   Polar stereographic DEMs ($80^\circ\text{S}$ to $90^\circ\text{S}$).
4. **LPI / USRA Lunar South Pole Atlas** (`https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/`)  
   Landing site coordinates and Permanently Shadowed Region (PSR) polygon boundaries.

---

## 4. UI Design System: SELENE-TACTICAL

Adhering strictly to NASA guidelines prohibiting official agency logos, flags, or mission patches in competitor software, SELENE-NAV utilizes its custom **SELENE-TACTICAL** aerospace avionics design language:
- `var(--bg-void)`: `#090A0D` (Lunar Vacuum Carbon)
- `var(--bg-surface-1)`: `#111318` (Basalt Regolith Mare)
- `var(--bg-surface-2)`: `#181B22` (Anorthosite Slate)
- `var(--accent-solar)`: `#E59A23` (Kapton Foil Amber)
- `var(--accent-earth)`: `#289E8E` (Deep-Space S-Band Teal)
- `var(--status-hazard)`: `#D9463E` (Eclipse Vermilion)
- `var(--surface-psr)`: `#141D30` (Cryo Shadow Indigo)

---

## 5. Explicit Data Labeling & AI Tool Disclosure

- **Data Badging**: In compliance with Space Apps regulations, pre-computed LOLA horizon profiles are explicitly labeled as `[PRE-COMPUTED LOLA 80M DEM]`, while verification calls are labeled `[LIVE JPL HORIZONS TELEMETRY]`.
- **AI Tool Disclosure**: Team Alrakis declares that Google Gemini was utilized as a software architecture thought partner, technical documentation drafting assistant, and TypeScript code co-pilot. All scientific models, equations, and software integrations were validated and executed by Muhammad Awad.
