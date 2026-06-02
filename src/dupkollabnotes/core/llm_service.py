from __future__ import annotations

from pathlib import Path


class LocalGgufLlmService:
    def __init__(self) -> None:
        self._cached_model_path: Path | None = None
        self._cached_model = None

    def _get_model(self, model_path: Path):
        if self._cached_model is not None and self._cached_model_path == model_path:
            return self._cached_model
        try:
            from llama_cpp import Llama  # type: ignore
        except Exception as exc:  # pragma: no cover - depends on optional dependency
            raise RuntimeError(
                "Lokales LLM nicht verfügbar. Bitte 'llama-cpp-python' installieren."
            ) from exc
        model = Llama(model_path=str(model_path), n_ctx=4096, verbose=False)
        self._cached_model_path = model_path
        self._cached_model = model
        return model

    def process_markdown(self, *, model_path: str, instruction: str, markdown_content: str) -> str:
        resolved_model_path = Path(model_path).expanduser().resolve()
        if not resolved_model_path.exists():
            raise RuntimeError(f"GGUF-Modell nicht gefunden: {resolved_model_path}")
        model = self._get_model(resolved_model_path)
        prompt = (
            "You are a local markdown note processing assistant.\n"
            "Follow the instruction exactly.\n"
            "Do not add new facts.\n"
            "Return only markdown.\n\n"
            f"Instruction:\n{instruction.strip()}\n\n"
            "Markdown note:\n"
            "```markdown\n"
            f"{markdown_content}\n"
            "```"
        )
        response = model.create_completion(prompt=prompt, max_tokens=2048, temperature=0.2)
        choices = response.get("choices", [])
        if not choices:
            raise RuntimeError("Lokales LLM hat keine Antwort geliefert.")
        text = choices[0].get("text", "")
        if not text.strip():
            raise RuntimeError("Lokales LLM hat leeren Inhalt geliefert.")
        return text.strip()
