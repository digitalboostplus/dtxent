"""
js_parser.py — Shared utility to parse JavaScript data files into Python dicts.

Handles the conversion from JS object syntax (unquoted keys, trailing commas)
to valid JSON that can be parsed by Python's json module.

Used by both generate_social_post.py and research_venues.py.
"""

import json
import re
from pathlib import Path


def extract_js_array(content: str, variable_name: str) -> list[dict]:
    """
    Extract a JavaScript array variable from source code and parse it as JSON.

    Handles:
    - Unquoted object keys (artistName → "artistName")
    - Trailing commas
    - Strings containing colons (e.g., URLs like https://...)
    - Special characters in values (&, accented chars, etc.)

    Args:
        content: The full JavaScript source code string.
        variable_name: The name of the exported const (e.g., "LOCAL_EVENTS").

    Returns:
        A list of dictionaries parsed from the JS array.
    """
    # Find the array declaration
    pattern = rf"export\s+const\s+{re.escape(variable_name)}\s*=\s*\["
    match = re.search(pattern, content)
    if not match:
        return []

    # Find the matching closing bracket using bracket counting
    start = match.start()
    bracket_count = 0
    array_start = None
    array_end = None

    for i in range(start, len(content)):
        if content[i] == "[":
            if array_start is None:
                array_start = i
            bracket_count += 1
        elif content[i] == "]":
            bracket_count -= 1
            if bracket_count == 0:
                array_end = i + 1
                break

    if array_start is None or array_end is None:
        return []

    raw_array = content[array_start:array_end]

    # Convert JS → JSON using a token-aware approach
    json_str = _js_to_json(raw_array)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse {variable_name} as JSON: {e}")
        # Debug: show the area around the error
        line = e.lineno
        col = e.colno
        lines = json_str.split("\n")
        if 0 < line <= len(lines):
            context_start = max(0, line - 3)
            context_end = min(len(lines), line + 2)
            print(f"  Context around line {line}, col {col}:")
            for ln in range(context_start, context_end):
                marker = " >>>" if ln == line - 1 else "    "
                print(f"{marker} {ln + 1}: {lines[ln][:120]}")
        return []


def _js_to_json(js_str: str) -> str:
    """
    Convert a JavaScript array/object literal string to valid JSON.

    Strategy: Process character by character, tracking whether we're inside
    a string or not. Only quote unquoted keys when we're NOT inside a string.
    """
    result = []
    i = 0
    length = len(js_str)
    in_string = False
    string_char = None

    while i < length:
        ch = js_str[i]

        # Handle string boundaries
        if in_string:
            result.append(ch)
            if ch == "\\" and i + 1 < length:
                # Escaped character — skip next char
                i += 1
                result.append(js_str[i])
            elif ch == string_char:
                in_string = False
                string_char = None
            i += 1
            continue

        # Not in a string
        if ch in ('"', "'"):
            in_string = True
            string_char = ch
            # Normalize single quotes to double quotes for JSON
            result.append('"')
            i += 1
            continue

        # Check for unquoted key: a word followed by a colon
        if ch.isalpha() or ch == "_":
            # Capture the full identifier
            key_start = i
            while i < length and (js_str[i].isalnum() or js_str[i] == "_"):
                i += 1
            key = js_str[key_start:i]

            # Skip whitespace to see if followed by colon
            j = i
            while j < length and js_str[j] in (" ", "\t", "\r", "\n"):
                j += 1

            if j < length and js_str[j] == ":":
                # It's a key — quote it
                result.append(f'"{key}"')
            else:
                # It's a bare value like true/false/null — keep as-is
                result.append(key)
            continue

        # Handle trailing commas: comma followed by ] or }
        if ch == ",":
            # Look ahead for closing bracket/brace (skipping whitespace)
            j = i + 1
            while j < length and js_str[j] in (" ", "\t", "\r", "\n"):
                j += 1
            if j < length and js_str[j] in ("]", "}"):
                # Skip the trailing comma
                i += 1
                continue

        result.append(ch)
        i += 1

    return "".join(result)


def load_events_data(filepath: Path) -> dict:
    """
    Load all data arrays from an events-data.js file.

    Returns a dict with keys: 'events', 'clubs', 'restaurants', 'hotels'.
    """
    content = filepath.read_text(encoding="utf-8")
    return {
        "events": extract_js_array(content, "LOCAL_EVENTS"),
        "clubs": extract_js_array(content, "LOCAL_CLUBS"),
        "restaurants": extract_js_array(content, "LOCAL_RESTAURANTS"),
        "hotels": extract_js_array(content, "LOCAL_HOTELS"),
    }
