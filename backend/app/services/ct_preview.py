from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image


@dataclass
class PreviewPoint:
    index: int
    left_ratio: float
    top_ratio: float
    size_px: float
    score: float
    diameter_mm: float


@dataclass
class PreviewResult:
    png_bytes: bytes
    points: list[PreviewPoint]


@dataclass
class _VolumeContext:
    volume_zyx: np.ndarray
    spacing_xyz: tuple[float, float, float]
    world_to_index_xyz: Callable[[float, float, float], tuple[float, float, float]] | None


def build_ct_preview_png(ct_path: str, nodules: list[dict] | None = None) -> bytes:
    return build_ct_preview(ct_path=ct_path, nodules=nodules).png_bytes


def build_ct_preview(ct_path: str, nodules: list[dict] | None = None) -> PreviewResult:
    path = Path(ct_path)
    if not path.exists():
        raise ValueError(f'ct file not found: {path}')

    ctx = _load_volume_context(path)
    mapped = _map_nodules(ctx, nodules or [])
    slice_idx = _pick_slice_index(ctx.volume_zyx.shape[0], mapped)

    slice_2d = np.asarray(ctx.volume_zyx[slice_idx], dtype=np.float32)
    image_u8 = _normalize_to_u8(slice_2d)

    image = Image.fromarray(image_u8, mode='L')
    if max(image.size) > 768:
        image.thumbnail((768, 768), Image.Resampling.BILINEAR)

    points = _build_overlay_points(
        mapped=mapped,
        slice_idx=slice_idx,
        width=image.width,
        height=image.height,
        source_width=image_u8.shape[1],
        source_height=image_u8.shape[0],
        spacing_xyz=ctx.spacing_xyz,
    )

    out = BytesIO()
    image.save(out, format='PNG')
    return PreviewResult(png_bytes=out.getvalue(), points=points)


def _load_volume_context(path: Path) -> _VolumeContext:
    suffix = ''.join(path.suffixes).lower()

    if suffix.endswith('.nii') or suffix.endswith('.nii.gz'):
        try:
            import nibabel as nib
        except Exception as exc:  # pragma: no cover
            raise ValueError('nibabel is not installed for NIfTI preview') from exc

        img = nib.load(str(path))
        data = np.asarray(img.get_fdata(), dtype=np.float32)
        while data.ndim > 3:
            data = data[..., 0]

        if data.ndim == 2:
            volume_zyx = data[np.newaxis, :, :]
        elif data.ndim == 3:
            # nibabel canonical data is xyz; convert to zyx for axial viewing.
            volume_zyx = np.transpose(data, (2, 1, 0))
        else:
            raise ValueError(f'unsupported image shape: {data.shape}')

        zooms = tuple(float(x) for x in img.header.get_zooms()[:3])
        if len(zooms) < 3:
            zooms = (1.0, 1.0, 1.0)

        inv_affine = np.linalg.inv(np.asarray(img.affine, dtype=np.float64))

        def world_to_index_xyz(x: float, y: float, z: float) -> tuple[float, float, float]:
            vec = inv_affine @ np.array([x, y, z, 1.0], dtype=np.float64)
            return float(vec[0]), float(vec[1]), float(vec[2])

        return _VolumeContext(
            volume_zyx=np.nan_to_num(volume_zyx, nan=0.0, posinf=0.0, neginf=0.0),
            spacing_xyz=(zooms[0], zooms[1], zooms[2]),
            world_to_index_xyz=world_to_index_xyz,
        )

    try:
        import SimpleITK as sitk
    except Exception as exc:  # pragma: no cover
        raise ValueError('SimpleITK is not installed for CT preview') from exc

    try:
        img = sitk.ReadImage(str(path))
        arr = sitk.GetArrayFromImage(img)
    except Exception as exc:
        raise ValueError(f'failed to read ct image: {exc}') from exc

    arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 2:
        volume_zyx = arr[np.newaxis, :, :]
    elif arr.ndim == 3:
        volume_zyx = arr
    else:
        raise ValueError(f'unsupported image shape: {arr.shape}')

    spacing = tuple(float(x) for x in img.GetSpacing())
    if len(spacing) == 2:
        spacing_xyz = (spacing[0], spacing[1], 1.0)
    else:
        spacing_xyz = (spacing[0], spacing[1], spacing[2])

    dim = int(img.GetDimension())

    def world_to_index_xyz(x: float, y: float, z: float) -> tuple[float, float, float]:
        # Some pipelines output RAS physical coordinates; SITK expects LPS.
        candidates: list[tuple[float, float, float]] = []
        if dim == 2:
            i2 = img.TransformPhysicalPointToContinuousIndex((x, y))
            candidates.append((float(i2[0]), float(i2[1]), 0.0))
            i2f = img.TransformPhysicalPointToContinuousIndex((-x, -y))
            candidates.append((float(i2f[0]), float(i2f[1]), 0.0))
        else:
            i3 = img.TransformPhysicalPointToContinuousIndex((x, y, z))
            candidates.append((float(i3[0]), float(i3[1]), float(i3[2])))
            i3f = img.TransformPhysicalPointToContinuousIndex((-x, -y, z))
            candidates.append((float(i3f[0]), float(i3f[1]), float(i3f[2])))

        best = candidates[0]
        best_score = _in_bounds_score(best, volume_zyx.shape)
        for cand in candidates[1:]:
            score = _in_bounds_score(cand, volume_zyx.shape)
            if score > best_score:
                best = cand
                best_score = score
        return best

    return _VolumeContext(
        volume_zyx=np.nan_to_num(volume_zyx, nan=0.0, posinf=0.0, neginf=0.0),
        spacing_xyz=spacing_xyz,
        world_to_index_xyz=world_to_index_xyz,
    )


def _in_bounds_score(index_xyz: tuple[float, float, float], shape_zyx: tuple[int, int, int]) -> int:
    x, y, z = index_xyz
    zmax, ymax, xmax = shape_zyx
    score = 0
    if 0.0 <= x <= xmax - 1:
        score += 1
    if 0.0 <= y <= ymax - 1:
        score += 1
    if 0.0 <= z <= zmax - 1:
        score += 1
    return score


def _map_nodules(ctx: _VolumeContext, nodules: list[dict]) -> list[dict]:
    mapped: list[dict] = []
    for i, n in enumerate(nodules):
        index = int(n.get('index') if isinstance(n.get('index'), (int, float)) else i)
        x = float(n.get('coord_x') or 0.0)
        y = float(n.get('coord_y') or 0.0)
        z = float(n.get('coord_z') or 0.0)
        diameter_mm = float(n.get('diameter_mm') or 0.0)
        score = float(n.get('detection_score') or 0.0)

        try:
            if ctx.world_to_index_xyz is None:
                x_idx, y_idx, z_idx = x, y, z
            else:
                x_idx, y_idx, z_idx = ctx.world_to_index_xyz(x, y, z)
        except Exception:
            x_idx, y_idx, z_idx = x, y, z

        mapped.append(
            {
                'index': index,
                'x_idx': float(x_idx),
                'y_idx': float(y_idx),
                'z_idx': float(z_idx),
                'diameter_mm': max(float(diameter_mm), 0.0),
                'score': max(min(float(score), 1.0), 0.0),
            }
        )
    return mapped


def _pick_slice_index(z_count: int, mapped: list[dict]) -> int:
    if z_count <= 1:
        return 0

    if mapped:
        target = max(mapped, key=lambda x: float(x.get('diameter_mm') or 0.0))
        z = float(target.get('z_idx') or 0.0)
        if np.isfinite(z):
            return int(np.clip(round(z), 0, z_count - 1))

    return z_count // 2


def _build_overlay_points(
    *,
    mapped: list[dict],
    slice_idx: int,
    width: int,
    height: int,
    source_width: int,
    source_height: int,
    spacing_xyz: tuple[float, float, float],
) -> list[PreviewPoint]:
    if not mapped:
        return []

    spacing_x, spacing_y, _ = spacing_xyz
    mm_per_px = max((spacing_x + spacing_y) / 2.0, 0.1)
    px_per_mm = 1.0 / mm_per_px

    points: list[PreviewPoint] = []
    for m in mapped:
        x_idx = float(m['x_idx'])
        y_idx = float(m['y_idx'])
        z_idx = float(m['z_idx'])
        if not (np.isfinite(x_idx) and np.isfinite(y_idx) and np.isfinite(z_idx)):
            continue

        dist = abs(z_idx - float(slice_idx))
        if dist > 5.0 and len(mapped) > 1:
            continue

        left_ratio = float(np.clip(x_idx / max(source_width - 1, 1), 0.0, 1.0))
        top_ratio = float(np.clip(y_idx / max(source_height - 1, 1), 0.0, 1.0))

        size_px_source = max(14.0, min(96.0, float(m['diameter_mm']) * px_per_mm * 1.6))
        scale_x = width / max(source_width, 1)
        scale_y = height / max(source_height, 1)
        size_px = float(size_px_source * (scale_x + scale_y) / 2.0)

        points.append(
            PreviewPoint(
                index=int(m['index']),
                left_ratio=left_ratio,
                top_ratio=top_ratio,
                size_px=size_px,
                score=float(m['score']),
                diameter_mm=float(m['diameter_mm']),
            )
        )

    if points:
        return points

    # Fallback: if all points were filtered out by slice distance, keep the largest one.
    largest = max(mapped, key=lambda x: float(x.get('diameter_mm') or 0.0))
    left_ratio = float(np.clip(float(largest['x_idx']) / max(source_width - 1, 1), 0.0, 1.0))
    top_ratio = float(np.clip(float(largest['y_idx']) / max(source_height - 1, 1), 0.0, 1.0))
    size_px_source = max(14.0, min(96.0, float(largest['diameter_mm']) * px_per_mm * 1.6))
    scale_x = width / max(source_width, 1)
    scale_y = height / max(source_height, 1)

    return [
        PreviewPoint(
            index=int(largest['index']),
            left_ratio=left_ratio,
            top_ratio=top_ratio,
            size_px=float(size_px_source * (scale_x + scale_y) / 2.0),
            score=float(largest['score']),
            diameter_mm=float(largest['diameter_mm']),
        )
    ]


def _normalize_to_u8(image_2d: np.ndarray) -> np.ndarray:
    arr = np.asarray(image_2d, dtype=np.float32)
    arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)

    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return np.zeros((256, 256), dtype=np.uint8)

    lo = float(np.percentile(finite, 1.0))
    hi = float(np.percentile(finite, 99.5))
    if hi <= lo:
        hi = lo + 1.0

    arr = np.clip(arr, lo, hi)
    arr = (arr - lo) / (hi - lo)
    arr = np.power(arr, 0.85)
    return np.asarray(arr * 255.0, dtype=np.uint8)
