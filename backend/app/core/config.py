from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=False)

    app_name: str = 'DeepLung Backend'
    app_env: str = 'dev'
    app_port: int = 8000

    jwt_secret: str = 'replace-me'
    jwt_expire_minutes: int = 120

    database_url: str = 'sqlite:///./deeplung.db'
    seed_admin_username: str = 'admin'
    seed_admin_password: str = 'admin123456'
    seed_doctor_username: str = 'doctor_demo'
    seed_doctor_password: str = 'doctor123456'
    seed_patient_username: str = 'patient_demo'
    seed_patient_password: str = 'patient123456'

    ai_engine_base_url: str = 'http://127.0.0.1:8100'
    ai_engine_timeout_seconds: int = 300
    redis_url: str = 'redis://localhost:6379/0'

    assistant_provider: str = 'mock'  # mock | external
    assistant_fallback_to_mock_on_error: bool = True
    assistant_api_base_url: str = 'https://api.deepseek.com/v1'
    assistant_api_key: str = ''
    assistant_model: str = 'deepseek-chat'
    assistant_timeout_seconds: int = 60
    assistant_system_prompt: str = '你是肺结节随访助手，回答应简洁、谨慎、以就医建议为主，不做确诊。'


@lru_cache
def get_settings() -> Settings:
    return Settings()
