"""Original strand-specific rooms for the first-person IGNITE walk-ins.

The shared shell, doorway, walking camera and lighting live in scene_geometry.py.
All furniture is behind the reserved arrival route; no external assets are used.
"""
import math

SUPPORTED = {"engineering", "construction", "education", "business", "digital-media"}


def _palette(api, prefix, colors):
    return {
        name: api.mat(f"{prefix} / {name}", color,
                      rough=.72 if name in {"floor", "wall", "paper", "cloth"} else .4,
                      metallic=.6 if name == "metal" else 0,
                      emission=.6 if name == "glow" else 0)
        for name, color in colors.items()
    }


def _finish(api, m):
    api.cube("Strand floor finish", (0, .2, .015), (10.8, 9.2, .025), m["floor"])
    api.cube("Strand back wall finish", (0, 4.84, 1.95), (10.8, .05, 3.9), m["wall"])


def _table(api, m, name, width=2.25, depth=1.3, center=(0, 1.4), round_top=False):
    x, y = center
    if round_top:
        top = api.cyl(name + " round top", (x, y, .765), width / 2, .065, m["top"])
        top.scale.y = depth / width
        api.cyl(name + " pedestal", (x, y, .38), .13, .72, m["metal"])
        api.cyl(name + " foot", (x, y, .055), .46, .045, m["metal"])
    else:
        api.cube(name + " top", (x, y, .765), (width, depth, .065), m["top"], .055)
        for dx in [-width * .38, width * .38]:
            for dy in [-depth * .31, depth * .31]:
                api.cube(name + " leg", (x + dx, y + dy, .375), (.055, .055, .72), m["metal"], .008)
    api.chair(0, 2.65, 0, m["cloth"])
    # Stationary interview materials, never a completed answer or a real employer.
    notebook = api.cube(name + " interview notebook", (-.39, 1.36, .812), (.42, .31, .018), m["paper"], .008)
    notebook.rotation_euler.z = -.14
    api.line(name + " pen", (-.07, 1.18, .829), (.13, 1.32, .829), .007, m["metal"])
    api.cyl(name + " water glass", (.72, 1.56, .9), .055, .19, m["paper"], 24)


def _board(api, name, x, z, width, height, backing, paper, trim, y=4.72):
    api.cube(name + " frame", (x, y, z), (width + .12, .075, height + .12), trim, .025)
    api.cube(name + " surface", (x, y - .047, z), (width, .025, height), backing, .014)
    return y - .066


def _books(api, name, x, y, z, count, mats, horizontal=False):
    for n in range(count):
        color = mats[n % len(mats)]
        if horizontal:
            book = api.cube(name, (x, y, z + n * .045), (.35, .27, .04), color, .007)
            book.rotation_euler.z = n * .08
        else:
            height = .22 + (n % 4) * .035
            api.cube(name, (x + n * .075, y, z + height / 2), (.065, .22, height), color, .005)


def _plant(api, name, x, y, m, height=1.3):
    api.cyl(name + " pot", (x, y, .19), .23, .38, m["paper"], 32)
    for n in range(7):
        angle = n * 2.4
        h = height * (.65 + .05 * n)
        end = (x + math.cos(angle) * .27, y + math.sin(angle) * .24, h)
        api.line(name + " stem", (x, y, .3), end, .009, m["leaf"])
        leaf = api.sphere(name + " leaf", end, (.22, .07, .10), m["leaf"])
        leaf.rotation_euler.z = angle
        api.animate_rotation(leaf, 2, .035)


def _engineering(api):
    m = _palette(api, "Engineering", {
        "floor": "#a7a59a", "wall": "#36454b", "top": "#bca582", "paper": "#eee8d8",
        "metal": "#59666c", "cloth": "#9db0a0", "accent": "#cda165", "leaf": "#536e5a",
        "glow": "#d8e9e5", "blueprint": "#315568", "ink": "#1e313a",
    })
    _finish(api, m)
    for x in [-4, -2, 0, 2, 4]:
        api.cube("Workshop concrete joint", (x, .3, .031), (.008, 8.8, .003), m["metal"])
    # Structural roof members give this room an industrial silhouette at eye level.
    for y in [1.8, 4.15]:
        api.line("Exposed workshop truss chord", (-5.3, y, 3.35), (5.3, y, 3.35), .045, m["metal"])
        api.line("Exposed workshop roof chord", (-5.3, y, 3.65), (5.3, y, 3.65), .035, m["metal"])
        for n in range(8):
            x = -5.3 + n * 1.325
            api.line("Workshop truss diagonal", (x, y, 3.35), (x + 1.325, y, 3.65), .021, m["metal"])
    for x in [-2.5, 1.5]:
        api.cube("Workshop strip light", (x, 2.2, 3.18), (2.6, .13, .045), m["glow"], .015)
    by = _board(api, "Design review board", -2.6, 1.9, 3.3, 1.6, m["paper"], m["paper"], m["metal"])
    # A diagram, not an assumed professional qualification or written answer.
    for a, b in [((-3.7, by - .012, 1.55), (-2.9, by - .012, 2.2)),
                 ((-2.9, by - .012, 2.2), (-1.8, by - .012, 1.55)),
                 ((-3.7, by - .012, 1.55), (-1.8, by - .012, 1.55))]:
        api.line("Prototype design diagram", a, b, .014, m["blueprint"])
    for x in [-3.7, -2.9, -1.8]:
        api.cube("Design annotation", (x, by - .015, 1.35), (.42, .015, .025), m["accent"], .004)
    api.text("Engineering room title", "DESIGN WORKSHOP", (.75, 4.65, 2.85), .24, m["paper"])
    py = _board(api, "Tool-board", 3.55, 1.85, 2.45, 1.7, m["top"], m["paper"], m["metal"])
    for x in [2.7, 3.05, 3.4, 3.75, 4.1, 4.45]:
        for z in [1.3, 1.65, 2, 2.35]:
            api.sphere("Pegboard hole", (x, py - .009, z), (.017, .008, .017), m["ink"])
    for n, x in enumerate([2.85, 3.45, 4.05]):
        api.line("Hanging hand tool", (x, py - .06, 1.6), (x + .08, py - .06, 2.1), .024, m["metal"])
        api.cube("Tool grip", (x, py - .06, 1.64), (.09, .09, .24), m["accent"], .025)
        api.line("Tool head", (x - .08, py - .06, 2.08), (x + .17, py - .06, 2.08), .035, m["metal"])
    api.cube("Prototype workbench surface", (3.15, 2.45, .91), (3.2, 1.25, .09), m["top"], .025)
    for x in [1.8, 4.5]:
        api.cube("Prototype bench steel end", (x, 2.45, .46), (.08, 1.1, .86), m["metal"], .008)
    api.cube("Mechanism test base", (3.1, 2.35, .99), (1.15, .73, .07), m["paper"], .02)
    for x in [2.7, 3.5]:
        api.line("Open test rig upright", (x, 2.35, 1.02), (x, 2.35, 1.68), .035, m["metal"])
    api.line("Open test rig beam", (2.7, 2.35, 1.68), (3.5, 2.35, 1.68), .035, m["metal"])
    pivot = api.cyl("Prototype rotating wheel", (3.08, 2.35, 1.42), .20, .055, m["accent"], 32)
    pivot.rotation_euler.x = math.pi / 2
    api.animate_rotation(pivot, 1, .16)
    api.cube("Materials cabinet", (-4.7, 2.65, .61), (.92, 1.7, 1.2), m["metal"], .025)
    for z in [.35, .64, .94]:
        api.cube("Materials drawer", (-4.7, 1.785, z), (.74, .035, .22), m["ink"], .009)
        api.line("Materials drawer pull", (-4.9, 1.75, z), (-4.5, 1.75, z), .015, m["paper"])
    _table(api, m, "Design discussion table", width=2.2, depth=1.2)
    api.cube("Sketch model plan", (.28, 1.32, .811), (.55, .43, .014), m["blueprint"], .005)
    for n in range(3):
        api.line("Table sketch detail", (.08, 1.18 + n * .09, .822), (.48, 1.18 + n * .09, .822), .003, m["paper"])
    return {"room_title": "Design workshop", "visual_anchors": ["exposed steel roof trusses", "design review diagram", "pegboard hand tools", "open-frame mechanism test bench"], "scenario": "A student design internship interview beside a prototype review bench."}


def _construction(api):
    m = _palette(api, "Construction", {
        "floor": "#b7a78c", "wall": "#d7d2c4", "top": "#927f61", "paper": "#eee8d7",
        "metal": "#58636a", "cloth": "#b9a375", "accent": "#d9ad56", "leaf": "#58735e",
        "glow": "#d5e2df", "blueprint": "#355870", "ink": "#263b43",
    })
    _finish(api, m)
    # A training frame stands inside a separated demonstration bay on the right.
    for x in [2.6, 4.5]:
        for y in [2.5, 4.1]:
            api.line("Training bay upright", (x, y, .1), (x, y, 2.65), .055, m["accent"])
    for z in [.4, 1.45, 2.55]:
        api.line("Training bay front rail", (2.6, 2.5, z), (4.5, 2.5, z), .035, m["metal"])
        api.line("Training bay rear rail", (2.6, 4.1, z), (4.5, 4.1, z), .035, m["metal"])
    for x in [2.6, 4.5]:
        api.line("Training bay side rail", (x, 2.5, 2.55), (x, 4.1, 2.55), .035, m["metal"])
        api.line("Training bay diagonal brace", (x, 2.5, .4), (x, 4.1, 2.55), .028, m["metal"])
    for n in range(5):
        api.cube("Training frame timber joist", (3.55, 2.6 + n * .31, 2.61), (2.1, .11, .1), m["top"], .008)
    # The interview remains in a planning area; no student is sent onto a live site.
    api.cube("Training bay boundary", (3.55, 1.95, .025), (2.9, .06, .008), m["accent"])
    api.text("Construction room title", "PROJECT PLANNING", (-1.0, 4.67, 2.9), .25, m["ink"])
    by = _board(api, "Site drawing wall", -2.5, 1.82, 3.3, 1.65, m["blueprint"], m["paper"], m["top"])
    # Geometric site plan: a clear landmark without tiny text students must read.
    for x in [-3.55, -2.8, -2.05]:
        api.cube("Plan building outline", (x, by - .018, 1.83), (.51, .014, .63), m["paper"], .005)
        api.cube("Plan building inset", (x, by - .028, 1.83), (.44, .012, .55), m["blueprint"], .004)
    for z in [1.38, 2.29]:
        api.line("Plan dimension line", (-3.75, by - .035, z), (-1.45, by - .035, z), .006, m["paper"])
    api.cube("Drafting island", (3.05, .72, .91), (2.5, 1.15, .09), m["top"], .035)
    for x in [2.05, 4.05]:
        api.cube("Drafting island support", (x, .72, .45), (.14, .85, .9), m["metal"], .012)
    api.cube("Drafting blueprint", (2.9, .7, .966), (1.36, .8, .014), m["blueprint"], .005)
    for n in range(4):
        api.line("Drafting sheet guides", (2.31 + n * .3, .38, .978), (2.31 + n * .3, 1.0, .978), .005, m["paper"])
    for x in [2.22, 3.12, 3.42]:
        api.cyl("Rolled drawing", (x, 1.03, 1.01), .045, .42, m["paper"], 24).rotation_euler.y = math.pi / 2
    api.cyl("Hard hat brim", (3.93, .6, .983), .18, .025, m["accent"], 32)
    api.sphere("Training hard hat dome", (3.93, .6, 1.035), (.145, .17, .105), m["accent"])
    api.cube("Plan storage cabinet", (-4.75, 2.7, .65), (.9, 1.6, 1.3), m["top"], .03)
    for n in range(5):
        api.cube("Flat file drawer", (-4.75, 1.875, .25 + n * .22), (.75, .03, .17), m["paper"], .006)
    _table(api, m, "Site interview table", width=2.35, depth=1.4)
    api.cube("Scale site base", (.2, 1.43, .826), (.83, .59, .045), m["paper"], .01)
    for x, y, h in [(-.05, 1.35, .13), (.22, 1.52, .24), (.4, 1.3, .17)]:
        api.cube("Scale building model", (x, y, .85 + h / 2), (.2, .19, h), m["accent"], .008)
    return {"room_title": "Project planning room", "visual_anchors": ["blue site-plan wall", "scale building model", "drafting island and rolled plans", "separated timber training frame"], "scenario": "A supervised student placement interview in the planning office beside a training bay."}


def _education(api):
    m = _palette(api, "Education", {
        "floor": "#c3af8b", "wall": "#e5e5d3", "top": "#d8c9a8", "paper": "#fff6df",
        "metal": "#6a7a6a", "cloth": "#93b3a2", "accent": "#cfb7dc", "leaf": "#5c7c5e",
        "glow": "#dbeae5", "blue": "#99b9c2", "ink": "#36544a", "coral": "#cb9d80",
    })
    _finish(api, m)
    for x in range(-5, 6):
        api.cube("Learning commons timber join", (x, .2, .031), (.009, 9.1, .003), m["top"])
    # Broad daylight panes over low, welcoming shelves.
    for x in [-3.9, -2.0, -.1]:
        api.cube("School window frame", (x, 4.74, 2.55), (1.7, .09, 1.52), m["top"], .025)
        api.cube("School daylight window", (x, 4.68, 2.55), (1.54, .025, 1.36), m["glow"], .012)
        api.cube("School window mullion", (x, 4.65, 2.55), (.035, .035, 1.36), m["paper"])
    api.text("Education room title", "LEARNING COMMONS", (1.95, 4.65, 3.02), .22, m["ink"])
    for x in [-3.0, .1]:
        api.cube("Low learning bookcase back", (x, 4.45, .63), (2.7, .055, 1.25), m["top"], .015)
        for side in [-1.31, 1.31]:
            api.cube("Open bookcase upright", (x + side, 4.16, .63), (.065, .63, 1.25), m["top"], .012)
        for z in [.08, .35, .76, 1.17]:
            api.cube("Open bookcase shelf", (x, 4.13, z), (2.62, .63, .055), m["paper"], .008)
        for n in range(3):
            _books(api, "Learning reference books", x - 1.08 + n * .78, 3.96, .79, 7,
                   [m["accent"], m["blue"], m["coral"], m["ink"], m["paper"]])
    by = _board(api, "Learner project display", 3.57, 1.99, 2.55, 1.65, m["accent"], m["paper"], m["top"])
    for n, x in enumerate([2.78, 3.57, 4.36]):
        for j, z in enumerate([1.55, 2.25]):
            api.cube("Pinned learner artwork", (x, by - .025, z), (.61, .025, .56), m["paper"], .008)
            api.cube("Artwork block", (x - .09, by - .047, z - .09), (.22, .01, .18), m["coral"])
            api.sphere("Artwork sun", (x + .12, by - .052, z + .12), (.09, .008, .09), m["blue"])
            api.line("Artwork diagonal", (x - .2, by - .054, z + .13), (x + .13, by - .054, z - .16), .015, m["ink"])
    api.cube("Reading nook base", (3.75, 2.75, .27), (2.4, .93, .48), m["top"], .08)
    api.cube("Reading nook cushion", (3.75, 2.75, .54), (2.29, .86, .13), m["cloth"], .10)
    api.cube("Reading nook back", (3.75, 3.13, .91), (2.29, .12, .75), m["cloth"], .09)
    for x in [3.2, 4.35]:
        api.cube("Reading nook pillow", (x, 2.95, .85), (.48, .2, .43), m["accent"], .10)
    # The round conversation table is structurally different from workshop desks.
    rug = api.cyl("Round woven conversation rug", (0, 1.43, .04), 1.95, .018, m["cloth"], 64)
    _table(api, m, "Learning conversation table", width=2.08, depth=2.08, round_top=True)
    _books(api, "Lesson-planning notebooks", .34, 1.42, .821, 3, [m["accent"], m["paper"], m["blue"]], horizontal=True)
    for x, y, r in [(-2.1, 2.3, .65), (.45, 3.0, .82), (3.2, 2.0, .63)]:
        api.cyl("Suspended acoustic cloud", (x, y, 3.36), r, .09, m["paper"], 48)
        api.line("Acoustic cloud suspension", (x, y, 3.41), (x, y, 3.8), .005, m["metal"])
    _plant(api, "Learning commons plant", -4.7, 3.15, m, 1.5)
    api.area("School soft daylight", (-2.8, 4.25, 2.8), 320, "#f5f1d8", 3.5, (0, 1, .8))
    return {"room_title": "School learning commons", "visual_anchors": ["broad daylight windows", "low open bookcases", "pinned learner artwork", "round conversation table and reading nook"], "scenario": "A supervised education placement interview in a school's learning commons."}


def _business(api):
    m = _palette(api, "Business", {
        "floor": "#9f9d91", "wall": "#1f4b43", "top": "#80674b", "paper": "#f1ead7",
        "metal": "#aa956c", "cloth": "#c4baa1", "accent": "#d8c0e2", "leaf": "#466f56",
        "glow": "#c5d8d5", "ink": "#193830", "stone": "#bdbaa9",
    })
    _finish(api, m)
    for x in [-4, -2, 0, 2, 4]:
        api.cube("Briefing suite stone floor joint", (x, .2, .031), (.009, 9, .003), m["stone"])
    # Wide client display on one side; a curved oak screen on the other.
    by = _board(api, "Client pitch display", -2.6, 2.05, 3.65, 1.95, m["paper"], m["paper"], m["metal"])
    api.text("Pitch board label", "CLIENT BRIEFING", (-2.6, by - .035, 2.6), .16, m["ink"])
    for n, h in enumerate([.35, .67, .92, .76]):
        x = -3.7 + n * .68
        api.cube("Pitch chart column", (x, by - .03, 1.4 + h / 2), (.36, .025, h), m["accent"] if n % 2 else m["ink"], .014)
    api.line("Pitch chart baseline", (-4, by - .05, 1.35), (-1.15, by - .05, 1.35), .012, m["metal"])
    api.text("Business room title", "VENTURE STUDIO", (1.75, 4.63, 3.0), .25, m["paper"])
    for n in range(23):
        t = (n / 22 - .5) * 1.6
        x = 2.55 + math.sin(t) * 2.1
        y = 4.27 - (1 - math.cos(t)) * .9
        slat = api.cube("Curved venture oak screen", (x, y, 1.58), (.075, .14, 2.8), m["top"], .018)
        slat.rotation_euler.z = -t * .35
    # Skyline light panels form a distinct office panorama without external imagery.
    for n in range(3):
        x, y = -4.98, .6 + n * 1.27
        api.cube("Briefing side window surround", (x, y, 2.0), (.08, 1.11, 2.5), m["metal"], .02)
        api.cube("Briefing side daylight", (x + .051, y, 2.0), (.025, .97, 2.34), m["glow"])
        for j in range(3):
            h = .3 + ((n + j) % 3) * .18
            api.cube("Distant office skyline", (x + .075, y - .29 + j * .28, .91 + h / 2), (.022, .18, h), m["ink"])
    rug = api.cyl("Client table oval rug", (0, 1.5, .04), 2.05, .018, m["ink"], 64)
    rug.scale.y = .9
    _table(api, m, "Client meeting table", width=2.65, depth=1.48, round_top=True)
    api.chair(-1.6, 1.55, math.pi / 2, m["cloth"])
    api.cube("Presentation portfolio", (.27, 1.3, .82), (.53, .35, .035), m["ink"], .018)
    api.cube("Portfolio accent band", (.27, 1.3, .842), (.05, .35, .004), m["accent"])
    api.cube("Briefing room credenza", (4.5, 1.25, .5), (1.0, 2.5, .98), m["top"], .04)
    for y in [.4, 1.1, 1.8]:
        api.cube("Credenza handle", (3.98, y, .64), (.025, .32, .022), m["metal"], .007)
    _plant(api, "Venture studio plant", 4.48, 2.1, m, 1.65)
    for x in [-1.1, 1.1]:
        api.line("Briefing linear pendant suspension", (x, 1.5, 3.75), (x, 1.5, 2.86), .008, m["metal"])
    api.cube("Briefing linear pendant", (0, 1.5, 2.82), (2.8, .15, .10), m["metal"], .025)
    api.cube("Briefing pendant diffuser", (0, 1.5, 2.757), (2.58, .10, .016), m["glow"], .008)
    return {"room_title": "Venture briefing suite", "visual_anchors": ["client pitch display", "curved oak slat screen", "long oval meeting table", "skyline side windows and linear pendant"], "scenario": "A student business internship interview before the team's next client briefing."}


def _digital_media(api):
    m = _palette(api, "Digital media", {
        "floor": "#45454b", "wall": "#282b35", "top": "#756873", "paper": "#e7e0d8",
        "metal": "#6a7180", "cloth": "#91849c", "accent": "#c8a6cd", "leaf": "#4c6a5e",
        "glow": "#ddd7ee", "ink": "#121923", "screen": "#294451", "blue": "#85b3c2",
    })
    _finish(api, m)
    # Acoustic fins and an overhead lighting grid clearly identify a production room.
    for x in [-4.8, -4.46, -4.12, 3.9, 4.24, 4.58, 4.92]:
        api.cube("Edit suite acoustic fin", (x, 4.68, 1.97), (.16, .22, 2.9), m["top"], .025)
    for y in [0, 2.1, 4.2]:
        api.line("Production overhead lighting rail", (-5.2, y, 3.55), (5.2, y, 3.55), .028, m["metal"])
    api.text("Digital media room title", "CREATIVE REVIEW", (.5, 4.65, 3.0), .25, m["paper"])
    by = _board(api, "Student storyboard wall", -2.7, 1.93, 2.95, 1.8, m["top"], m["paper"], m["metal"])
    for n, x in enumerate([-3.6, -2.7, -1.8]):
        for j, z in enumerate([1.52, 2.28]):
            api.cube("Storyboard frame", (x, by - .025, z), (.74, .025, .57), m["paper"], .008)
            api.cube("Storyboard ground", (x, by - .043, z - .15), (.60, .009, .08), m["screen"])
            api.line("Storyboard composition", (x - .23, by - .052, z - .11), (x + .14, by - .052, z + .15), .018, m["blue"])
            api.sphere("Storyboard focal mark", (x + .15, by - .054, z + .08), (.08, .008, .08), m["accent"])
    api.cube("Editing workstation", (.65, 3.93, .8), (3.65, 1.05, .07), m["top"], .045)
    for x in [-.8, 2.05]:
        api.cube("Edit desk support", (x, 3.93, .4), (.06, .9, .8), m["metal"], .01)
    for n, x in enumerate([-.2, 1.5]):
        api.cube("Editing monitor housing", (x, 4.03, 1.43), (1.5, .1, .94), m["ink"], .045)
        api.cube("Editing monitor image", (x, 3.966, 1.43), (1.35, .025, .79), m["screen"], .02)
        api.cube("Editing monitor stem", (x, 4.07, .99), (.07, .07, .3), m["metal"], .012)
        api.cube("Editing monitor foot", (x, 4.02, .85), (.45, .27, .025), m["metal"], .015)
        if n == 0:
            api.sphere("Paused student production sun", (x + .31, 3.945, 1.6), (.13, .009, .13), m["accent"])
            for j in range(3):
                api.line("Paused production landscape", (x - .52 + j * .34, 3.941, 1.2), (x - .23 + j * .34, 3.941, 1.54 - j * .08), .04, m["blue"])
        else:
            for j in range(4):
                api.cube("Edit timeline clip", (x - .36 + (j % 2) * .35, 3.941, 1.19 + j * .12), (.58 + (j % 2) * .22, .012, .055), m["accent"] if j % 2 else m["blue"], .005)
            playhead = api.cube("Edit timeline playhead", (x, 3.925, 1.43), (.013, .012, .56), m["paper"])
            for frame, dx in [(1, -.43), (12 * api.fps, .43)]:
                playhead.location.x = x + dx
                playhead.keyframe_insert(data_path="location", frame=frame)
    # The idle production camera points toward the set, never at the student.
    camera_x, camera_y = 3.2, 1.5
    for dx, dy in [(-.43, -.25), (.43, -.25), (0, .43)]:
        api.line("Production camera tripod", (camera_x + dx, camera_y + dy, .07), (camera_x, camera_y, 1.25), .023, m["metal"])
    api.cube("Idle production camera body", (camera_x, camera_y, 1.43), (.43, .37, .29), m["ink"], .035)
    api.line("Production camera lens", (camera_x, camera_y + .16, 1.44), (camera_x, camera_y + .46, 1.44), .12, m["metal"])
    api.cube("Production camera viewfinder", (camera_x - .28, camera_y, 1.45), (.20, .025, .16), m["screen"], .018)
    api.line("Softbox floor stand", (4.53, 2.7, .05), (4.53, 2.7, 2.22), .025, m["metal"])
    for dx, dy in [(-.33, -.2), (.33, -.2), (0, .34)]:
        api.line("Softbox stand foot", (4.53 + dx, 2.7 + dy, .03), (4.53, 2.7, .28), .017, m["metal"])
    softbox = api.cube("Large production softbox", (4.42, 2.72, 2.25), (.83, .18, .64), m["ink"], .06)
    softbox.rotation_euler.z = -.30
    diffuser = api.cube("Softbox fabric diffuser", (4.39, 2.61, 2.25), (.71, .025, .54), m["glow"], .045)
    diffuser.rotation_euler.z = -.30
    _table(api, m, "Creative interview table", width=2.12, depth=1.3, round_top=True)
    _books(api, "Creative portfolio", .26, 1.37, .82, 2, [m["accent"], m["ink"]], horizontal=True)
    api.area("Edit suite gentle lavender wash", (2.7, 4.1, 2.9), 180, "#d6c2df", 2.7, (1, 1, 1))
    return {"room_title": "Production and edit suite", "visual_anchors": ["acoustic fins and lighting grid", "six-frame storyboard wall", "dual edit monitors and timeline", "idle production camera and softbox"], "scenario": "A student production internship interview in a studio between edit reviews."}


def build_room(api, strand):
    """Build one distinct room and return its inspectable scene identity."""
    builders = {
        "engineering": _engineering,
        "construction": _construction,
        "education": _education,
        "business": _business,
        "digital-media": _digital_media,
    }
    if strand not in builders:
        raise ValueError(f"Unsupported creative-room strand: {strand}")
    return builders[strand](api)
