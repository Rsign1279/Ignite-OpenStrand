"""Five original, human-scale interview environments for the walk-in films.

All room geometry is procedural. The unobstructed candidate route stays on the
front-left side of the room; each interview station faces the candidate at -Y.
"""
import math

SUPPORTED = {
    "technology", "health-sciences", "law-public-policy", "aviation", "culinary"
}


def _station(api, name, top, material, shape="rect"):
    """Interview furniture stays beyond the walking route, at normal desk height."""
    if shape == "round":
        desk = api.cyl(name + " tabletop", (0, 1.35, .765), 1.25, .085, material)
        desk.scale = (1, .66, 1)
        api.cyl(name + " pedestal", (0, 1.35, .37), .12, .70, api.materials["ink"])
        api.cyl(name + " pedestal foot", (0, 1.35, .04), .45, .06, api.materials["ink"])
    else:
        api.cube(name + " tabletop", (0, 1.35, .765), top, material, .06)
        for x in [-.91, .91]:
            for y in [.88, 1.82]:
                api.line(name + " slender leg", (x, y, .72), (x * 1.06, y, .03), .035, api.materials["ink"])
    api.chair(0, 2.65, 0)
    # Nothing blocks the approaching candidate. The near side remains open.
    api.cube(name + " interview notes", (.40, 1.10, .819), (.43, .32, .014), api.materials["cream"], .007)
    for i in range(4):
        api.cube(name + " note rule", (.4, 1.00 + i * .045, .828), (.30, .003, .002), api.materials["accent"])
    api.line(name + " pencil", (.70, .99, .828), (.77, 1.22, .828), .008, api.materials["gold"])


def _books(api, name, x, y, z, count=7, color=None):
    colors = [color or api.materials["accent"], api.materials["cream"], api.materials["woodlight"]]
    for i in range(count):
        height = .26 + (i % 4) * .025
        api.cube(name + " volume %02d" % i, (x + i * .10, y, z + height / 2), (.075, .20, height), colors[i % 3], .006)


def _panel(api, name, x, z, width, height, material, y=4.77):
    return api.cube(name, (x, y, z), (width, .06, height), material, .025)


def _technology(api):
    m = api.materials
    wall = api.mat("Technology midnight acoustic wall", "#233c40", .83)
    mint = api.mat("Technology interface mint", "#b8e4d2", .6, emission=.15)
    steel = api.mat("Technology powder-coated steel", "#546965", .42, metallic=.25)
    screen = api.mat("Technology prototype screen", "#19332e", .4, emission=.35)
    _panel(api, "Technology full rear acoustic treatment", 0, 1.8, 10.5, 3.5, wall)
    # A broad product wall, rather than the shared old conference-room window.
    _panel(api, "Technology prototype wall frame", .2, 2.05, 4.4, 2.0, m["ink"], y=4.62)
    _panel(api, "Technology prototype canvas", .2, 2.05, 4.20, 1.80, screen, y=4.56)
    api.text("Technology product label", "PRODUCT LAB", (.2, 4.50, 2.65), .20, m["cream"])
    for i in range(3):
        _panel(api, "Technology browser prototype card %d" % i, -1.12 + i * 1.25, 2.02, 1.04, .73, mint, y=4.49)
        _panel(api, "Technology card preview %d" % i, -1.12 + i * 1.25, 2.13, .88, .29, m["accent"], y=4.44)
        for j in range(2):
            _panel(api, "Technology interface text %d %d" % (i, j), -1.22 + i * 1.25, 1.86 - .10 * j, .64 - j * .18, .025, wall, y=4.44)
    api.cube("Technology ceiling suspended acoustic raft", (.3, 1.9, 3.12), (4.6, 3.3, .12), wall, .06)
    for x in [-1.5, 1.9]:
        api.cube("Technology linear light", (x, 1.8, 3.04), (.045, 2.6, .025), m["whiteglow"])
    # Visible lab hardware is to the left beyond the clear arrival route.
    api.cube("Technology server rack", (-4.35, 3.72, 1.1), (.88, .68, 2.1), m["ink"], .05)
    for j in range(7):
        api.cube("Technology server unit %d" % j, (-4.35, 3.36, .40 + j * .24), (.72, .035, .17), steel, .012)
        api.sphere("Technology server status %d" % j, (-4.63, 3.33, .40 + j * .24), (.018, .012, .018), mint)
    # Angled sketch board changes the room's right silhouette.
    board = api.cube("Technology collaborative whiteboard", (3.72, 3.65, 1.80), (2.20, .13, 1.55), m["cream"], .045)
    board.rotation_euler.z = -.08
    api.text("Technology whiteboard heading", "BUILD / TEST / LEARN", (3.72, 3.55, 2.29), .13, wall)
    for x, z in [(3.1, 1.90), (3.7, 1.90), (4.3, 1.90), (3.4, 1.45), (4.0, 1.45)]:
        api.cube("Technology idea note", (x, 3.54, z), (.30, .015, .27), mint, .01)
    for x in [2.96, 4.48]:
        api.line("Technology whiteboard support", (x, 3.7, .12), (x, 3.7, 1.4), .025, steel)
    _station(api, "Technology product interview", (2.5, 1.45, .085), m["woodlight"])
    api.cube("Technology tablet on stand", (-.64, 1.68, 1.02), (.66, .045, .38), m["ink"], .025)
    api.cube("Technology tablet prototype", (-.64, 1.651, 1.02), (.58, .012, .29), mint, .015)
    for x in [-.80, -.56]:
        api.cube("Technology tablet interface", (x, 1.640, 1.02), (.16, .006, .18), screen, .008)
    api.area("Technology screen bounce", (.2, 4.25, 2.4), 75, "#b8e4d2", 3.0, (0, 1.2, 1))
    return {"room_title": "The product lab", "visual_anchors": ["prototype interface wall", "server rack", "collaborative sketch board"], "scenario": "A student technology internship interview about contributing to a team prototype."}


def _health(api):
    m = api.materials
    sage = api.mat("Health sage wall finish", "#9ebeb2", .75)
    pale = api.mat("Health warm-white clinical joinery", "#e3ece2", .72)
    glass = api.mat("Health frosted training divider", "#b9d2ca", .55)
    steel = api.mat("Health satin stainless steel", "#9aa9a1", .35, metallic=.55)
    blue = api.mat("Health training linen", "#a9cbc5", .9)
    _panel(api, "Health sage rear wall", 0, 1.8, 10.5, 3.5, pale)
    for x in [-4.5, -3.4, -2.3]:
        _panel(api, "Health tall sage acoustic panel", x, 1.8, .85, 3.25, sage, y=4.65)
    api.text("Health simulation room label", "SIMULATION BRIEFING", (.1, 4.61, 2.70), .22, m["ink"])
    # Open briefing table and separate, unoccupied training zone.
    _station(api, "Health briefing", (), pale, shape="round")
    api.cube("Health supervision folder", (-.47, 1.48, .833), (.46, .32, .035), sage, .018)
    api.cube("Health simulation kit", (-.46, 1.49, .927), (.29, .19, .15), pale, .03)
    api.cube("Health kit training mark vertical", (-.46, 1.388, .93), (.025, .006, .075), sage)
    api.cube("Health kit training mark horizontal", (-.46, 1.386, .93), (.075, .006, .025), sage)
    # Frosted panels sit toward the rear of the training zone. The open front
    # keeps the unoccupied mattress, pillow and bed frame visible from the POV.
    for y in [2.55, 3.75, 4.65]:
        api.cube("Health divider support", (2.55, y, 1.20), (.045, .045, 2.35), steel, .008)
    for y in [3.15, 4.20]:
        api.cube("Health frosted divider pane", (2.55, y, 1.11), (.035, 1.12, 1.65), glass, .012)
    api.cube("Health empty simulation bed mattress", (3.75, 2.45, .79), (1.02, 2.13, .18), blue, .10)
    api.cube("Health bed pillow", (3.75, 3.13, .93), (.66, .42, .13), pale, .08)
    api.cube("Health bed frame", (3.75, 2.45, .62), (1.10, 2.20, .10), steel, .04)
    for x in [3.31, 4.19]:
        for y in [1.57, 3.30]:
            api.line("Health bed leg", (x, y, .58), (x, y, .15), .035, steel)
            api.sphere("Health bed caster", (x, y, .11), (.07, .045, .07), m["ink"])
    api.cube("Health bed headboard", (3.75, 3.56, 1.0), (1.1, .08, .74), pale, .055)
    # Wall-mounted skill schedule and cupboards, deliberately no patient data.
    _panel(api, "Health training schedule frame", .1, 1.8, 1.70, 1.13, sage, y=4.57)
    _panel(api, "Health training schedule paper", .1, 1.8, 1.57, 1.0, pale, y=4.51)
    for i in range(4):
        _panel(api, "Health schedule color tag", -.45, 2.10 - i * .19, .12, .08, sage, y=4.46)
        _panel(api, "Health schedule rule", .13, 2.10 - i * .19, .75, .025, m["ink"], y=4.46)
    api.cube("Health training storage", (-3.95, 2.90, .47), (2.1, .70, .90), pale, .04)
    for x in [-4.65, -3.95, -3.25]:
        api.cube("Health cabinet seam", (x, 2.535, .47), (.012, .015, .78), sage)
    api.area("Health soft examination light", (3.7, 2.6, 2.95), 100, "#e5f4eb", 2.3, (3.7, 2.4, .8))
    return {"room_title": "The simulation briefing room", "visual_anchors": ["empty simulation bed", "frosted training divider", "supervision folder and kit"], "scenario": "A supervised health-sciences placement interview about learning and working with people."}


def _law(api):
    m = api.materials
    oak = api.mat("Civic fluted walnut", "#69513e", .75)
    parchment = api.mat("Civic map parchment", "#dacfad", .90)
    sage = api.mat("Civic green park areas", "#698b77", .85)
    plum = api.mat("Civic plum upholstery", "#77708a", .9)
    _panel(api, "Civic walnut rear wall", 0, 1.8, 10.5, 3.5, oak)
    # Warm fluting and library alcoves frame a large neighborhood map.
    for x in [-5.05, -4.85, -4.65, 4.65, 4.85, 5.05]:
        api.cube("Civic wall fluting", (x, 4.65, 1.7), (.055, .12, 3.25), m["woodlight"], .01)
    for x in [-3.95, 3.95]:
        api.cube("Civic research bookcase back", (x, 4.25, 1.42), (1.65, .14, 2.70), oak, .025)
        for sx in [x - .83, x + .83]:
            api.cube("Civic library stile", (sx, 4.05, 1.42), (.09, .56, 2.74), m["woodlight"], .015)
        for z in [.21, .88, 1.55, 2.22, 2.77]:
            api.cube("Civic library shelf", (x, 4.05, z), (1.72, .56, .075), m["woodlight"], .012)
        for row, z in enumerate([.27, .94, 1.61, 2.28]):
            _books(api, "Civic policy research row%d" % row, x - .66, 4.02, z, 12, plum)
    _panel(api, "Civic neighborhood map frame", 0, 2.0, 4.08, 2.25, m["gold"], y=4.58)
    _panel(api, "Civic neighborhood map", 0, 2.0, 3.90, 2.07, parchment, y=4.52)
    api.text("Civic community map label", "COMMUNITY RESEARCH", (0, 4.46, 2.74), .18, m["ink"])
    # An original diagrammatic city map, not a real location or private records.
    for x in [-1.4, -.7, 0, .7, 1.4]:
        api.cube("Civic map north-south street", (x, 4.45, 1.96), (.022, .008, 1.10), m["cream"])
    for z in [1.53, 1.90, 2.27]:
        api.cube("Civic map east-west street", (0, 4.44, z), (3.2, .008, .024), m["cream"])
    for x, z, w, h in [(-1.06, 1.71, .51, .22), (.35, 2.08, .45, .23), (1.08, 1.71, .48, .22), (-.35, 2.08, .40, .22)]:
        api.cube("Civic map park district", (x, 4.42, z), (w, .008, h), sage, .012)
    for x, z in [(-.7, 1.9), (.7, 1.53), (0, 2.27)]:
        api.sphere("Civic map community pin", (x, 4.40, z), (.055, .018, .055), plum)
    _station(api, "Civic research interview", (2.70, 1.42, .09), m["woodlight"])
    # A raised research folio distinguishes this table from digital workstations.
    folio = api.cube("Civic research folio", (-.70, 1.48, .845), (.65, .45, .06), plum, .012)
    folio.rotation_euler.z = -.13
    api.cube("Civic proposal pages", (-.70, 1.47, .882), (.59, .40, .008), parchment, .006)
    api.cyl("Civic water glass", (.90, 1.55, .91), .068, .20, parchment, vertices=32)
    api.area("Civic map wash", (0, 3.6, 3.05), 90, "#ffdfb0", 3.5, (0, 4.5, 1.6))
    return {"room_title": "The civic research room", "visual_anchors": ["neighborhood community map", "research library alcoves", "proposal folio"], "scenario": "A civic research internship interview supporting a fictional community project."}


def _aviation(api):
    m = api.materials
    blue = api.mat("Aviation slate-blue briefing walls", "#324e61", .78)
    sky = api.mat("Aviation pale apron sky", "#c4dae0", .9, emission=.55)
    runway = api.mat("Aviation distant apron", "#829995", .86)
    steel = api.mat("Aviation satin cockpit structure", "#8b9b9e", .4, metallic=.45)
    amber = api.mat("Aviation training indicator amber", "#e5b77a", .5, emission=.15)
    _panel(api, "Aviation rear hangar wall", 0, 1.8, 10.5, 3.5, blue)
    # Layered exterior forms are in front of the rear shell and behind glazing
    # mullions. There is no opaque pane hiding the original aircraft geometry.
    _panel(api, "Aviation broad apron window sky", .4, 2.07, 8.2, 2.32, sky, y=4.69)
    _panel(api, "Aviation apron horizon", .4, 1.18, 8.2, .60, runway, y=4.62)
    for x in [-3.7, -.97, 1.76, 4.5]:
        api.cube("Aviation apron window mullion", (x, 4.17, 2.08), (.065, .10, 2.42), steel, .012)
    for z in [.87, 3.28]:
        api.cube("Aviation apron window frame", (.4, 4.17, z), (8.28, .10, .07), steel, .012)
    # Side-on training aircraft silhouette. Low cost geometry remains readable
    # from the student's standing and seated eye levels.
    api.sphere("Aviation exterior training aircraft fuselage", (1.25, 4.43, 1.57), (1.56, .21, .21), m["cream"])
    nose = api.sphere("Aviation exterior aircraft cockpit", (.27, 4.37, 1.68), (.33, .15, .16), blue)
    api.cube("Aviation exterior wing", (1.22, 4.33, 1.51), (.85, .72, .045), m["cream"], .035)
    tail = api.cube("Aviation exterior tail fin", (2.45, 4.43, 1.83), (.38, .06, .65), m["accent"], .04)
    tail.rotation_euler.y = -.25
    api.cube("Aviation exterior tailplane", (2.40, 4.42, 1.61), (.42, .55, .035), m["accent"], .02)
    for x in [.5, 2.0]:
        api.line("Aviation exterior landing strut", (x, 4.44, 1.40), (x, 4.44, 1.20), .018, steel)
        api.sphere("Aviation exterior wheel", (x, 4.40, 1.18), (.08, .045, .08), m["ink"])
    api.text("Aviation briefing title", "FLIGHT TRAINING", (-1.55, 4.07, 3.01), .19, m["ink"])
    # Cockpit trainer sits off the walking route and faces the approaching view.
    api.cube("Aviation simulator raised base", (3.58, 1.20, .18), (2.05, 1.95, .32), blue, .12)
    api.cube("Aviation simulator console", (3.58, 1.73, .95), (1.8, .64, .60), steel, .08)
    for i in range(3):
        x = 2.99 + i * .59
        api.cube("Aviation simulator screen frame", (x, 1.39, 1.05), (.53, .055, .37), m["ink"], .025)
        api.cube("Aviation simulator screen face", (x, 1.355, 1.05), (.46, .012, .29), m["screen"], .014)
        for j in range(2):
            api.cube("Aviation simulator instrument rule", (x, 1.343, .99 + j * .10), (.29, .005, .012), amber, .005)
    api.line("Aviation yoke stem", (3.58, 1.39, .88), (3.58, 1.16, .96), .025, m["ink"])
    api.line("Aviation yoke handles", (3.35, 1.16, .96), (3.81, 1.16, .96), .025, m["ink"])
    api.chair(3.58, .65, math.pi)
    _station(api, "Aviation briefing interview", (2.40, 1.35, .08), m["cream"])
    api.cube("Aviation flight planning folio", (-.62, 1.48, .84), (.69, .46, .035), blue, .015)
    api.cube("Aviation flight plan page", (-.62, 1.47, .862), (.60, .39, .008), m["cream"])
    for x in [-.82, -.62, -.42]:
        api.cube("Aviation flight plan route", (x, 1.47, .869), (.015, .29, .003), amber)
    api.area("Aviation apron daylight", (1, 3.8, 2.7), 160, "#c4e0ed", 4, (0, .5, 1))
    return {"room_title": "The flight-training briefing room", "visual_anchors": ["apron window and training aircraft", "three-screen cockpit simulator", "flight planning folio"], "scenario": "A supervised aviation learning placement interview before training activities."}


def _culinary(api):
    m = api.materials
    tile = api.mat("Culinary warm ceramic tile", "#e2ded0", .7)
    grout = api.mat("Culinary tile grout", "#b9b6a9", .85)
    steel = api.mat("Culinary brushed stainless", "#929f98", .33, metallic=.65)
    enamel = api.mat("Culinary dark range enamel", "#243a36", .4)
    copper = api.mat("Culinary hanging copper", "#bd8658", .35, metallic=.65)
    leaf = api.mat("Culinary fresh herb", "#63856a", .85)
    _panel(api, "Culinary tiled back wall", 0, 1.8, 10.5, 3.5, tile)
    for x in [i * .50 for i in range(-10, 11)]:
        api.cube("Culinary vertical tile grout", (x, 4.70, 1.7), (.008, .01, 3.3), grout)
    for z in [i * .40 for i in range(1, 9)]:
        api.cube("Culinary horizontal tile grout", (0, 4.695, z), (10.4, .012, .008), grout)
    # The back teaching line: range, ovens, preparation surface and hood.
    api.cube("Culinary stainless back counter", (.25, 4.04, .88), (7.55, 1.05, .10), steel, .025)
    api.cube("Culinary lower cabinets", (.25, 4.07, .43), (7.5, .95, .78), enamel, .025)
    for x in [-2.55, -.95, .65, 2.25, 3.85]:
        api.cube("Culinary cabinet front", (x, 3.58, .44), (1.45, .035, .63), steel, .025)
        api.cube("Culinary cabinet pull", (x, 3.545, .67), (.48, .035, .025), enamel, .008)
    api.cube("Culinary teaching range cooktop", (.55, 4.02, .95), (1.84, .85, .06), enamel, .02)
    for x in [.13, .97]:
        for y in [3.80, 4.23]:
            api.cyl("Culinary range burner", (x, y, .992), .15, .018, m["ink"], vertices=32)
            api.cyl("Culinary burner center", (x, y, 1.005), .085, .018, steel, vertices=24)
    api.cube("Culinary extraction hood", (.55, 4.05, 2.53), (2.40, 1.32, .33), steel, .045)
    api.cube("Culinary hood chimney", (.55, 4.30, 2.97), (.92, .60, .60), steel, .03)
    api.cube("Culinary hood working light", (.55, 3.49, 2.40), (1.75, .045, .025), m["whiteglow"])
    # Copper pans make this room read immediately from the doorway.
    api.line("Culinary hanging rail", (-3.90, 4.50, 2.55), (-1.42, 4.50, 2.55), .025, m["ink"])
    for i, x in enumerate([-3.50, -2.76, -2.02]):
        pan = api.cyl("Culinary hanging copper pan", (x, 4.47, 2.08), .23 + .025 * i, .075, copper, vertices=40)
        pan.rotation_euler.x = math.pi / 2
        api.line("Culinary pan handle", (x, 4.47, 2.31), (x, 4.47, 2.54), .026, copper)
    # A separate island stays at x>2 and never intersects the candidate route.
    api.cube("Culinary prep island base", (3.63, 1.35, .42), (2.10, 1.4, .80), enamel, .04)
    api.cube("Culinary prep island worktop", (3.63, 1.35, .86), (2.2, 1.5, .10), steel, .035)
    api.cube("Culinary chopping board", (3.55, 1.26, .93), (.77, .47, .04), m["woodlight"], .025)
    for i in range(3):
        api.sphere("Culinary seasonal citrus", (3.37 + i * .15, 1.26, 1.01), (.065, .065, .065), copper)
    api.cyl("Culinary herb pot", (4.30, 1.75, 1.02), .11, .23, tile, vertices=32)
    for i in range(5):
        angle = i * 2.4
        x, y = 4.30 + math.cos(angle) * .10, 1.75 + math.sin(angle) * .10
        api.line("Culinary herb stem", (4.30, 1.75, 1.09), (x, y, 1.32), .007, leaf)
        api.sphere("Culinary herb leaf", (x, y, 1.29), (.075, .035, .035), leaf)
    for z in [1.72, 2.17]:
        api.cube("Culinary plate shelf", (3.56, 4.44, z), (1.82, .46, .055), m["woodlight"], .015)
        for j in range(4):
            api.cyl("Culinary plate stack", (3.0 + j * .36, 4.42, z + .08), .14, .10, tile, vertices=32)
    _station(api, "Culinary chef interview nook", (), m["woodlight"], shape="round")
    api.cube("Culinary seasonal menu", (-.49, 1.48, .84), (.43, .31, .025), enamel, .015)
    for i in range(3):
        api.cube("Culinary menu rule", (-.49, 1.40 + i * .075, .855), (.27, .006, .002), tile)
    api.area("Culinary hood pool", (.55, 3.40, 2.30), 85, "#fff0ce", 2.0, (.55, 4.0, .9))
    return {"room_title": "The chef's table", "visual_anchors": ["stainless teaching range and hood", "copper hanging pans", "seasonal prep island"], "scenario": "A supervised culinary student placement interview before a team service."}


_BUILDERS = {
    "technology": _technology,
    "health-sciences": _health,
    "law-public-policy": _law,
    "aviation": _aviation,
    "culinary": _culinary,
}


def build_room(api, strand):
    """Return inspectable identity metadata alongside the room's geometry."""
    if strand not in _BUILDERS:
        raise ValueError("Unsupported care-room strand: " + strand)
    return _BUILDERS[strand](api)
