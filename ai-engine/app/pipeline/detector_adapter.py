from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


RiskLevel = Literal['LOW', 'MEDIUM', 'HIGH']


@dataclass
class PredictInput:
    study_id: str
    object_key: str
    ct_path: str | None = None


@dataclass
class RuntimeDeviceInfo:
    requested_device: str
    resolved_device: str
    cuda_available: bool
    cuda_device_count: int
    cuda_device_name: str | None
    torch_version: str | None
    fallback_reason: str | None = None


class MockDetector:
    def __init__(self, model_version: str = 'baseline-mock-v1') -> None:
        self.model_version = model_version

    def get_runtime_status(self) -> dict[str, Any]:
        return {
            'provider': 'mock',
            'active_mode': 'mock',
            'model_ready': True,
        }

    def predict(self, payload: PredictInput, note: str | None = None) -> dict[str, Any]:
        seed = int(hashlib.md5(payload.study_id.encode('utf-8')).hexdigest()[:8], 16)
        detection_score = (seed % 1000) / 1000.0
        size_factor = min((4 + (seed % 320) / 10.0) / 30.0, 1.0)
        risk_score = max(min(0.75 * detection_score + 0.25 * size_factor, 1.0), 0.0)
        risk_level, risk_light = _risk_tags(risk_score)

        base_diameter = round(4 + (seed % 320) / 10.0, 2)
        nodules = [
            {
                'index': 0,
                'coord_x': round((seed % 200) / 10.0, 2),
                'coord_y': round((seed % 300) / 10.0, 2),
                'coord_z': round((seed % 400) / 10.0, 2),
                'diameter_mm': base_diameter,
                'volume_mm3': round(base_diameter**3 * 0.52, 2),
                'detection_score': round(min(max(detection_score + 0.08, 0.01), 0.99), 4),
                'location': '肺部',
            }
        ]

        return {
            'model_version': self.model_version,
            'risk_score': round(risk_score, 4),
            'risk_level': risk_level,
            'risk_light': risk_light,
            'nodules': nodules,
            'summary': f'检测到 {len(nodules)} 个疑似结节，已完成辅助风险分层，当前优先级为 {risk_level}',
            'inference_mode_used': 'mock',
            'note': note or 'using mock detector',
        }


class MonaiBundleDetector:
    def __init__(
        self,
        model_version: str,
        bundle_repo_id: str,
        bundle_dir: str,
        auto_download: bool,
        infer_config_relpath: str,
        meta_file_relpath: str,
        device: str,
    ) -> None:
        self.model_version = model_version
        self.bundle_repo_id = bundle_repo_id
        self.bundle_dir = Path(bundle_dir).resolve()
        self.auto_download = auto_download
        self.infer_config_path = self.bundle_dir / infer_config_relpath
        self.meta_file_path = self.bundle_dir / meta_file_relpath
        self.requested_device = device

    def get_runtime_status(self) -> dict[str, Any]:
        runtime = _resolve_runtime_device(self.requested_device)
        return {
            'provider': 'monai_bundle',
            'bundle_repo_id': self.bundle_repo_id,
            'bundle_dir': str(self.bundle_dir),
            'bundle_ready': self._is_bundle_ready(),
            'inference_config': str(self.infer_config_path),
            'meta_file': str(self.meta_file_path),
            'requested_device': runtime.requested_device,
            'resolved_device': runtime.resolved_device,
            'cuda_available': runtime.cuda_available,
            'cuda_device_count': runtime.cuda_device_count,
            'cuda_device_name': runtime.cuda_device_name,
            'torch_version': runtime.torch_version,
            'fallback_reason': runtime.fallback_reason,
        }

    def predict(self, payload: PredictInput) -> dict[str, Any]:
        ct_path = _resolve_ct_path(payload)
        if ct_path is None:
            raise RuntimeError('ct_path is required for monai_bundle provider')

        self._ensure_bundle()
        runtime = _resolve_runtime_device(self.requested_device)

        with tempfile.TemporaryDirectory(prefix='deeplung_monai_') as tmp:
            tmp_dir = Path(tmp)
            data_list_path = tmp_dir / 'datalist.json'
            output_dir = tmp_dir / 'eval'
            output_dir.mkdir(parents=True, exist_ok=True)
            output_filename = 'result_0.json'
            raw_luna = ct_path.suffix.lower() in ('.mhd', '.mha', '.raw')
            runtime_config_path = self._make_runtime_infer_config(
                tmp_dir, raw_luna=raw_luna, resolved_device=runtime.resolved_device
            )

            data_list = {'validation': [{'image': str(ct_path)}]}
            data_list_path.write_text(json.dumps(data_list, ensure_ascii=False), encoding='utf-8')

            cmd = [
                sys.executable,
                '-m',
                'monai.bundle',
                'run',
                '--config_file',
                str(runtime_config_path),
                '--meta_file',
                str(self.meta_file_path),
                '--dataset_dir',
                str(ct_path.parent),
                '--data_list_file_path',
                str(data_list_path),
                '--data_list_key',
                'validation',
                '--pred_box_mode',
                'cccwhd',
                '--output_dir',
                str(output_dir),
                '--output_filename',
                output_filename,
                '--amp',
                'false',
                '--deterministic_transforms',
                'false',
            ]

            if runtime.resolved_device == 'cuda':
                cmd += ['--use_cuda', 'true']
            else:
                cmd += ['--use_cuda', 'false']

            proc = subprocess.run(
                cmd,
                cwd=str(self.bundle_dir),
                capture_output=True,
                text=True,
                check=False,
            )
            if proc.returncode != 0:
                stderr = (proc.stderr or '').strip()
                stdout = (proc.stdout or '').strip()
                raise RuntimeError(f'monai bundle run failed: {stderr or stdout}')

            result_path = output_dir / output_filename
            if not result_path.exists():
                raise RuntimeError(f'inference result not found: {result_path}')

            raw = json.loads(result_path.read_text(encoding='utf-8'))
            return self._convert_result(raw, runtime=runtime)

    def _is_bundle_ready(self) -> bool:
        return (
            self.infer_config_path.exists()
            and self.meta_file_path.exists()
            and self._has_usable_weight_file()
        )

    def _has_usable_weight_file(self) -> bool:
        model_dir = self.bundle_dir / 'models'
        candidates = [model_dir / 'model.pt', model_dir / 'model.ts']
        return any(_is_usable_weight_file(p) for p in candidates)

    def _ensure_bundle(self) -> None:
        if self._is_bundle_ready():
            return
        if not self.auto_download:
            raise RuntimeError(f'MONAI bundle not found: {self.bundle_dir}')

        try:
            from huggingface_hub import snapshot_download
        except Exception as exc:
            raise RuntimeError('huggingface_hub is required for auto download') from exc

        snapshot_download(
            repo_id=self.bundle_repo_id,
            local_dir=str(self.bundle_dir),
            local_dir_use_symlinks=False,
        )

        if not self._is_bundle_ready():
            raise RuntimeError(f'downloaded bundle is incomplete: {self.bundle_dir}')

    def _make_runtime_infer_config(self, tmp_dir: Path, raw_luna: bool, resolved_device: str) -> Path:
        cfg = json.loads(self.infer_config_path.read_text(encoding='utf-8'))

        cfg['whether_raw_luna16'] = bool(raw_luna)
        cfg['whether_resampled_luna16'] = bool(not raw_luna)

        # The official bundle checkpoint can be CUDA-serialized. In CPU mode, we must
        # force map_location to avoid torch deserialization errors.
        if resolved_device != 'cuda':
            cfg['device'] = "$torch.device('cpu')"
            if isinstance(cfg.get('checkpointloader'), dict):
                cfg['checkpointloader']['map_location'] = 'cpu'

        out = tmp_dir / 'inference.runtime.json'
        out.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
        return out

    def _convert_result(self, raw: Any, runtime: RuntimeDeviceInfo) -> dict[str, Any]:
        if isinstance(raw, dict):
            records = [raw]
        else:
            records = raw

        if not records:
            return {
                'model_version': self.model_version,
                'risk_score': 0.0,
                'risk_level': 'LOW',
                'risk_light': 'GREEN',
                'nodules': [],
                'summary': '未检测到疑似结节',
                'inference_mode_used': 'monai_bundle',
                'note': runtime.fallback_reason or 'empty result',
            }

        first = records[0]
        boxes = first.get('box', []) or []
        scores = first.get('label_scores', []) or []

        nodules = []
        for i, box in enumerate(boxes):
            if len(box) < 6:
                continue
            cx, cy, cz, w, h, d = [float(v) for v in box[:6]]
            score = float(scores[i]) if i < len(scores) else 0.0
            diameter = max((w + h + d) / 3.0, 0.1)
            volume = max(w * h * d, 0.1)

            nodules.append(
                {
                    'index': i,
                    'coord_x': round(cx, 3),
                    'coord_y': round(cy, 3),
                    'coord_z': round(cz, 3),
                    'diameter_mm': round(diameter, 3),
                    'volume_mm3': round(volume, 3),
                    'detection_score': round(max(min(score, 1.0), 0.0), 4),
                    'location': '肺部',
                }
            )

        if not nodules:
            risk_score = 0.0
        else:
            max_prob = max(float(n['detection_score']) for n in nodules)
            max_size = max(float(n['diameter_mm']) for n in nodules)
            size_factor = min(max_size / 30.0, 1.0)
            risk_score = max(min(0.75 * max_prob + 0.25 * size_factor, 1.0), 0.0)

        risk_level, risk_light = _risk_tags(risk_score)

        return {
            'model_version': self.model_version,
            'risk_score': round(risk_score, 4),
            'risk_level': risk_level,
            'risk_light': risk_light,
            'nodules': nodules,
            'summary': f'检测到 {len(nodules)} 个疑似结节，已完成辅助风险分层，当前优先级为 {risk_level}',
            'inference_mode_used': 'monai_bundle',
            'note': runtime.fallback_reason,
        }


class DetectorAdapter:
    def __init__(
        self,
        detector_provider: str,
        model_version: str,
        fallback_to_mock_on_error: bool,
        monai_bundle_repo_id: str,
        monai_bundle_dir: str,
        monai_auto_download: bool,
        monai_infer_config_relpath: str,
        monai_meta_file_relpath: str,
        monai_device: str,
    ) -> None:
        self.provider = detector_provider
        self.model_version = model_version
        self.fallback_to_mock_on_error = fallback_to_mock_on_error
        self.mock = MockDetector(model_version=model_version)
        self.monai = MonaiBundleDetector(
            model_version=model_version,
            bundle_repo_id=monai_bundle_repo_id,
            bundle_dir=monai_bundle_dir,
            auto_download=monai_auto_download,
            infer_config_relpath=monai_infer_config_relpath,
            meta_file_relpath=monai_meta_file_relpath,
            device=monai_device,
        )

    def get_runtime_status(self) -> dict[str, Any]:
        if self.provider == 'monai_bundle':
            status = self.monai.get_runtime_status()
            status['fallback_to_mock_on_error'] = self.fallback_to_mock_on_error
            return status
        return self.mock.get_runtime_status()

    def predict(self, payload: PredictInput) -> dict[str, Any]:
        if self.provider != 'monai_bundle':
            return self.mock.predict(payload)

        try:
            return self.monai.predict(payload)
        except Exception as exc:
            if not self.fallback_to_mock_on_error:
                raise
            return self.mock.predict(payload, note=f'monai failed, fallback to mock: {exc}')


def _resolve_ct_path(payload: PredictInput) -> Path | None:
    if payload.ct_path:
        p = Path(payload.ct_path)
        if p.exists():
            return p

    object_path = Path(payload.object_key)
    if object_path.exists():
        return object_path

    return None


def _risk_tags(risk_score: float) -> tuple[RiskLevel, str]:
    if risk_score >= 0.75:
        return 'HIGH', 'RED'
    if risk_score >= 0.4:
        return 'MEDIUM', 'YELLOW'
    return 'LOW', 'GREEN'


def _is_usable_weight_file(path: Path) -> bool:
    if not path.exists() or not path.is_file():
        return False

    try:
        # Git LFS pointer files are tiny text files (~100 bytes), not real weights.
        if path.stat().st_size < 1_000_000:
            return False
        with path.open('rb') as f:
            header = f.read(96)
    except OSError:
        return False

    return b'git-lfs.github.com/spec/v1' not in header


def _resolve_runtime_device(requested_device: str) -> RuntimeDeviceInfo:
    requested = (requested_device or 'auto').strip().lower()
    if requested not in {'auto', 'cpu', 'cuda'}:
        requested = 'auto'

    torch_version: str | None = None
    cuda_available = False
    cuda_device_count = 0
    cuda_device_name: str | None = None
    fallback_reason: str | None = None

    try:
        import torch

        torch_version = torch.__version__
        cuda_available = bool(torch.cuda.is_available())
        cuda_device_count = int(torch.cuda.device_count())
        if cuda_available and cuda_device_count > 0:
            cuda_device_name = str(torch.cuda.get_device_name(0))
    except Exception as exc:
        fallback_reason = f'torch runtime unavailable: {exc}'

    if requested == 'cpu':
        resolved = 'cpu'
    elif requested == 'cuda':
        if cuda_available:
            resolved = 'cuda'
        else:
            resolved = 'cpu'
            fallback_reason = fallback_reason or 'requested cuda but no CUDA device is available, fallback to cpu'
    else:
        resolved = 'cuda' if cuda_available else 'cpu'
        if resolved == 'cpu' and not fallback_reason:
            fallback_reason = 'auto device selection resolved to cpu'

    return RuntimeDeviceInfo(
        requested_device=requested,
        resolved_device=resolved,
        cuda_available=cuda_available,
        cuda_device_count=cuda_device_count,
        cuda_device_name=cuda_device_name,
        torch_version=torch_version,
        fallback_reason=fallback_reason,
    )
