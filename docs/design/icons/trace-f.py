#!/usr/bin/env python3
"""Traces the original f-hole atom drawing (f-original.png) into f-trace.json for gen.mjs.

The white drawing is split into its connected pieces. The f keeps its outline (smoothed, with the
two nicks at its waist re-added as crisp triangles) and its two eyes as fitted circles; the piece
holding the lower-right electron gives that circle plus the arc it rides on; every other piece is an
orbit arc, reduced to a smoothed centreline and a stroke width. The orange disc and the nucleus are
fitted as circles. Everything stays in the drawing's own pixel space; gen.mjs maps the disc onto
each platform's body.

Needs numpy, scipy, scikit-image, networkx and Pillow. Run from this folder: python3 trace-f.py
"""
import json
import networkx as nx
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.interpolate import splev, splprep
from skimage import measure, morphology

im = np.asarray(Image.open('f-original.png').convert('RGB')).astype(int)
H, W, _ = im.shape
R, G, B = im[..., 0], im[..., 1], im[..., 2]

# The disc, from the extent of the orange; the white drawing and the nucleus inside it.
ys, xs = np.nonzero((R > 200) & (G > 120) & (G < 180) & (B < 90))
disc = [(xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2, (xs.max() - xs.min()) / 2]
yy, xx = np.mgrid[0:H, 0:W]
inside = (xx - disc[0]) ** 2 + (yy - disc[1]) ** 2 < (disc[2] - 6) ** 2
white = (R > 225) & (G > 215) & (B > 205) & inside
ny, nxs = np.nonzero((R > 200) & (G < 130) & (B < 40) & inside)
nucleus = [nxs.mean(), ny.mean(), np.sqrt(len(nxs) / np.pi)]


def disk(c, r):
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= r * r


def biggest_disk(mask):
    dt = ndi.distance_transform_edt(mask)
    i = np.unravel_index(np.argmax(dt), dt.shape)
    return (float(i[1]), float(i[0])), float(dt[i])


def fit_circle(mask, c, r):
    """Least-squares circle through the piece's boundary near (c, r), ignoring where a stroke joins it."""
    cont = max(measure.find_contours(mask.astype(float), 0.5), key=len)
    pts = np.array([(x, y) for y, x in cont])
    sel = pts[np.hypot(pts[:, 0] - c[0], pts[:, 1] - c[1]) < r * 1.2]
    for _ in range(3):
        A = np.c_[2 * sel[:, 0], 2 * sel[:, 1], np.ones(len(sel))]
        (cx, cy, k), *_ = np.linalg.lstsq(A, (sel**2).sum(1), rcond=None)
        rr = np.sqrt(k + cx * cx + cy * cy)
        res = np.abs(np.hypot(sel[:, 0] - cx, sel[:, 1] - cy) - rr)
        sel = sel[res < np.percentile(res, 80)]
    return [float(cx), float(cy), float(rr)]


def centreline(mask):
    """The longest path through the piece's skeleton, and the stroke width along its middle."""
    sk = morphology.skeletonize(mask)
    ys, xs = np.nonzero(sk)
    idx = {(x, y): i for i, (x, y) in enumerate(zip(xs, ys))}
    g = nx.Graph()
    for (x, y), i in idx.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx or dy) and (x + dx, y + dy) in idx:
                    g.add_edge(i, idx[(x + dx, y + dy)], w=np.hypot(dx, dy))
    far = lambda n: max((d := nx.single_source_dijkstra_path_length(g, n, weight='w')), key=d.get)
    a = far(next(iter(g.nodes)))
    path = nx.dijkstra_path(g, a, far(a), weight='w')
    pts = np.array([(xs[i], ys[i]) for i in path], float)
    dt = ndi.distance_transform_edt(mask)
    mid = pts[len(pts) // 5 : len(pts) * 4 // 5] if len(pts) > 10 else pts
    # +1.2: the distance transform measures to pixel centres, which reads about a pixel thin
    return pts, float(2 * np.median([dt[int(y), int(x)] for x, y in mid]) + 1.2)


def smooth(pts, closed=False, step=3.0, s=0.6):
    """A smoothing spline through pts, resampled every `step` px. Short open runs are smoothed harder,
    and one shorter than two stroke-widths becomes a straight dash, so no wiggle survives that is
    tighter than the stroke is wide."""
    if closed:
        pts = np.vstack([pts, pts[:1]])
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    L = d[-1]
    keep = np.r_[True, np.diff(d) > 1e-6]
    pts, d = pts[keep], d[keep]
    if not closed and L < 50:
        c = pts.mean(0)
        ax = np.linalg.svd(pts - c)[2][0]
        pr = (pts - c) @ ax
        return np.array([c + ax * pr.min(), c + ax * pr.max()]), L
    tck, _ = splprep([pts[:, 0], pts[:, 1]], u=d / L, s=len(pts) * s * (1 if closed else max(1, 250 / L)), per=closed, k=3)
    uu = np.linspace(0, 1, max(8, int(L / step)) + 1)
    x, y = splev(uu[:-1] if closed else uu, tck)
    return np.c_[x, y], L


lab = measure.label(white, connectivity=2)
pieces = [p for p in measure.regionprops(lab) if p.area > 150]
fpiece = max(pieces, key=lambda p: p.area)
out = {'disc': disc, 'nucleus': nucleus, 'arcs': []}

# The f: its two eyes are the two biggest inscribed disks.
fm = lab == fpiece.label
c1, r1 = biggest_disk(fm)
c2, r2 = biggest_disk(fm & ~disk(c1, r1 * 1.3))
top, bot = sorted([(c1, r1), (c2, r2)], key=lambda e: e[0][1])
out['eyeTop'], out['eyeBot'] = fit_circle(fm, *top), fit_circle(fm, *bot)
# The nicks: what a wide opening removes near the waist, re-added as triangles on the opened edge.
opened = morphology.binary_opening(fm, morphology.disk(26))
spikes = measure.label(fm & ~opened, connectivity=2)
waist = [(top[0][0] * 0.6 + bot[0][0] * 0.4 - 40, top[0][1] * 0.52 + bot[0][1] * 0.48), (top[0][0] * 0.6 + bot[0][0] * 0.4 + 100, top[0][1] * 0.44 + bot[0][1] * 0.56)]
near_body = ndi.binary_dilation(opened, iterations=2)
away = ndi.distance_transform_edt(~opened)
body, nicks = fm.copy(), []
for sx, sy in waist:
    b = min(measure.regionprops(spikes), key=lambda p: np.hypot(p.centroid[1] - sx, p.centroid[0] - sy))
    m = spikes == b.label
    body &= ~m
    ys, xs = np.nonzero(m)
    i = np.argmax(away[ys, xs])
    tip = np.array([xs[i], ys[i]], float)
    by, bx = np.nonzero(m & near_body)
    base = np.c_[bx, by].astype(float)
    c = base.mean(0)
    n = (tip - c) / np.linalg.norm(tip - c)
    pr = (base - c) @ np.array([-n[1], n[0]])
    # base 25% wider and sunk 4px into the body, so the triangle sits on it without a seam
    a, b2 = c + (base[np.argmin(pr)] - c) * 1.25 - n * 4, c + (base[np.argmax(pr)] - c) * 1.25 - n * 4
    nicks.append([a.tolist(), tip.tolist(), b2.tolist()])
body = morphology.binary_closing(body, morphology.disk(3))
conts = measure.find_contours(ndi.gaussian_filter(body.astype(float), 1.2), 0.5)
out['f'] = [smooth(np.array([(x, y) for y, x in c]), closed=True, step=2.5, s=0.35)[0].tolist() for c in conts if len(c) >= 40]
out['nicks'] = nicks

# The other pieces: the one with a big inscribed disk holds the electron; the rest are arcs.
for p in pieces:
    if p.label == fpiece.label:
        continue
    m = lab == p.label
    c, r = biggest_disk(m)
    if r > 40:
        out['electron'] = fit_circle(m, c, r)
        m &= ~disk(out['electron'][:2], out['electron'][2] + 1.5)
        sub = measure.label(m, connectivity=2)
        parts = [sub == q.label for q in measure.regionprops(sub) if q.area > 150]
    else:
        parts = [m]
    for part in parts:
        pts, w = centreline(part)
        line, L = smooth(pts)
        out['arcs'].append({'w': w, 'len': round(float(L)), 'pts': line.tolist()})
out['arcs'].sort(key=lambda a: -a['len'])

r1 = lambda v: [round(float(x), 1) for x in v] if isinstance(v, (list, np.ndarray)) and not isinstance(v[0], (list, np.ndarray)) else [r1(x) for x in v]
for k in ('disc', 'nucleus', 'eyeTop', 'eyeBot', 'electron', 'f', 'nicks'):
    out[k] = r1(out[k])
for a in out['arcs']:
    a['w'], a['pts'] = round(a['w'], 1), r1(a['pts'])
json.dump(out, open('f-trace.json', 'w'), separators=(',', ':'))
print(f"traced: f outline {sum(len(p) for p in out['f'])} points, {len(out['arcs'])} arcs ({', '.join(str(a['len']) for a in out['arcs'])} px), stroke {np.mean([a['w'] for a in out['arcs']]):.1f} px")
