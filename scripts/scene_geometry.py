"""Original Blender geometry shared by the ten OpenStrand rooms.

Coordinates are metres; +Y points into the room. The entry and camera route
belong to render-scene-films.py, never to a room module.
"""
import math
import bpy
from mathutils import Vector


def linear_rgb(value):
    value = value.lstrip("#")
    channels = [int(value[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    return tuple(channel / 12.92 if channel <= .04045 else
                 ((channel + .055) / 1.055) ** 2.4 for channel in channels)


class SceneGeometry:
    def __init__(self, scene, accent_hex, fps=24):
        self.scene, self.fps, self.materials = scene, fps, {}
        definitions = {
            "cream": ("Warm linen", "#ece8d8", .8, 0, 0),
            "ink": ("Charcoal frame", "#202a2b", .52, .18, 0),
            "navy": ("Deep slate", "#263c43", .75, 0, 0),
            "wood": ("Oak joinery", "#866f53", .58, 0, 0),
            "woodlight": ("Maple tabletop", "#c4ad88", .42, 0, 0),
            "gold": ("Brushed brass", "#bca77d", .38, .55, 0),
            "accent": ("Strand accent", accent_hex, .58, 0, 0),
            "chair": ("Upholstery", "#b1a286", .85, 0, 0),
            "green": ("Quiet foliage", "#59745c", .78, 0, 0),
            "screen": ("Deep display", "#193b45", .38, 0, .35),
            "light": ("Daylight glazing", "#dbe5dc", .65, 0, .55),
            "white": ("White ceramic", "#f4f0e3", .48, 0, 0),
            "whiteglow": ("Warm diffuser", "#fff0ce", .5, 0, 2),
            "wall": ("Warm architectural plaster", "#d0cbb9", .85, 0, 0),
            "floor": ("Corridor terrazzo", "#857f71", .75, 0, 0),
        }
        for key, (name, colour, rough, metal, emission) in definitions.items():
            self.materials[key] = self.mat(name, colour, rough, metal, emission)
        for alias, key in {"black": "ink", "chairmat": "chair",
                           "screenmat": "screen", "lightmat": "light"}.items():
            self.materials[alias] = self.materials[key]

    def mat(self, name, color, rough=.5, metallic=0, emission=0):
        material = bpy.data.materials.new(name)
        colour = (*linear_rgb(color), 1)
        material.diffuse_color = colour
        material.use_nodes = True
        surface = material.node_tree.nodes.get("Principled BSDF")
        surface.inputs["Base Color"].default_value = colour
        surface.inputs["Roughness"].default_value = rough
        surface.inputs["Metallic"].default_value = metallic
        if emission:
            surface.inputs["Emission Color"].default_value = colour
            surface.inputs["Emission Strength"].default_value = emission
        return material

    @staticmethod
    def _finish(obj, name, material, bevel=0):
        obj.name = name
        if material:
            obj.data.materials.append(material)
        if bevel:
            modifier = obj.modifiers.new("Tactile edge", "BEVEL")
            modifier.width, modifier.segments = bevel, 2
            obj.modifiers.new("Architectural normals", "WEIGHTED_NORMAL")
        obj["scene_collidable"] = True
        return obj

    def cube(self, name, loc, scale, material, bevel=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        obj = bpy.context.object
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return self._finish(obj, name, material, bevel)

    def cyl(self, name, loc, radius, depth, material, vertices=64):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                          depth=depth, location=loc)
        return self._finish(bpy.context.object, name, material,
                            min(.018, radius * .12, depth * .18))

    def sphere(self, name, loc, scale, material):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10,
                                           radius=1, location=loc)
        obj = bpy.context.object
        obj.scale = scale
        self._finish(obj, name, material)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        return obj

    def line(self, name, a, b, radius, material):
        delta = Vector(b) - Vector(a)
        obj = self.cyl(name, (Vector(a) + Vector(b)) / 2, radius,
                       delta.length, material, 12)
        obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
        return obj

    def text(self, name, body, loc, size, material):
        curve = bpy.data.curves.new(name, "FONT")
        curve.body, curve.size, curve.extrude, curve.align_x = body, size, .0005, "CENTER"
        obj = bpy.data.objects.new(name, curve)
        bpy.context.collection.objects.link(obj)
        obj.location, obj.rotation_euler = loc, (math.pi / 2, 0, 0)
        obj.data.materials.append(material)
        obj["scene_collidable"] = False
        return obj

    def area(self, name, loc, power, color, size, target):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.color, light.shape, light.size = power, linear_rgb(color), "DISK", size
        obj = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
        return obj

    def chair(self, x, y, angle, material=None):
        """Human-scale chair; back is +Y before the assembly rotates."""
        fabric = material or self.materials["chair"]
        group = bpy.data.objects.new("Interview chair assembly", None)
        bpy.context.collection.objects.link(group)
        group.location, group.rotation_euler.z = (x, y, 0), angle
        def attach(obj):
            obj.parent = group
            return obj
        attach(self.cube("Interview chair seat", (0, 0, .46), (.62, .58, .10), fabric, .065))
        attach(self.cube("Interview chair back", (0, .25, .80), (.62, .08, .60), fabric, .07))
        for lx in (-.24, .24):
            for ly in (-.21, .21):
                attach(self.line("Chair tapered leg", (lx, ly, .43), (lx * 1.12, ly * 1.12, .03), .018, self.materials["ink"]))
        return group

    def animate_rotation(self, obj, axis, amplitude):
        index = {"x": 0, "y": 1, "z": 2}.get(axis, axis)
        base = obj.rotation_euler[index]
        for time, offset in ((0, 0), (3, amplitude), (7, -amplitude * .5), (12, 0)):
            obj.rotation_euler[index] = base + offset
            obj.keyframe_insert(data_path="rotation_euler", frame=round(time * self.fps) + 1)

    def plant(self, x, y, height=1.45):
        self.cyl("Stone planter", (x, y, .22), .22, .44, self.materials["cream"], 32)
        for index in range(7):
            angle, top = index * 2.4, .65 + index * (height - .65) / 7
            end = (x + math.cos(angle) * .23, y + math.sin(angle) * .23, top)
            self.line("Quiet stem", (x, y, .35), end, .009, self.materials["green"])
            leaf = self.sphere("Quiet leaf", end, (.19, .075, .10), self.materials["green"])
            leaf.rotation_euler = (.35, 0, angle)
            self.animate_rotation(leaf, "z", .055)

    def table(self, x=0, y=1.4, width=2.2, depth=1.25, material=None):
        self.cube("Interview tabletop", (x, y, .76), (width, depth, .075), material or self.materials["woodlight"], .04)
        for dx in (-width * .35, width * .35):
            for dy in (-depth * .33, depth * .33):
                self.cube("Table leg", (x + dx, y + dy, .36), (.07, .07, .72), self.materials["ink"], .012)

    @staticmethod
    def bounds(obj):
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        return ([round(min(corner[index] for corner in corners), 5) for index in range(3)],
                [round(max(corner[index] for corner in corners), 5) for index in range(3)])
