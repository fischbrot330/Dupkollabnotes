from __future__ import annotations

from pathlib import Path
import re


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
                "Lokales LLM nicht verfügbar. Bitte 'llama-cpp-python' installieren "
                "und EXE neu bauen. "
                f"Technischer Fehler beim Import: {exc}"
            ) from exc
        try:
            model = Llama(model_path=str(model_path), n_ctx=4096, verbose=False)
        except OSError as exc:
            raise RuntimeError(
                "Lokales LLM konnte nicht initialisiert werden. "
                "Bitte CPU-kompatiblen Wheel/Build nutzen und Modellpfad prüfen. "
                f"Technischer Fehler: {exc}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Lokales LLM konnte nicht geladen werden: {exc}") from exc
        self._cached_model_path = model_path
        self._cached_model = model
        return model

    def process_markdown(self, *, model_path: str, instruction: str, markdown_content: str) -> str:
        resolved_model_path = Path(model_path).expanduser().resolve()
        if not resolved_model_path.exists():
            raise RuntimeError(f"GGUF-Modell nicht gefunden: {resolved_model_path}")
        model = self._get_model(resolved_model_path)
        max_tokens = max(128, min(768, len(markdown_content) // 2 + 128))
        prompt = (
            "You are a markdown rewriting engine.\n"
            "Follow the instruction exactly.\n"
            "Do not add new facts.\n"
            "Do not explain your work.\n"
            "Do not add introductions, summaries, notes, or commentary.\n"
            "Do not wrap the answer in code fences unless the source note itself requires them.\n"
            "Return only the final markdown content.\n\n"
            f"Instruction:\n{instruction.strip()}\n\n"
            "Markdown note:\n"
            "```markdown\n"
            f"{markdown_content}\n"
            "```\n\n"
            "Final markdown output:\n"
        )
        try:
            response = model.create_completion(
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=0.0,
                top_p=0.9,
                stop=["\n\nInstruction:", "\n\nMarkdown note:", "\n\nFinal markdown output:"],
            )
        except OSError as exc:
            raise RuntimeError(
                "Lokales LLM ist beim Ausführen fehlgeschlagen. "
                "Das deutet meist auf ein inkompatibles Laufzeit-Binary oder CPU-Features hin. "
                f"Technischer Fehler: {exc}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"Lokales LLM-Ausführung fehlgeschlagen: {exc}") from exc
        choices = response.get("choices", [])
        if not choices:
            raise RuntimeError("Lokales LLM hat keine Antwort geliefert.")
        text = choices[0].get("text", "")
        cleaned_text = self._normalize_output(text)
        if not cleaned_text.strip():
            raise RuntimeError("Lokales LLM hat leeren Inhalt geliefert.")
        return cleaned_text

    def _normalize_output(self, text: str) -> str:
        cleaned = text.strip()

        fenced_match = re.fullmatch(r"```(?:markdown)?\s*(.*?)\s*```", cleaned, flags=re.DOTALL | re.IGNORECASE)
        if fenced_match:
            cleaned = fenced_match.group(1).strip()

        cleaned = re.sub(
            r"^(Here is the translated markdown:|Here is the improved markdown:|Translated markdown:|Improved markdown:|Solution:|Output:|Result:)\s*",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()

        cleaned = re.sub(r"^```(?:markdown)?\s*", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.IGNORECASE).strip()

        # Some models append a second answer block introduced by labels like
        # "Solution:". Keep only the first output block for preview.
        split_pattern = re.compile(r"\n\s*(Solution|Output|Result)\s*:\s*\n", flags=re.IGNORECASE)
        parts = split_pattern.split(cleaned, maxsplit=1)
        if len(parts) > 1 and parts[0].strip():
            cleaned = parts[0].strip()

        return cleaned
