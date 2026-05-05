#!/usr/bin/env python3
"""
create_helmet.py
Adventure / Full-face Motorcycle Helmet — Blender procedural model
Usage:  blender --python create_helmet.py
        blender -b --python create_helmet.py   (headless / no UI)
"""

import bpy, bmesh, math, os
from mathutils import Vector, Euler

# ─── CONFIGURATION ────────────────────────────────────────────────────────────
try:
    OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    OUTPUT_DIR = os.getcwd()

BLEND_PATH = os.path.join(OUTPUT_DIR, "helmet_model.blend")
GLB_PATH   = os.path.join(OUTPUT_DIR, "helmet_model.glb")
PNG_PATH   = os.path.join(OUTPUT_DIR, "preview.png")

# ─── SCENE UTILITIES ──────────────────────────────────────────────────────────

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)

def new_col(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c

def link_to_col(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)

def smooth_obj(obj, angle_deg=55):
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.use_auto_smooth = True
    obj.data.auto_smooth_angle = math.radians(angle_deg)

# ─── MODIFIER HELPERS ─────────────────────────────────────────────────────────

def add_bevel(obj, width=0.02, segs=2, angle_deg=30):
    m = obj.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segs
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle_deg)
    return m

def add_subd(obj, levels=2, render=3):
    m = obj.modifiers.new("Subd", "SUBSURF")
    m.levels = levels
    m.render_levels = render
    return m

def add_solidify(obj, thickness=0.025, offset=-1.0):
    m = obj.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    return m

# ─── MATERIAL FACTORY ─────────────────────────────────────────────────────────

def make_mat(name, color, metallic=0.0, roughness=0.5, specular=0.5,
             alpha=1.0, transmission=0.0, ior=1.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    nodes.clear()

    out  = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value  = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value    = metallic
    bsdf.inputs["Roughness"].default_value   = roughness
    bsdf.inputs["Specular"].default_value    = specular
    bsdf.inputs["IOR"].default_value         = ior

    if transmission > 0.0:
        bsdf.inputs["Transmission"].default_value = transmission
        bsdf.inputs["Alpha"].default_value        = alpha
        m.blend_method  = "BLEND"
        m.shadow_method = "HASHED"

    return m

# ─── MATERIALS ────────────────────────────────────────────────────────────────

M = {}

def build_materials():
    M["shell"]  = make_mat("M_Shell",  (0.91, 0.92, 0.93),
                            metallic=0.04, roughness=0.07, specular=0.92)
    M["black"]  = make_mat("M_Black",  (0.035, 0.035, 0.040),
                            roughness=0.78, specular=0.10)
    M["gun"]    = make_mat("M_Gun",    (0.090, 0.092, 0.105),
                            metallic=0.80, roughness=0.28, specular=0.72)
    M["visor"]  = make_mat("M_Visor",  (0.55, 0.68, 0.75),
                            metallic=0.0, roughness=0.015, specular=1.0,
                            alpha=0.20, transmission=0.90, ior=1.52)
    M["red"]    = make_mat("M_Red",    (0.88, 0.04, 0.02),
                            roughness=0.22, specular=0.82)
    M["screw"]  = make_mat("M_Screw",  (0.19, 0.19, 0.21),
                            metallic=0.95, roughness=0.10, specular=0.95)
    M["rubber"] = make_mat("M_Rubber", (0.020, 0.020, 0.022),
                            roughness=0.98, specular=0.0)

def assign(obj, mat_key):
    obj.data.materials.clear()
    obj.data.materials.append(M[mat_key])

# ─── MESH BUILDER ─────────────────────────────────────────────────────────────

def finalize(bm_obj, name, col):
    mesh = bpy.data.meshes.new(name)
    bm_obj.to_mesh(mesh)
    bm_obj.free()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    return obj

def closed_box(pts):
    """8-point box: pts[0-3] = bottom ring, pts[4-7] = top ring (matching order)."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in pts]
    bm.faces.new([v[0], v[1], v[2], v[3]])  # bottom
    bm.faces.new([v[7], v[6], v[5], v[4]])  # top
    bm.faces.new([v[0], v[4], v[5], v[1]])  # front
    bm.faces.new([v[2], v[6], v[7], v[3]])  # back
    bm.faces.new([v[3], v[7], v[4], v[0]])  # left
    bm.faces.new([v[1], v[5], v[6], v[2]])  # right
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

# ─── 1. MAIN SHELL ────────────────────────────────────────────────────────────

def create_shell(col):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=32, radius=1.0)

    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z

        # Overall proportions  (x = left/right, y = front/back, z = up/down)
        nx = x * 1.09          # slightly wider
        ny = y * 0.94          # slightly narrower front-back
        nz = z * (1.18 if z > 0 else 0.52)  # tall crown, short open bottom

        # Rear lean: top shifts backward a little (helmet geometry)
        if z > 0.4:
            ny -= (z - 0.4) * 0.10

        # Chin protrusion: bottom-front pushes out for the chin bar opening
        if z < -0.05 and y > 0.15:
            ny += (y - 0.15) * 0.35 * max(0.0, (-z - 0.05))

        # Widen temples slightly
        if abs(z) < 0.3 and abs(x) > 0.5:
            nx *= 1.04

        v.co.x, v.co.y, v.co.z = nx, ny, nz

    # Open the bottom (neck opening)
    bmesh.ops.delete(bm,
        geom=[v for v in bm.verts if v.co.z < -0.40],
        context="VERTS")

    obj = finalize(bm, "Shell", col)
    add_bevel(obj, 0.016, 2, 32)
    add_subd(obj, 2, 3)
    smooth_obj(obj, 55)
    assign(obj, "shell")
    return obj

# ─── 2. CHIN GUARD ────────────────────────────────────────────────────────────

def create_chin_guard(col):
    pts = [
        (-0.47,  0.70, -0.29), ( 0.47,  0.70, -0.29),   # front-top
        ( 0.50,  0.63, -0.54), (-0.50,  0.63, -0.54),   # front-bottom
        (-0.38,  0.44, -0.23), ( 0.38,  0.44, -0.23),   # rear-top
        ( 0.41,  0.40, -0.48), (-0.41,  0.40, -0.48),   # rear-bottom
    ]
    bm = closed_box(pts)
    obj = finalize(bm, "Chin_Guard", col)
    add_bevel(obj, 0.022, 3, 25)
    add_subd(obj, 1, 2)
    smooth_obj(obj)
    assign(obj, "black")
    return obj

# ─── 3. TOP PEAK ──────────────────────────────────────────────────────────────

def create_peak(col):
    # Thin wedge: rear edge sits flush on forehead, front lip angles down
    pts = [
        (-0.44,  0.52,  0.63), ( 0.44,  0.52,  0.63),   # rear top
        ( 0.40,  0.98,  0.54), (-0.40,  0.98,  0.54),   # front top
        (-0.44,  0.52,  0.56), ( 0.44,  0.52,  0.56),   # rear bottom
        ( 0.40,  0.98,  0.46), (-0.40,  0.98,  0.46),   # front bottom
    ]
    bm = closed_box(pts)
    obj = finalize(bm, "Top_Peak", col)
    add_bevel(obj, 0.014, 2, 25)
    add_subd(obj, 1, 2)
    smooth_obj(obj)
    assign(obj, "black")
    return obj

# ─── 4. FACE VISOR ────────────────────────────────────────────────────────────

def create_visor(col):
    bm = bmesh.new()
    U, V = 16, 12

    for j in range(V + 1):
        for i in range(U + 1):
            u  = i / U          # 0 = left edge, 1 = right edge
            vt = j / V          # 0 = bottom, 1 = top

            # Horizontal arc spanning ±40°
            ax = (u - 0.5) * math.radians(80)
            # Vertical arc from chin level to brow level
            az = math.radians(-28) + vt * math.radians(66)

            r = 0.952           # just inside the shell surface
            x =  math.sin(ax) * r
            y =  math.cos(ax) * r * 0.73 + 0.10
            z =  math.sin(az) * 0.74 - 0.03
            bm.verts.new((x, y, z))

    bm.verts.ensure_lookup_table()
    for j in range(V):
        for i in range(U):
            a = j * (U + 1) + i
            bm.faces.new([
                bm.verts[a],       bm.verts[a + 1],
                bm.verts[a+U+2],   bm.verts[a+U+1],
            ])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = finalize(bm, "Visor", col)
    add_solidify(obj, 0.020, -1.0)
    add_subd(obj, 1, 2)
    smooth_obj(obj, 80)
    assign(obj, "visor")
    return obj

# ─── 5. FOREHEAD VENT BLOCK ───────────────────────────────────────────────────

def create_forehead_vent(col):
    pts = [
        (-0.27, 0.62, 0.51), ( 0.27, 0.62, 0.51),   # front-top
        ( 0.22, 0.67, 0.63), (-0.22, 0.67, 0.63),   # rear-top
        (-0.25, 0.57, 0.50), ( 0.25, 0.57, 0.50),   # front-bot
        ( 0.20, 0.61, 0.61), (-0.20, 0.61, 0.61),   # rear-bot
    ]
    bm = closed_box(pts)
    obj = finalize(bm, "Vent_Forehead", col)
    add_bevel(obj, 0.009, 2, 25)
    smooth_obj(obj)
    assign(obj, "black")

    # Three grille slots
    for xc in (-0.13, 0.0, 0.13):
        sp = [
            (xc-0.037, 0.625, 0.518), (xc+0.037, 0.625, 0.518),
            (xc+0.033, 0.655, 0.542), (xc-0.033, 0.655, 0.542),
            (xc-0.037, 0.615, 0.513), (xc+0.037, 0.615, 0.513),
            (xc+0.033, 0.645, 0.537), (xc-0.033, 0.645, 0.537),
        ]
        bm2 = closed_box(sp)
        o2  = finalize(bm2, f"Vent_Slot_{xc:.2f}", col)
        smooth_obj(o2)
        assign(o2, "gun")

    return obj

# ─── 6. CHEEK PANELS ──────────────────────────────────────────────────────────

def create_cheek_panels(col):
    for sign, label in ((-1, "L"), (1, "R")):
        bm = bmesh.new()
        SU, SV = 12, 9

        for j in range(SV + 1):
            for i in range(SU + 1):
                u  = i / SU
                vt = j / SV
                # Horizontal span: 28°–86° from front
                ah = math.radians(28) + u * math.radians(58)
                # Vertical span: -42° to +14° (from lower side to temple)
                av = math.radians(-42) + vt * math.radians(56)
                r  = 1.014

                x =  sign * math.cos(av) * math.sin(ah) * r
                y =         math.cos(av) * math.cos(ah) * r * 0.93
                z =         math.sin(av) * r * 0.90
                bm.verts.new((x, y, z))

        bm.verts.ensure_lookup_table()
        for j in range(SV):
            for i in range(SU):
                a = j * (SU + 1) + i
                if sign < 0:
                    bm.faces.new([bm.verts[a],      bm.verts[a+1],
                                   bm.verts[a+SU+2], bm.verts[a+SU+1]])
                else:
                    bm.faces.new([bm.verts[a+SU+1], bm.verts[a+SU+2],
                                   bm.verts[a+1],    bm.verts[a]])

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        obj = finalize(bm, f"Cheek_Panel_{label}", col)
        add_solidify(obj, 0.024, -1.0)
        add_subd(obj, 1, 2)
        smooth_obj(obj)
        assign(obj, "black")

# ─── 7. LOWER TRIM RING ───────────────────────────────────────────────────────

def create_lower_trim(col):
    bm = bmesh.new()
    N = 36

    for i in range(N + 1):
        t     = i / N
        angle = math.radians(-90) + t * math.radians(180)
        ro, ri = 1.045, 0.990
        sx = math.sin(angle)
        sy = math.cos(angle) * 0.91

        for r in (ro, ri):
            for dz in (0.042, -0.042):
                bm.verts.new((sx * r, sy * r, -0.335 + dz))

    bm.verts.ensure_lookup_table()
    for i in range(N):
        b = i * 4
        n = (i + 1) * 4
        bm.faces.new([bm.verts[b],   bm.verts[n],   bm.verts[n+2], bm.verts[b+2]])  # outer
        bm.faces.new([bm.verts[b+1], bm.verts[b+3], bm.verts[n+3], bm.verts[n+1]])  # inner
        bm.faces.new([bm.verts[b],   bm.verts[b+1], bm.verts[n+1], bm.verts[n]])    # top
        bm.faces.new([bm.verts[b+2], bm.verts[n+2], bm.verts[n+3], bm.verts[b+3]]) # bot

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = finalize(bm, "Lower_Trim", col)
    add_bevel(obj, 0.008, 2)
    smooth_obj(obj)
    assign(obj, "rubber")
    return obj

# ─── 8. SCREWS / BOLTS ────────────────────────────────────────────────────────

def create_screws(col):
    positions = [
        (( 0.47, 0.56,  0.33), (0,            math.pi / 2, 0)),
        ((-0.47, 0.56,  0.33), (0,            math.pi / 2, 0)),
        (( 0.47, 0.41, -0.27), (0,            math.pi / 2, 0)),
        ((-0.47, 0.41, -0.27), (0,            math.pi / 2, 0)),
        (( 0.31, 0.68,  0.49), (math.pi/5,    math.pi / 2, 0)),
        ((-0.31, 0.68,  0.49), (math.pi/5,    math.pi / 2, 0)),
    ]
    for idx, (pos, rot) in enumerate(positions):
        bm = bmesh.new()
        bmesh.ops.create_cylinder(
            bm, cap_ends=True, cap_tris=False,
            segments=10, radius1=0.018, radius2=0.018, depth=0.022)
        obj = finalize(bm, f"Screw_{idx:02d}", col)
        obj.location        = pos
        obj.rotation_euler  = rot
        smooth_obj(obj)
        assign(obj, "screw")

# ─── 9. RED ACCENT STRIPS ─────────────────────────────────────────────────────

def create_red_accents(col):
    for sign, label in ((-1, "L"), (1, "R")):
        hw = 0.055
        base_x = sign * 0.505
        pts = [
            (base_x - hw, -0.46, -0.27), (base_x + hw, -0.46, -0.27),
            (base_x + hw, -0.53, -0.23), (base_x - hw, -0.53, -0.23),
            (base_x - hw, -0.46, -0.35), (base_x + hw, -0.46, -0.35),
            (base_x + hw, -0.53, -0.31), (base_x - hw, -0.53, -0.31),
        ]
        bm = closed_box(pts)
        obj = finalize(bm, f"Red_Accent_{label}", col)
        add_bevel(obj, 0.006, 2)
        smooth_obj(obj)
        assign(obj, "red")

# ─── 10. REAR DETAIL ACCENTS ──────────────────────────────────────────────────

def create_rear_accents(col):
    """Small gunmetal fins at the rear lower edge."""
    for sign, label in ((-1, "L"), (1, "R")):
        for i, z_off in enumerate((0.0, -0.08)):
            x = sign * 0.72
            pts = [
                (x - sign*0.04, -0.70,  0.02 + z_off),
                (x + sign*0.04, -0.70,  0.02 + z_off),
                (x + sign*0.04, -0.82,  0.06 + z_off),
                (x - sign*0.04, -0.82,  0.06 + z_off),
                (x - sign*0.04, -0.70, -0.04 + z_off),
                (x + sign*0.04, -0.70, -0.04 + z_off),
                (x + sign*0.04, -0.82,  0.00 + z_off),
                (x - sign*0.04, -0.82,  0.00 + z_off),
            ]
            bm = closed_box(pts)
            obj = finalize(bm, f"Rear_Fin_{label}_{i}", col)
            add_bevel(obj, 0.005, 2)
            smooth_obj(obj)
            assign(obj, "gun")

# ─── 11. LIGHTING ─────────────────────────────────────────────────────────────

def setup_lighting(col):
    # (name, location, rotation_euler_deg, energy_W, size_m)
    lights = [
        ("Key",  (-2.9, -2.6,  4.3), ( 52, -22, -32), 1500, 2.5),
        ("Fill", ( 3.3, -1.6,  2.6), ( 22,  28,  40),  550, 4.2),
        ("Rim",  ( 0.5,  3.3,  2.9), (-44,   0,  12),  750, 1.7),
        ("Top",  ( 0.0,  0.2,  5.5), (  0,   0,   0),  380, 3.5),
        ("Bot",  ( 0.0,  0.0, -3.0), (180,   0,   0),  120, 4.0),
    ]
    for name, loc, rot_deg, energy, size in lights:
        bpy.ops.object.light_add(type="AREA", location=loc)
        li = bpy.context.active_object
        li.name = f"Light_{name}"
        li.data.energy = energy
        li.data.size   = size
        li.rotation_euler = Euler(
            tuple(math.radians(d) for d in rot_deg), "XYZ")
        link_to_col(li, col)

# ─── 12. CAMERA ───────────────────────────────────────────────────────────────

def setup_camera(col):
    bpy.ops.object.camera_add(location=(-2.65, -2.25, 1.30))
    cam = bpy.context.active_object
    cam.name = "Camera_Main"
    cam.data.lens       = 70.0
    cam.data.clip_start = 0.10
    cam.data.clip_end   = 100.0
    cam.rotation_euler  = Euler(
        (math.radians(74), 0, math.radians(-49)), "XYZ")
    bpy.context.scene.camera = cam
    link_to_col(cam, col)
    return cam

# ─── 13. WORLD & RENDER SETTINGS ─────────────────────────────────────────────

def setup_render():
    sc = bpy.context.scene

    # Cycles + denoising
    sc.render.engine          = "CYCLES"
    sc.cycles.samples         = 256
    sc.cycles.use_denoising   = True
    sc.render.resolution_x    = 1024
    sc.render.resolution_y    = 1024
    sc.render.film_transparent = True
    sc.render.filepath        = PNG_PATH
    sc.render.image_settings.file_format = "PNG"

    # Dark studio background
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value    = (0.016, 0.016, 0.020, 1)
        bg.inputs["Strength"].default_value = 0.35

# ─── 14. EXPORT ───────────────────────────────────────────────────────────────

def do_export(skip_render=False):
    # Ensure GLTF addon is active
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")

    # .blend
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"[Helmet] .blend  → {BLEND_PATH}")

    # .glb
    bpy.ops.export_scene.gltf(
        filepath       = GLB_PATH,
        export_format  = "GLB",
        export_apply   = True,
        export_materials = "EXPORT",
    )
    print(f"[Helmet] .glb   → {GLB_PATH}")

    # PNG render
    if not skip_render:
        bpy.ops.render.render(write_still=True)
        print(f"[Helmet] .png   → {PNG_PATH}")

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    clear_scene()

    root      = bpy.context.scene.collection
    c_shell   = new_col("Helmet_Shell", root)
    c_visor   = new_col("Visor",        root)
    c_details = new_col("Details",      root)
    c_light   = new_col("Lighting",     root)
    c_cam     = new_col("Camera",       root)

    build_materials()

    # ── Geometry ──────────────────────────────────────────────────────────────
    create_shell(c_shell)
    create_chin_guard(c_details)
    create_peak(c_details)
    create_visor(c_visor)
    create_forehead_vent(c_details)
    create_cheek_panels(c_details)
    create_lower_trim(c_details)
    create_screws(c_details)
    create_red_accents(c_details)
    create_rear_accents(c_details)

    # ── Scene ─────────────────────────────────────────────────────────────────
    setup_lighting(c_light)
    setup_camera(c_cam)
    setup_render()

    # ── Output ────────────────────────────────────────────────────────────────
    do_export(skip_render=False)
    print("[Helmet] Done ✓")

if __name__ == "__main__":
    main()
