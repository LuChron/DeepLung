from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=False)

    app_name: str = 'DeepLung Backend'
    app_env: str = 'dev'
    app_port: int = 8000

    jwt_secret: str = 'replace-me'
    jwt_expire_minutes: int = 120

    ai_engine_base_url: str = 'http://127.0.0.1:8100'
    ai_engine_timeout_seconds: int = 300
    redis_url: str = 'redis://localhost:6379/0'


@lru_cache
def get_settings() -> Settings:
    return Settings()
