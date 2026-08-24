#!/usr/bin/env python3
"""Chunk portfolio knowledge, embed with Gemini, and upsert into Supabase."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests
from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "knowledge"
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768


def chunk_markdown(text: str, source: str) -> list[dict]:
    """Split markdown by ## headings into chunks with metadata."""
    sections = re.split(r"(?=^## .+$)", text, flags=re.MULTILINE)
    chunks: list[dict] = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        lines = section.splitlines()
        heading = lines[0].lstrip("# ").strip() if lines else source
        anchor_map = {
            "Overview": "#top",
            "About": "#about",
            "Experience": "#experience",
            "Education": "#education",
            "Research": "#publications",
            "Contact": "#contact",
        }
        url_anchor = anchor_map.get(heading.split("—")[0].strip(), "#top")

        chunks.append(
            {
                "content": section,
                "metadata": {
                    "section": heading,
                    "source": source,
                    "url_anchor": url_anchor,
                },
            }
        )

    return chunks


def embed_text(client: genai.Client, text: str) -> list[float]:
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    values = response.embeddings[0].values
    if len(values) != EMBEDDING_DIM:
        raise ValueError(f"Expected {EMBEDDING_DIM} dimensions, got {len(values)}")
    return values


def clear_documents(supabase_url: str, service_key: str) -> None:
    response = requests.delete(
        f"{supabase_url}/rest/v1/documents?id=gte.0",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Prefer": "return=minimal",
        },
        timeout=30,
    )
    if response.status_code not in (200, 204):
        raise RuntimeError(f"Failed to clear documents: {response.status_code} {response.text}")


def upsert_document(
    supabase_url: str,
    service_key: str,
    content: str,
    metadata: dict,
    embedding: list[float],
) -> None:
    payload = {
        "content": content,
        "metadata": metadata,
        "embedding": embedding,
    }
    response = requests.post(
        f"{supabase_url}/rest/v1/documents",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=30,
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to upsert document: {response.status_code} {response.text}")


def load_knowledge() -> list[dict]:
    if not KNOWLEDGE_DIR.exists():
        raise FileNotFoundError(f"Knowledge directory not found: {KNOWLEDGE_DIR}")

    all_chunks: list[dict] = []
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        all_chunks.extend(chunk_markdown(text, path.name))
    return all_chunks


def main() -> None:
    gemini_key = os.environ.get("GEMINI_API_KEY")
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    missing = [
        name
        for name, value in [
            ("GEMINI_API_KEY", gemini_key),
            ("SUPABASE_URL", supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", service_key),
        ]
        if not value
    ]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=gemini_key)
    chunks = load_knowledge()
    print(f"Loaded {len(chunks)} chunks from {KNOWLEDGE_DIR}")

    clear_documents(supabase_url, service_key)
    print("Cleared existing documents")

    for index, chunk in enumerate(chunks, start=1):
        embedding = embed_text(client, chunk["content"])
        upsert_document(
            supabase_url,
            service_key,
            chunk["content"],
            chunk["metadata"],
            embedding,
        )
        print(f"Indexed {index}/{len(chunks)}: {chunk['metadata']['section']}")

    print("Indexing complete.")


if __name__ == "__main__":
    main()
