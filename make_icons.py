"""Generate Sage Pop-Up icons (rounded blue square with an open book).

Pure stdlib: builds RGBA pixels and writes PNG via zlib/struct.
"""
import os
import struct
import zlib

BLUE = (32, 84, 167)
WHITE = (255, 255, 255)
SS = 4  # supersampling factor per axis


def point_in_poly(x, y, poly):
    """Even-odd rule ray casting."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            x_cross = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def in_rounded_rect(x, y, cx, cy, half, r):
    dx = abs(x - cx)
    dy = abs(y - cy)
    if dx > half or dy > half:
        return False
    if dx <= half - r or dy <= half - r:
        return True
    corner_dx = dx - (half - r)
    corner_dy = dy - (half - r)
    return corner_dx * corner_dx + corner_dy * corner_dy <= r * r


# Open book pages (coordinates on a 512 grid)
LEFT_PAGE = [(128, 176), (244, 148), (244, 364), (128, 344)]
RIGHT_PAGE = [(384, 176), (268, 148), (268, 364), (384, 344)]
SPINE_L = [(244, 148), (256, 156), (256, 372), (244, 364)]
SPINE_R = [(268, 148), (256, 156), (256, 372), (268, 364)]


def render(size):
    """Render the icon at `size` px, sampled on a 512-unit design grid."""
    pixels = []
    scale = 512 / (size * SS)
    half = 512 * 0.97
    for py in range(size):
        row = []
        for px in range(size):
            r = g = b = 0
            a_total = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) * scale
                    y = (py * SS + sy + 0.5) * scale
                    if in_rounded_rect(x, y, 256, 256, half, 96):
                        a_total += 255
                        if (
                            point_in_poly(x, y, LEFT_PAGE)
                            or point_in_poly(x, y, RIGHT_PAGE)
                            or point_in_poly(x, y, SPINE_L)
                            or point_in_poly(x, y, SPINE_R)
                        ):
                            r += WHITE[0]
                            g += WHITE[1]
                            b += WHITE[2]
                        else:
                            r += BLUE[0]
                            g += BLUE[1]
                            b += BLUE[2]
            samples = SS * SS
            if a_total == 0:
                row.append((0, 0, 0, 0))
            else:
                row.append(
                    (
                        round(r / samples),
                        round(g / samples),
                        round(b / samples),
                        round(a_total / samples),
                    )
                )
        pixels.append(row)
    return pixels


def write_png(path, size, pixels):
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter: none
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs("icons", exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(f"icons/icon{size}.png", size, render(size))
        print(f"icons/icon{size}.png written")
