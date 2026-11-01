"""Startup migrations must find their scripts without alembic.ini, which is gitignored and absent on deploys."""
from alembic.script import ScriptDirectory

from app.core.migrations import alembic_config


def test_migrations_resolve_to_a_single_head_without_an_ini_file():
    config = alembic_config()

    assert config.config_file_name is None
    assert len(ScriptDirectory.from_config(config).get_heads()) == 1
