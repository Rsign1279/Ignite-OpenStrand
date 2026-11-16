"""Render original OpenStrand scene films in Blender, then encode with ffmpeg.

Usage: blender -b -t 2 -P scripts/render-scene-films.py -- technology [--preview]
All geometry and animation are authored here; no external textures or people assets.
"""
import bpy, math, sys, os, random
from mathutils import Vector
from pathlib import Path
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
strand = args[0] if args else 'technology'
preview = '--preview' in args
settings = {
 'technology': ('PRODUCT STUDIO', '#8dbed3', 'screen'),
 'health-sciences': ('LEARNING CENTER', '#9cbfb2', 'health'),
 'law-public-policy': ('CIVIC MEETING ROOM', '#b6add4', 'plans'),
 'aviation': ('AVIATION TRAINING HUB', '#95bdd1', 'aircraft'),
 'culinary': ('CHEF’S TABLE', '#d3ac8d', 'culinary'),
 'engineering': ('DESIGN WORKSHOP', '#b3bea4', 'prototype'),
 'construction': ('PROJECT PLANNING ROOM', '#c9b78e', 'plans'),
 'education': ('SCHOOL MEETING ROOM', '#d1bf96', 'books'),
 'business': ('VENTURE STUDIO', '#adb7cd', 'charts'),
 'digital-media': ('CREATIVE STUDIO', '#c3a4be', 'screen'),
}
label, accent_hex, prop = settings[strand]
out = Path(os.environ.get('SCENE_RENDER_DIR', '/workspace/scratch/scene-render')) / strand
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
random.seed(42)

def rgb(h):
 h=h.lstrip('#'); return tuple(((int(h[i:i+2],16)/255 + .055)/1.055)**2.4 for i in (0,2,4))
def mat(name, color, rough=.5, metallic=0, emission=0):
 m=bpy.data.materials.new(name); m.diffuse_color=(*rgb(color),1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb(color),1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metallic
 if emission:
  bs.inputs['Emission Color'].default_value=(*rgb(color),1); bs.inputs['Emission Strength'].default_value=emission
 return m
navy=mat('Midnight blue plaster','#152b38',.75)
wood=mat('Warm oak','#826d4f',.45)
woodlight=mat('Polished maple tabletop','#bfaa83',.3)
cream=mat('Linen paper','#e9e4cd',.8)
gold=mat('Brushed brass','#bfa66b',.28,.7)
black=mat('Ink metal','#17232b',.25,.55)
accent=mat('Strand accent',accent_hex,.6)
chairmat=mat('Ochre velvet','#bba478',.85)
green=mat('Sage foliage','#516e50',.75)
screenmat=mat('Active display','#102b3b',.32,0,.3)
lightmat=mat('Window daylight',accent_hex,.7,0,1.8)
whiteglow=mat('Soft warm light','#fff5da',.4,0,3)

def cube(name, loc, scale, material, bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); ob=bpy.context.object; ob.name=name; ob.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if material: ob.data.materials.append(material)
 if bevel:
  m=ob.modifiers.new('Rounded edges','BEVEL'); m.width=bevel; m.segments=3
  ob.modifiers.new('Weighted normal','WEIGHTED_NORMAL')
 return ob

def cyl(name,loc,radius,depth,material,vertices=64):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc); ob=bpy.context.object; ob.name=name; ob.data.materials.append(material)
 bevel=ob.modifiers.new('Soft edge','BEVEL'); bevel.width=.035; bevel.segments=3; ob.modifiers.new('Weighted normal','WEIGHTED_NORMAL'); return ob

def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc); ob=bpy.context.object; ob.name=name; ob.scale=scale; ob.data.materials.append(material)
 for p in ob.data.polygons:p.use_smooth=True
 return ob

def line(name,a,b,r,material):
 delta=Vector(b)-Vector(a); ob=cyl(name,(Vector(a)+Vector(b))/2,r,delta.length,material,12); ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return ob

def text(name,body,loc,size,material):
 curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.size=size;curve.extrude=.001;curve.align_x='CENTER';ob=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(math.pi/2,0,0);ob.data.materials.append(material);return ob

def area(name,loc,power,color,size,target):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=rgb(color);d.shape='DISK';d.size=size;ob=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob

# Architectural chamber, open toward the camera.
cube('Oak floor',(0,0,-.12),(14,14,.2),wood)
for x in range(-7,8): cube('Floor join',(x,0,-.012),(.012,14,.005),black)
cube('Back plaster wall',(0,4,3),(14,.3,6.3),navy)
cube('Left wall',(-6,0,3),(.3,8,6.3),navy)
cube('Right wall',(6,0,3),(.3,8,6.3),navy)
# Windows, broad daylight bands and framed city silhouettes.
for x in [-3.7,-1.4,.9]:
 cube('Window brass surround',(x,3.81,3.08),(1.95,.12,4.95),gold,.04)
 cube('Window glass',(x,3.7,3.08),(1.81,.09,4.8),lightmat,.03)
 cube('Window mullion',(x,3.61,3.08),(.035,.08,4.8),black)
 cube('Window crossbar',(x,3.60,2.95),(1.82,.08,.035),black)
 for j in range(4):
  h=random.uniform(.25,.8); cube('Distant city',(x-.65+j*.42,3.64,1+h/2),(.26,.015,h),navy,.01)
# Framed strand display and text.
cube('Display surround',(3.6,3.72,3.4),(2.15,.17,1.65),gold,.045)
cube('Display',(3.6,3.60,3.4),(2.0,.08,1.5),screenmat,.035)
text('OpenStrand wordmark','IGNITE',(3.6,3.53,3.82),.24,cream)
text('Strand title',label,(3.6,3.53,3.52),.095,cream)
for j in range(3):
 bar=cube('Display activity',(3.6-.35+j*.35,3.52,3.1),(.16,.02,.20+j*.13),accent,.02)
 for frame,factor in [(1,1),(48,1.5),(96,.7),(144,1.2)]:
  bar.scale.z=factor;bar.keyframe_insert(data_path='scale',frame=frame)
# Slatted wall detail on the right.
for x in [5.1+i*.16 for i in range(6)]:cube('Timber wall batten',(x,3.72,3),(.055,.17,5.8),wood,.01)
# Oval conference table.
table=cyl('Oval table',(0,.3,1.5),1.7,.15,woodlight,96);table.scale=(1.25,.75,1)
for x in [-1.1,1.1]:
 leg=cube('Table trestle',(x,.3,.73),(.20,1.5,1.5),wood,.04);leg.rotation_euler.y=math.radians(-8 if x<0 else 8)
# Refined upholstered seats.
def chair(x,y,angle):
 group=bpy.data.objects.new('Chair assembly',None);bpy.context.collection.objects.link(group);group.location=(x,y,0);group.rotation_euler.z=angle
 def attach(ob):ob.parent=group;return ob
 attach(cube('Upholstered seat',(0,0,.76),(1.02,.93,.18),chairmat,.16))
 attach(cube('Soft chair back',(0,.36,1.24),(1.02,.16,.9),chairmat,.19))
 for lx in [-.36,.36]:
  for ly in [-.30,.30]:attach(line('Chair tapered leg',(lx,ly,.73),(lx*1.15,ly*1.2,.04),.025,black))
 for lx in [-.49,.49]:attach(line('Chair arm',(lx,-.28,1),(lx,.25,1.05),.035,gold))
 return group
chair(-.12,-1.6,math.pi)
chair(.0,2.05,0)
chair(-2.9,.3,math.pi/2)
# A notebook, pencil, cup, and animated laptop establish interview cues.
notebook=cube('Interview notebook',(.35,.2,1.60),(.68,.49,.035),cream,.018);notebook.rotation_euler.z=.14
for k in range(7): cube('Notebook ruled line',(.35,.04+k*.045,1.623),(.47,.005,.002),accent)
line('Pencil',(.85,-.04,1.64),(1.14,.35,1.64),.012,gold)
cup=cyl('Ceramic cup',(-.98,-.06,1.75),.13,.3,cream)
cyl('Coffee',(-.98,-.06,1.906),.109,.004,black)
bpy.ops.mesh.primitive_torus_add(major_radius=.09,minor_radius=.02,location=(-.83,-.06,1.75),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(cream)
base=cube('Laptop base',(0,.91,1.64),(.99,.65,.028),black,.035)
lid=cube('Laptop lid',(0,1.20,1.99),(.99,.035,.66),black,.035)
face=cube('Laptop screen',(0,1.175,1.99),(.91,.008,.58),screenmat,.02)
for n in range(4):cube('Screen lines',(-.15+n*.03,1.162,2.17-n*.10),(.44-n*.05,.006,.016),accent,.005)
# Low bookshelves and curated objects along the left wall.
cube('Credenza',(-4.35,1.45,.63),(1.15,3.4,1.2),wood,.05)
for y in [.2,.6,1,1.4,1.8,2.2,2.6]:
 book=cube('Reference book',(-4.3,y,1.44),(.45,.12,.4+random.random()*.15),accent,.008);book.rotation_euler.x=random.uniform(-.12,.12)
# Individual strand object on the desk's right edge.
if prop in ['prototype','plans']:
 cube('Project base',(1.3,.6,1.62),(.65,.6,.035),cream)
 for dx,dy,h in [(-.15,0,.28),(.1,.08,.45),(.2,-.15,.18)]:cube('Architectural prototype',(1.3+dx,.6+dy,1.65+h/2),(.19,.19,h),accent,.025)
elif prop=='aircraft':
 plane=cube('Aircraft fuselage',(1.3,.6,1.81),(.11,.67,.10),cream,.04)
 cube('Aircraft wing',(1.3,.6,1.81),(.67,.19,.025),accent,.03)
 cube('Aircraft tail',(1.3,.87,1.88),(.22,.10,.11),accent,.02)
elif prop=='culinary':
 plate=cyl('Tasting plate',(1.3,.6,1.65),.3,.025,cream)
 for i in range(3):sphere('Citrus fruit',(1.2+i*.12,.6,1.73),(.075,.075,.075),accent)
elif prop=='health':
 cube('Simulation kit',(1.3,.6,1.74),(.55,.35,.22),cream,.05)
 cube('Care symbol vertical',(1.3,.412,1.75),(.045,.01,.13),accent)
 cube('Care symbol horizontal',(1.3,.410,1.75),(.13,.01,.045),accent)
elif prop=='charts':
 cube('Pitch deck stand',(1.35,.65,1.64),(.66,.36,.04),black,.025)
 cube('Pitch deck display',(1.35,.65,1.96),(.63,.025,.60),cream,.025)
 for n,height in enumerate([.13,.23,.34]):
  cube('Project chart bar',(1.16+n*.19,.628,1.72+height/2),(.10,.012,height),accent,.01)
else:
 for n in range(3):
  book=cube('Portfolio book',(1.35,.6,1.65+n*.047),(.58,.42,.042),accent if n%2==0 else cream,.01);book.rotation_euler.z=n*.15
# Plants with softly animated foliage.
for x,y in [(-3.6,3.15),(4.7,2.1)]:
 cyl('Stone planter',(x,y,.34),.35,.65,cream)
 for i in range(9):
  angle=i*2.4;h=.9+i*.11;tx=x+math.cos(angle)*.40;ty=y+math.sin(angle)*.30
  line('Plant stem',(x,y,.5),(tx,ty,h+.3),.012,green)
  leaf=sphere('Plant leaf',(tx,ty,h+.3),(.26,.09,.12),green);leaf.rotation_euler=(.4,0,angle)
  for frame,offset in [(1,0),(48,.12),(96,-.06),(144,0)]:
   leaf.rotation_euler.z=angle+offset;leaf.keyframe_insert(data_path='rotation_euler',frame=frame)
# Pendant lighting.
for x in [-1.4,1.4]:
 line('Pendant cable',(x,.4,5.9),(x,.4,4.4),.008,black)
 shade=sphere('Pendant shade',(x,.4,4.38),(.40,.40,.11),gold)
 cyl('Pendant diffuser',(x,.4,4.31),.31,.01,whiteglow)
 area('Pendant pool',(x,.4,4.27),90,'#ffe2ae',1.4,(x,.4,0))
area('Window key',(-3,2.8,4.6),1600,accent_hex,5,(0,0,1))
area('Front softbox',(1,-5,5),750,'#ffe9bf',5,(0,.3,1.6))
area('Right rim',(5,2,4.2),500,'#a7c8dc',3,(0,0,1.8))
sun=area('Moving sunlight',(-4,1,5.5),550,'#ffdcaa',2,(0,-1,0))
sun.location=(-4,1,5.5);sun.keyframe_insert(data_path='location',frame=1)
sun.location=(-2,2,5.5);sun.keyframe_insert(data_path='location',frame=144)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.17,.21,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3
# Dolly toward the open seat, with restrained focus falloff.
bpy.ops.object.camera_add(location=(5.9,-8.3,4.7));cam=bpy.context.object;cam.name='Cinematic dolly';bpy.context.scene.camera=cam;cam.data.lens=42
focus=bpy.data.objects.new('Interview table focus',None);bpy.context.collection.objects.link(focus);focus.location=(0,.45,1.7)
cam.data.dof.use_dof=False;cam.data.dof.focus_object=focus;cam.data.dof.aperture_fstop=5.6
for frame,loc,target,lens in [(1,(5.9,-8.3,4.7),(0,.7,2.05),42),(72,(4.85,-7.4,4.35),(0,.65,1.95),43),(144,(3.8,-6.5,4.05),(0,.6,1.85),44)]:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens;cam.keyframe_insert(data_path='location',frame=frame);cam.keyframe_insert(data_path='rotation_euler',frame=frame);cam.data.keyframe_insert(data_path='lens',frame=frame)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.eevee.taa_render_samples=8;scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=12;scene.frame_start=1;scene.frame_end=144;scene.frame_step=2
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.1
scene.render.film_transparent=False
scene.render.filepath=str(out / 'frame-')
if preview:
 scene.frame_set(70);scene.render.filepath=str(out / 'preview.png');bpy.ops.render.render(write_still=True)
else:
 bpy.ops.render.render(animation=True)
