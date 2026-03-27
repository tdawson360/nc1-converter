# NC1 Converter Project

## Version 1.11

### Features
- HSS Square/Rectangular tube support with:
  - Web miters (Top/Bottom long point)
  - Flange miters (Near/Far long point)
  - Double miters (compound cut with top/bottom cutbacks and dropdown)
  - Slotted End Connection (knife plate slot)
  - Notches
  - Copes
  - Holes and slots on all faces

- Channel support with:
  - Orientation: Toes down, Web up (as loaded in machine)
  - Web miters (Near/Far): diagonal on web, flanges at different lengths
  - Flange miters (Top/Bottom): diagonal on both flanges, web rectangular
  - Copes: Near Flange (o-face), Far Flange (u-face), Both Flanges, Web
  - Notches: Near Flange, Far Flange, Web
  - Face assignments: v=web, o=near flange, u=far flange

- Angle support with:
  - Holes on vertical leg (v-face) and horizontal leg (u-face)
  - Slots on vertical leg (v-face) and horizontal leg (u-face)
  - Face codes: v=vertical leg, u=horizontal leg (NOT h!)
  - Separate BO blocks per face

- FLAT Plate support with:
  - Stock selection (width x thickness)
  - Custom part definition (cut piece from stock)
  - Corner treatments with diagonal cuts:
    - Square (default)
    - Chamfer (equal X and Y cut, 45-degree)
    - Diagonal (independent X and Y dimensions)
  - Holes and slots on the part
  - Face code: v, yRef: o
  - **Circle clipping (v1.11):** Circles (BO) that extend beyond plate edges are automatically clipped to arc polylines integrated into the AK contour. The machine only cuts the portion of the circle that falls within the plate boundary.

### Slotted End Connection (v1.9)
For HSS rectangular tubes - creates a knife plate slot at either end.

**Parameters:**
- Slot Length: How far the slot extends into the tube
- Slot Width: Width of the slot opening
- End Type: Radiused (semicircle, r=width/2) or Square (with 1/8" relief radius)

**Geometry:**
- Slot is centered on the Y axis (center of tube height)
- Slot cuts through both web faces (v and h)
- Generated as IK contours (internal cutouts)

### Corner Treatments (Plates)
Each corner can have independent X and Y cut dimensions:
- **Square**: No cut (90 degree corner)
- **Chamfer**: Equal X and Y cut (45 degree diagonal) - single input
- **Diagonal**: Independent X and Y dimensions - two inputs

### Circle Clipping for Plates (v1.11)
When a BO (bore/circle) on a plate extends beyond the plate boundary, the NC1 Converter automatically:

1. **Detects** oversized circles by checking each hole against the plate dimensions (length × width)
2. **Calculates** intersection points where the circle crosses the plate edge(s)
3. **Generates** a 20-segment polyline arc tracing the circle portion inside the plate
4. **Integrates** the arc into the AK (outer contour) block, replacing the straight edge segment
5. **Removes** the oversized circle from the BO block

**Technical details:**
- Handles circles intersecting any plate edge (right, left, top, bottom)
- Uses midpoint testing to determine which arc (inside vs outside) to trace
- Normal holes that fit within the plate are unaffected (still output as BO)
- Mixed scenarios (some normal holes + some oversized circles) are handled correctly
- Arc direction is determined by testing which half of the circle falls inside the plate boundary
- 20 polyline segments provide smooth arc approximation suitable for plasma cutting

**Limitations:**
- Currently handles circles with exactly 2 intersection points on plate edges
- Circles intersecting plate corners (2+ edges simultaneously) are not yet supported
- Only applies to FLAT (plate) profile type

### Slot Format (BO Block with 'l' marker)
Slots use BO format with 'l' marker after depth value.

**Slot Length Calculation:**
- User enters total slot length
- Extension = total length - diameter
- NC1 outputs extension value, not total length

**Slot Centering:**
- User enters CENTER position of slot
- NC1 X position = center - (extension / 2)

### Hole Format (BO Block)

**For Plates:**
- Face: v, yRef: o

**For Angles:**
- Vertical leg: face v, yRef u
- Horizontal leg: face u, yRef u
- Separate BO blocks per face
- No depth field for angles

### Version History
- v1.11: Circle clipping for oversized BO on plates - arcs integrated into AK contour as polylines
- v1.10: Fixed channel (C/MC) header - tf before tw, fillet radius = k-tf
- v1.9: Added slotted end connection for HSS tubes
- v1.8x: Fixed slot centering (X = center - extension/2)
- v1.8w: Fixed slot centering (first attempt)
- v1.8v: Fixed slot length calculation (extension = length - diameter)
- v1.8u: Added diagonal corner cuts with independent X/Y dimensions
- v1.8t: Fixed plate holes/slots (face v, yRef o)
- v1.8s: Fixed angle slots (BO format with 'l' marker)
- v1.8r-q: Fixed angle holes (face codes v/u, separate BO blocks, no depth)
- v1.7: Double miter HSS implementation
