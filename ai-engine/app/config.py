from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=False)

    ai_app_name: str = 'DeepLung AI Engine'
    ai_app_port: int = 8100

    detector_provider: str = 'mock'  # mock | monai_bundle
    model_version: str = 'baseline-mock-v1'
    fallback_to_mock_on_error: bool = True

    monai_bundle_repo_id: str = 'MONAI/lung_nodule_ct_detection'
    monai_bundle_dir: str = './models/lung_nodule_ct_detection'
    monai_auto_download: bool = True
    monai_infer_config_relpath: str = 'configs/inference.json'
    monai_meta_file_relpath: str = 'configs/metadata.json'
    monai_device: str = 'auto'  # auto | cpu | cuda


@lru_cache
def get_settings() -> Settings:
    return Settings()
