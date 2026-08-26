#!/usr/bin/env python3
"""Generate the Bagaash.com logo suite (SVG sources + PNG exports).

Wordmarks are shaped with HarfBuzz and written out as outlines so every file
renders identically without the brand fonts installed.

    pip install fonttools uharfbuzz cairosvg
    python3 build_assets.py
"""

from __future__ import annotations

import math
import os
import re
import shutil
import subprocess

import cairosvg
import uharfbuzz as hb
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = os.path.dirname(os.path.abspath(__file__))

# --- Palette -----------------------------------------------------------------
# Lifted from bagaash.com: theme-color #16A34A, nav wordmark #4ADE80,
# dark-surface tokens --bg/--white/--green-light, amber promo accents.
FOREST = "#14532D"
GREEN = "#16A34A"
FRESH = "#4ADE80"
GOLD = "#D97706"
GOLD_LIGHT = "#F59E0B"
INK = "#101612"
SURFACE = "#171E1A"
CLOUD = "#E8EEE9"
MUTED = "#9AA89E"
WHITE = "#FFFFFF"

FONT_WORDMARK = "/usr/share/fonts/truetype/manrope/Manrope-ExtraBold.ttf"
FONT_TAGLINE = "/usr/share/fonts/truetype/manrope/Manrope-Bold.ttf"


# --- Text outlining ----------------------------------------------------------
_font_cache: dict[str, tuple[TTFont, hb.Font, int]] = {}


def _load(path: str):
    if path not in _font_cache:
        tt = TTFont(path)
        face = hb.Face(hb.Blob.from_file_path(path))
        hbfont = hb.Font(face)
        _font_cache[path] = (tt, hbfont, tt["head"].unitsPerEm)
    return _font_cache[path]


def shape(text: str, font_path: str, size: float, tracking: float = 0.0):
    """Return (svg path data anchored at origin baseline, advance width)."""
    tt, hbfont, upem = _load(font_path)
    glyphset = tt.getGlyphSet()
    scale = size / upem

    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})

    parts, cursor = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = tt.getGlyphName(info.codepoint)
        pen = SVGPathPen(glyphset)
        # Flip the y axis: font units go up, SVG user units go down.
        tx = Transform(scale, 0, 0, -scale, cursor + pos.x_offset * scale, -pos.y_offset * scale)
        glyphset[name].draw(TransformPen(pen, tx))
        d = pen.getCommands()
        if d:
            parts.append(d)
        cursor += pos.x_advance * scale + tracking
    if buf.glyph_positions:
        cursor -= tracking
    return " ".join(parts), cursor


def text_path(text, font_path, size, x, y, fill, tracking=0.0, anchor="start", opacity=None):
    d, width = shape(text, font_path, size, tracking)
    if anchor == "middle":
        x -= width / 2
    elif anchor == "end":
        x -= width
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return (
        f'<g transform="translate({_n(x)} {_n(y)})">'
        f'<path d="{d}" fill="{fill}"{op}/></g>',
        width,
    )


def _n(v: float) -> str:
    s = f"{round(v, 2):g}"
    return s


# --- Mark geometry -----------------------------------------------------------
# Authored on a 64x64 grid. The mark is a grocery tote -- the "xirmo" (bundle)
# Bagaash delivers -- carried by a rope handle, with a wheat sprig on its face
# for the staples (bariis, bur, sonkor) at the centre of the range.

BAG_TOP, BAG_BOT = 21.6, 54.4
BAG_TOP_HALF, BAG_BOT_HALF = 20.4, 18.4
BAG_R = 6.2
HANDLE_ATTACH = 25.0
HANDLE_HALF = 10.4
HANDLE_RISE = 13.0
HANDLE_W = 4.6

# A compact wheat ear: four rows of plump kernels over a short stalk.
STALK_TOP, STALK_BOT = 30.3, 48.8
GRAIN_ROWS = ((46.0, 1.00), (41.6, 0.95), (37.2, 0.89), (32.8, 0.82))
GRAIN_TIP = (30.3, 0.68)
GRAIN_SPREAD = 40.0  # degrees off vertical
GRAIN_LEN = 7.0
GRAIN_WID = 3.3
STALK_W = 2.7


def _round_poly(points, radii):
    """Rounded-corner polygon: quadratic fillets at each vertex."""
    n = len(points)
    out = []
    for i, (px, py) in enumerate(points):
        prev = points[(i - 1) % n]
        nxt = points[(i + 1) % n]
        r = radii[i]

        def toward(target, radius):
            dx, dy = target[0] - px, target[1] - py
            span = math.hypot(dx, dy) or 1.0
            k = min(radius, span / 2) / span
            return px + dx * k, py + dy * k

        a = toward(prev, r)
        b = toward(nxt, r)
        out.append(f"{'M' if i == 0 else 'L'}{_n(a[0])} {_n(a[1])}")
        if r > 0:
            out.append(f"Q{_n(px)} {_n(py)} {_n(b[0])} {_n(b[1])}")
    out.append("Z")
    return "".join(out)


def _bag_path():
    pts = [
        (32 - BAG_TOP_HALF, BAG_TOP),
        (32 + BAG_TOP_HALF, BAG_TOP),
        (32 + BAG_BOT_HALF, BAG_BOT),
        (32 - BAG_BOT_HALF, BAG_BOT),
    ]
    return _round_poly(pts, [2.2, 2.2, BAG_R, BAG_R])


def _handle_path():
    return (
        f"M{_n(32 - HANDLE_HALF)} {_n(HANDLE_ATTACH)} "
        f"A{_n(HANDLE_HALF)} {_n(HANDLE_RISE)} 0 0 1 "
        f"{_n(32 + HANDLE_HALF)} {_n(HANDLE_ATTACH)}"
    )


def _grain_path(x, y, angle, scale=1.0):
    """One kernel: a teardrop with a blunt, rounded outer end. The rotation is
    baked into the coordinates so kernels can join one compound path."""
    length, width = GRAIN_LEN * scale, GRAIN_WID * scale
    pts = [
        (0.0, 0.0),
        (length * 0.28, -width * 0.95),  # ctrl
        (length * 0.78, -width * 0.80),  # ctrl
        (length, -width * 0.06),  # blunt tip
        (length * 0.78, width * 0.62),  # ctrl
        (length * 0.30, width * 0.70),  # ctrl
    ]
    rad = math.radians(angle)
    cos, sin = math.cos(rad), math.sin(rad)
    t = [(x + px * cos - py * sin, y + px * sin + py * cos) for px, py in pts]
    return (
        f"M{_n(t[0][0])} {_n(t[0][1])} "
        f"C{_n(t[1][0])} {_n(t[1][1])} {_n(t[2][0])} {_n(t[2][1])} {_n(t[3][0])} {_n(t[3][1])} "
        f"C{_n(t[4][0])} {_n(t[4][1])} {_n(t[5][0])} {_n(t[5][1])} {_n(t[0][0])} {_n(t[0][1])} Z"
    )


def _wheat_paths():
    """Sub-paths of the upright wheat sprig centred on the bag face."""
    half = STALK_W / 2
    stalk = _round_poly(
        [
            (32 - half, STALK_TOP),
            (32 + half, STALK_TOP),
            (32 + half, STALK_BOT),
            (32 - half, STALK_BOT),
        ],
        [half, half, half, half],
    )
    paths = [stalk, _grain_path(32, GRAIN_TIP[0], -90, GRAIN_TIP[1])]
    for y, scale in GRAIN_ROWS:
        paths.append(_grain_path(32, y, -90 - GRAIN_SPREAD, scale))
        paths.append(_grain_path(32, y, -90 + GRAIN_SPREAD, scale))
    return paths


def mark(bag, handle, grain):
    """Mark elements for one colour treatment. The handle is drawn first so its
    ends tuck behind the bag's top edge. `grain=None` knocks the wheat out of
    the bag instead of filling it, which is how the one-colour cut works."""
    el = []
    el.append(
        f'<path d="{_handle_path()}" fill="none" stroke="{handle}" '
        f'stroke-width="{_n(HANDLE_W)}" stroke-linecap="butt"/>'
    )
    if grain is None:
        # A mask, not fill-rule="evenodd": the kernels overlap each other and
        # the stalk, and even-odd would XOR those overlaps back into the fill.
        el.append(
            f'<defs><mask id="bagaashGrainCut">'
            f'<path d="{_bag_path()}" fill="#FFFFFF"/>'
            f'<path d="{"".join(_wheat_paths())}" fill="#000000"/>'
            f"</mask></defs>"
            f'<path d="{_bag_path()}" fill="{bag}" mask="url(#bagaashGrainCut)"/>'
        )
    else:
        el.append(f'<path d="{_bag_path()}" fill="{bag}"/>')
        el.append(f'<path d="{"".join(_wheat_paths())}" fill="{grain}"/>')
    return "".join(el)


MARK_FULL = dict(bag=GREEN, handle=GOLD_LIGHT, grain=WHITE)
MARK_KNOCKOUT = dict(bag=WHITE, handle=GOLD_LIGHT, grain=GREEN)


def mark_mono(color):
    return mark(bag=color, handle=color, grain=None)


# Ink extents of the mark artwork inside the 64x64 grid.
MARK_BOX = (
    32 - BAG_TOP_HALF,
    HANDLE_ATTACH - HANDLE_RISE - HANDLE_W / 2,
    32 + BAG_TOP_HALF,
    BAG_BOT,
)


def place_mark(scale, box=64.0, elements=None, nudge_y=0.0):
    """Wrap the mark in a transform that optically centres its ink in `box`."""
    x0, y0, x1, y1 = MARK_BOX
    dx = (box - (x1 - x0) * scale) / 2 - x0 * scale
    dy = (box - (y1 - y0) * scale) / 2 - y0 * scale + nudge_y
    art = elements if elements is not None else mark(**MARK_FULL)
    return f'<g transform="translate({_n(dx)} {_n(dy)}) scale({_n(scale)})">{art}</g>'


# --- Document helpers --------------------------------------------------------
def svg(width, height, viewbox, body, label, px_width=None, px_height=None):
    w = px_width or width
    h = px_height or height
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" width="{_n(w)}" '
        f'height="{_n(h)}" role="img" aria-label="{label}">\n'
        f"  <title>{label}</title>\n  {body}\n</svg>\n"
    )


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return path


RSVG = shutil.which("rsvg-convert")


def rasterize_text(svg_text: str, png_name: str, width: int):
    """PNG export. librsvg is preferred: cairosvg mis-renders the <mask> used
    by the one-colour cut."""
    dest = os.path.join(OUT, png_name)
    if RSVG:
        subprocess.run(
            [RSVG, "-w", str(width), "-o", dest],
            input=svg_text.encode("utf-8"),
            check=True,
        )
    else:
        cairosvg.svg2png(bytestring=svg_text.encode("utf-8"), write_to=dest, output_width=width)


def rasterize(svg_name, png_name, width):
    with open(os.path.join(OUT, svg_name), encoding="utf-8") as fh:
        rasterize_text(fh.read(), png_name, width)


# --- Lockups -----------------------------------------------------------------
WORDMARK = "BAGAASH"
SUFFIX = ".com"
TAGLINE = "SUUQA ALBAABKAAGA \u00b7 MUQDISHO"


def cap_height(font_path: str, size: float) -> float:
    tt, _, upem = _load(font_path)
    os2 = tt["OS/2"]
    caps = getattr(os2, "sCapHeight", None) or int(upem * 0.72)
    return caps / upem * size


def mark_at(x: float, y: float, ink_h: float, elements=None):
    """Place the mark with its ink box's top-left at (x, y). Returns
    (svg fragment, ink width)."""
    x0, y0, x1, y1 = MARK_BOX
    scale = ink_h / (y1 - y0)
    art = elements if elements is not None else mark(**MARK_FULL)
    frag = (
        f'<g transform="translate({_n(x - x0 * scale)} {_n(y - y0 * scale)}) '
        f'scale({_n(scale)})">{art}</g>'
    )
    return frag, (x1 - x0) * scale


TAGLINE_INK = {False: "#4F6156", True: MUTED}


def lockup_horizontal(on_dark: bool, tagline: bool):
    """Mark on the left, wordmark in Manrope ExtraBold, optical centres aligned."""
    word_fill = CLOUD if on_dark else FOREST
    suffix_fill = FRESH if on_dark else GREEN
    tag_fill = TAGLINE_INK[on_dark]

    pad = 10.0
    ink_h = 58.0
    word_size = 41.0
    tag_size = 10.4
    tag_gap = 15.0
    caps = cap_height(FONT_WORDMARK, word_size)

    mark_frag, mark_w = mark_at(pad, pad, ink_h)
    gap = ink_h * 0.34
    text_x = pad + mark_w + gap

    # Centre the text block (caps, plus the tagline when present) on the mark.
    block_h = caps + (tag_gap + tag_size * 0.72 if tagline else 0.0)
    block_top = pad + (ink_h - block_h) / 2
    baseline = block_top + caps

    word_el, word_w = text_path(
        WORDMARK, FONT_WORDMARK, word_size, text_x, baseline, word_fill, tracking=-0.3
    )
    suffix_el, suffix_w = text_path(
        SUFFIX, FONT_WORDMARK, word_size, text_x + word_w + 1.4, baseline, suffix_fill, tracking=-0.3
    )
    parts = [mark_frag, word_el, suffix_el]
    text_w = word_w + 1.4 + suffix_w

    if tagline:
        tag_el, tag_w = text_path(
            TAGLINE, FONT_TAGLINE, tag_size, text_x + 1.2, baseline + tag_gap, tag_fill, tracking=1.5
        )
        parts.append(tag_el)
        text_w = max(text_w, tag_w + 1.2)

    width = text_x + text_w + pad
    height = pad * 2 + ink_h
    label = "Bagaash.com \u2014 Suuqa Albaabkaaga, Muqdisho" if tagline else "Bagaash.com"
    return svg(width, height, f"0 0 {_n(width)} {_n(height)}", "".join(parts), label,
               px_width=width * 2, px_height=height * 2)


def lockup_stacked(on_dark: bool):
    word_fill = CLOUD if on_dark else FOREST
    suffix_fill = FRESH if on_dark else GREEN
    tag_fill = TAGLINE_INK[on_dark]

    pad = 12.0
    ink_h = 112.0
    word_size = 44.0
    tag_size = 11.0
    caps = cap_height(FONT_WORDMARK, word_size)

    _, word_w = shape(WORDMARK, FONT_WORDMARK, word_size, -0.3)
    _, suffix_w = shape(SUFFIX, FONT_WORDMARK, word_size, -0.3)
    text_w = word_w + 1.4 + suffix_w

    _, mark_w = mark_at(0, 0, ink_h)
    width = max(text_w, mark_w) + pad * 2
    mark_frag, _ = mark_at((width - mark_w) / 2, pad, ink_h)

    baseline = pad + ink_h + 34.0
    start = (width - text_w) / 2
    word_el, _ = text_path(WORDMARK, FONT_WORDMARK, word_size, start, baseline, word_fill, tracking=-0.3)
    suffix_el, _ = text_path(
        SUFFIX, FONT_WORDMARK, word_size, start + word_w + 1.4, baseline, suffix_fill, tracking=-0.3
    )
    tag_el, _ = text_path(
        TAGLINE, FONT_TAGLINE, tag_size, width / 2, baseline + 21.0, tag_fill, tracking=1.7, anchor="middle"
    )
    height = baseline + 21.0 + pad + 4.0
    body = "".join([mark_frag, word_el, suffix_el, tag_el])
    return svg(width, height, f"0 0 {_n(width)} {_n(height)}", body,
               "Bagaash.com \u2014 Suuqa Albaabkaaga, Muqdisho",
               px_width=width * 2, px_height=height * 2)


def wordmark_only(on_dark: bool):
    """Text-only lockup, as the site footer uses it."""
    word_fill = CLOUD if on_dark else FOREST
    suffix_fill = FRESH if on_dark else GREEN
    pad = 8.0
    size = 44.0
    caps = cap_height(FONT_WORDMARK, size)

    word_el, word_w = text_path(WORDMARK, FONT_WORDMARK, size, pad, pad + caps, word_fill, tracking=-0.3)
    suffix_el, suffix_w = text_path(
        SUFFIX, FONT_WORDMARK, size, pad + word_w + 1.4, pad + caps, suffix_fill, tracking=-0.3
    )
    width = pad * 2 + word_w + 1.4 + suffix_w
    height = pad * 2 + caps
    return svg(width, height, f"0 0 {_n(width)} {_n(height)}", word_el + suffix_el,
               "Bagaash.com", px_width=width * 2, px_height=height * 2)


def app_icon(radius=14.0):
    """Rounded tile for PWA / WhatsApp Business / social avatars."""
    body = (
        f'<defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{GREEN}"/><stop offset="1" stop-color="{FOREST}"/>'
        f"</linearGradient></defs>"
        f'<rect width="64" height="64" rx="{_n(radius)}" fill="url(#tile)"/>'
        f"{place_mark(0.70, elements=mark(**MARK_KNOCKOUT))}"
    )
    return svg(512, 512, "0 0 64 64", body, "Bagaash.com app icon")


def favicon():
    """Small-size cut: solid tile, mark scaled up to fill more of the frame."""
    body = (
        f'<rect width="64" height="64" rx="13" fill="{GREEN}"/>'
        f"{place_mark(0.78, elements=mark(**MARK_KNOCKOUT))}"
    )
    return svg(64, 64, "0 0 64 64", body, "Bagaash.com")


def _strip(svg_text: str) -> str:
    """Inner markup of a generated SVG, for nesting inside the brand sheet."""
    start = svg_text.index(">", svg_text.index("<svg")) + 1
    inner = svg_text[start : svg_text.rindex("</svg>")]
    return re.sub(r"<title>.*?</title>", "", inner, flags=re.S)


def brand_sheet():
    """One-page overview: mark at size, colour treatments, lockups, palette."""
    W, H = 1440.0, 1180.0
    p = [f'<rect width="{_n(W)}" height="{_n(H)}" fill="#FFFFFF"/>']

    def label(x, y, text, fill="#4F6156", size=11.0, tracking=1.5):
        el, _ = text_path(text, FONT_TAGLINE, size, x, y, fill, tracking=tracking)
        return el

    # Row 1 -- the mark at descending sizes, on light and on the site's dark.
    p.append(f'<rect x="0" y="0" width="{_n(W / 2)}" height="300" fill="#F7F9F7"/>')
    p.append(f'<rect x="{_n(W / 2)}" y="0" width="{_n(W / 2)}" height="300" fill="{INK}"/>')
    p.append(label(40, 40, "PRIMARY MARK ON LIGHT"))
    p.append(label(W / 2 + 40, 40, "PRIMARY MARK ON BRAND DARK #101612", MUTED))
    for base in (0.0, W / 2):
        x = base + 44
        for size in (168.0, 84.0, 48.0, 32.0):
            frag, w = mark_at(x, 170 - size / 2, size)
            p.append(frag)
            p.append(label(x, 276, f"{int(size)}", MUTED if base else "#8A9A90", 10.0, 0.8))
            x += w + 34

    # Row 2 -- app icon, favicon, one-colour cuts.
    p.append(f'<rect x="0" y="300" width="{_n(W / 2)}" height="320" fill="#FFFFFF"/>')
    p.append(f'<rect x="{_n(W / 2)}" y="300" width="{_n(W / 2)}" height="320" fill="{SURFACE}"/>')
    p.append(label(40, 340, "APP ICON \u00b7 AVATAR \u00b7 FAVICON"))
    p.append(label(W / 2 + 40, 340, "ONE-COLOUR CUT", MUTED))
    icon = _strip(app_icon())
    fav = _strip(favicon())
    x = 44.0
    for size in (128.0, 72.0, 44.0):
        p.append(f'<g transform="translate({_n(x)} {_n(430 - size / 2)}) scale({_n(size / 64)})">{icon}</g>')
        x += size + 26
    p.append(f'<clipPath id="avatar"><circle cx="{_n(x + 56)}" cy="430" r="56"/></clipPath>')
    p.append(
        f'<g clip-path="url(#avatar)"><g transform="translate({_n(x)} 374) scale(1.75)">{icon}</g></g>'
    )
    p.append(label(44, 530, "TILE 128 / 72 / 44", "#8A9A90", 10.0, 0.8))
    p.append(label(x, 530, "CIRCULAR CROP", "#8A9A90", 10.0, 0.8))
    for i, size in enumerate((32.0, 16.0)):
        p.append(
            f'<g transform="translate({_n(x + 150 + i * 46)} {_n(430 - size / 2)}) '
            f'scale({_n(size / 64)})">{fav}</g>'
        )
    p.append(label(x + 150, 530, "FAVICON 32 / 16", "#8A9A90", 10.0, 0.8))

    p.append(f'<g transform="translate({_n(W / 2 + 44)} 380) scale(2.3)">{mark_mono(CLOUD)}</g>')
    p.append(f'<rect x="{_n(W / 2 + 220)}" y="372" width="180" height="120" rx="10" fill="#FFFFFF"/>')
    p.append(f'<g transform="translate({_n(W / 2 + 258)} 380) scale(1.9)">{mark_mono(FOREST)}</g>')
    p.append(label(W / 2 + 44, 530, "KNOCKOUT / SOLID \u2014 STAMPS, RECEIPTS, VINYL", MUTED, 10.0, 0.8))

    # Row 3 -- lockups.
    p.append(f'<rect x="0" y="620" width="{_n(W)}" height="270" fill="#FFFFFF"/>')
    p.append(label(40, 660, "LOCKUPS"))
    p.append(f'<g transform="translate(40 690) scale(0.95)">{_strip(lockup_horizontal(False, False))}</g>')
    p.append(f'<g transform="translate(40 790) scale(0.95)">{_strip(lockup_horizontal(False, True))}</g>')
    p.append(f'<g transform="translate(560 672) scale(0.62)">{_strip(lockup_stacked(False))}</g>')
    p.append(f'<g transform="translate(860 700) scale(0.9)">{_strip(wordmark_only(False))}</g>')
    p.append(label(860, 760, "TEXT ONLY \u2014 FOOTERS, INVOICES, WHATSAPP", "#8A9A90", 10.0, 0.8))

    # Row 4 -- dark context + palette.
    p.append(f'<rect x="0" y="890" width="{_n(W * 0.52)}" height="290" fill="{INK}"/>')
    p.append(label(40, 930, "ON DARK \u2014 SITE NAVBAR", MUTED))
    p.append(f'<g transform="translate(40 955) scale(0.95)">{_strip(lockup_horizontal(True, False))}</g>')
    p.append(f'<g transform="translate(40 1060) scale(0.8)">{_strip(lockup_horizontal(True, True))}</g>')

    p.append(f'<rect x="{_n(W * 0.52)}" y="890" width="{_n(W * 0.48)}" height="290" fill="#F7F9F7"/>')
    p.append(label(W * 0.52 + 40, 930, "PALETTE"))
    swatches = [
        (GREEN, "BRAND GREEN", "#16A34A"),
        (FOREST, "FOREST", "#14532D"),
        (FRESH, "FRESH", "#4ADE80"),
        (GOLD_LIGHT, "HARVEST", "#F59E0B"),
        (INK, "INK", "#101612"),
        (CLOUD, "CLOUD", "#E8EEE9"),
    ]
    sx = W * 0.52 + 40
    for fill, name, hexv in swatches:
        p.append(f'<rect x="{_n(sx)}" y="955" width="86" height="86" rx="10" fill="{fill}" '
                 f'stroke="#DCE4DE" stroke-width="1"/>')
        p.append(label(sx, 1062, name, "#4F6156", 9.5, 0.9))
        p.append(label(sx, 1078, hexv, "#8A9A90", 9.5, 0.9))
        sx += 100

    body = "".join(p)
    return svg(W, H, f"0 0 {_n(W)} {_n(H)}", body, "Bagaash.com brand sheet")


def build():
    files = []

    files.append(("bagaash-mark.svg", svg(512, 512, "0 0 64 64", mark(**MARK_FULL),
                                          "Bagaash.com mark: a grocery tote carrying an ear of wheat")))
    files.append(("bagaash-mark-mono.svg", svg(512, 512, "0 0 64 64",
                                               f'<g fill="currentColor">{mark_mono("currentColor")}</g>',
                                               "Bagaash.com mark, single colour")))
    files.append(("bagaash-app-icon.svg", app_icon()))
    files.append(("bagaash-favicon.svg", favicon()))
    files.append(("bagaash-logo-horizontal.svg", lockup_horizontal(False, False)))
    files.append(("bagaash-logo-horizontal-on-dark.svg", lockup_horizontal(True, False)))
    files.append(("bagaash-logo-horizontal-tagline.svg", lockup_horizontal(False, True)))
    files.append(("bagaash-logo-horizontal-tagline-on-dark.svg", lockup_horizontal(True, True)))
    files.append(("bagaash-logo-stacked.svg", lockup_stacked(False)))
    files.append(("bagaash-logo-stacked-on-dark.svg", lockup_stacked(True)))
    files.append(("bagaash-wordmark.svg", wordmark_only(False)))
    files.append(("bagaash-wordmark-on-dark.svg", wordmark_only(True)))

    for name, content in files:
        write(name, content)

    rasterize("bagaash-mark.svg", "bagaash-mark.png", 512)
    rasterize("bagaash-app-icon.svg", "bagaash-app-icon.png", 512)
    rasterize("bagaash-app-icon.svg", "bagaash-app-icon-1024.png", 1024)
    rasterize("bagaash-favicon.svg", "bagaash-favicon-32.png", 32)
    rasterize("bagaash-app-icon.svg", "bagaash-apple-touch-icon.png", 180)
    rasterize("bagaash-logo-horizontal.svg", "bagaash-logo-horizontal.png", 1024)
    rasterize("bagaash-logo-horizontal-on-dark.svg", "bagaash-logo-horizontal-on-dark.png", 1024)
    rasterize("bagaash-logo-stacked.svg", "bagaash-logo-stacked.png", 900)

    # The sheet is a preview only, so it ships as a PNG rather than a large
    # SVG full of duplicated outlines.
    rasterize_text(brand_sheet(), "bagaash-brand-sheet.png", 1440)

    print("wrote", len(files), "svg files to", OUT)


if __name__ == "__main__":
    build()
