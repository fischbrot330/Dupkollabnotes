from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt_value = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_value.encode("utf-8"),
        120_000,
    )
    return salt_value, digest.hex()


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    _, calculated_hash = hash_password(password, salt)
    return hmac.compare_digest(calculated_hash, password_hash)
