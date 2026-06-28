#!/usr/bin/env python3
"""
SPABench manifest validation script.

Validates manifest.json against manifest.schema.json and performs
additional semantic checks that JSON Schema alone cannot express.

Usage:
    python validate_manifest.py
    python validate_manifest.py --manifest path/to/manifest.json
    python validate_manifest.py --verbose
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Optional jsonschema import — gracefully degrade if not installed
# ---------------------------------------------------------------------------
try:
    import jsonschema
    from jsonschema import validate, ValidationError, Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

# ---------------------------------------------------------------------------
# Colour helpers (no external dependencies)
# ---------------------------------------------------------------------------
def _green(s: str) -> str:  return f"\033[32m{s}\033[0m"
def _red(s: str) -> str:    return f"\033[31m{s}\033[0m"
def _yellow(s: str) -> str: return f"\033[33m{s}\033[0m"
def _bold(s: str) -> str:   return f"\033[1m{s}\033[0m"


# ---------------------------------------------------------------------------
# Valid technique vocabulary (mirrors manifest.schema.json enum)
# ---------------------------------------------------------------------------
VALID_TECHNIQUES = {
    # Phase 1
    "script_tag_standard", "html_attr_onclick", "html_attr_ng_include",
    "html_attr_formaction", "link_preload", "link_modulepreload",
    "dynamic_import_inline", "web_worker_constructor", "noscript_tag",
    "commented_script", "module_federation_remote_entry",
    "module_federation_html_parse",
    # Phase 1.5
    "sourcemap_probe_standard", "sourcemap_url_directive",
    "ts_service_file_recovery", "environment_ts_recovery",
    "jsx_source_recovery", "sourcemap_restricted",
    "backend_sourcemap_recovery", "auth_service_recovery",
    # Phase 2
    "url_concat_direct", "url_template_literal", "url_variable_based",
    "url_object_property_chain", "url_service_method_delegation",
    "url_array_assembly", "url_conditional_feature_flag",
    "inter_proc_constructor_single", "inter_proc_constructor_multi",
    "inter_proc_factory_return", "obfuscated_string_array",
    "inter_proc_cycle_detection", "httpclient_get", "httpclient_post",
    "httpclient_put", "httpclient_patch", "httpclient_delete",
    "httpclient_request_generic", "fetch_api_native", "axios_wrapper",
    "vue_composition_axios", "react_useeffect_fetch",
    "param_ts_interface", "param_generic_type_annotation",
    "param_httpparams_chain", "param_urlsearchparams", "param_formgroup",
    "param_backward_taint", "inter_proc_constructor_injection",
    # Phase 3
    "xhr_interception", "fetch_interception",
    "webpack_registry_unnavigated", "dynamic_button_click",
    "dynamic_menu_expand", "dynamic_form_submit", "dynamic_hover",
    "lazy_loaded_chunk", "dynamic_worker_blob",
    "federation_runtime_manifest", "websocket_connection_url",
    "websocket_payload_sample", "websocket_static",
    # Phase 4
    "graphql_endpoint_heuristic", "graphql_introspection",
    "graphql_query_resolver", "graphql_mutation_resolver",
    "graphql_subscription_resolver", "graphql_introspection_disabled",
    "openapi_discovery", "openapi_path_enumeration",
    "spring_actuator_mappings", "indexeddb_api_cache",
    "indexeddb_config", "indexeddb_session",
    "backend_sourcemap_server_routes", "soap_bridge_dynamic",
    # Noise (for FP validation entries)
    "noise_momentjs", "noise_exceljs", "noise_angular_compiler",
    "noise_pdfjs", "noise_nodejs_streams",
    "noise_template_literal_artifacts", "noise_react_component_names",
    "noise_router_navigation",
    # Auth
    "auth_form_login", "auth_browser_driven", "auth_totp_mfa",
    "auth_bearer_injection", "auth_gated_endpoint",
}

# Phase ↔ technique compatibility: which techniques are valid for each phase
PHASE_TECHNIQUE_MAP = {
    "1":   {
        "script_tag_standard", "html_attr_onclick", "html_attr_ng_include",
        "html_attr_formaction", "link_preload", "link_modulepreload",
        "dynamic_import_inline", "web_worker_constructor", "noscript_tag",
        "commented_script", "module_federation_remote_entry",
        "module_federation_html_parse",
    },
    "1.5": {
        "sourcemap_probe_standard", "sourcemap_url_directive",
        "ts_service_file_recovery", "environment_ts_recovery",
        "jsx_source_recovery", "sourcemap_restricted",
        "backend_sourcemap_recovery", "auth_service_recovery",
    },
    "2":   {
        "url_concat_direct", "url_template_literal", "url_variable_based",
        "url_object_property_chain", "url_service_method_delegation",
        "url_array_assembly", "url_conditional_feature_flag",
        "inter_proc_constructor_single", "inter_proc_constructor_multi",
        "inter_proc_factory_return", "obfuscated_string_array",
        "inter_proc_cycle_detection", "httpclient_get", "httpclient_post",
        "httpclient_put", "httpclient_patch", "httpclient_delete",
        "httpclient_request_generic", "fetch_api_native", "axios_wrapper",
        "vue_composition_axios", "react_useeffect_fetch",
        "param_ts_interface", "param_generic_type_annotation",
        "param_httpparams_chain", "param_urlsearchparams", "param_formgroup",
        "param_backward_taint", "inter_proc_constructor_injection",
        "websocket_static",
    },
    "3":   {
        "xhr_interception", "fetch_interception",
        "webpack_registry_unnavigated", "dynamic_button_click",
        "dynamic_menu_expand", "dynamic_form_submit", "dynamic_hover",
        "lazy_loaded_chunk", "dynamic_worker_blob",
        "federation_runtime_manifest", "websocket_connection_url",
        "websocket_payload_sample",
        "soap_bridge_dynamic",
    },
    "4":   {
        "graphql_endpoint_heuristic", "graphql_introspection",
        "graphql_query_resolver", "graphql_mutation_resolver",
        "graphql_subscription_resolver", "graphql_introspection_disabled",
        "openapi_discovery", "openapi_path_enumeration",
        "spring_actuator_mappings", "indexeddb_api_cache",
        "indexeddb_config", "indexeddb_session",
        "backend_sourcemap_server_routes",
    },
}

# WS / GRAPHQL method expectations
WS_METHODS     = {"WS"}
GQL_METHODS    = {"GRAPHQL"}
HTTP_METHODS   = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
VALID_METHODS  = HTTP_METHODS | WS_METHODS | GQL_METHODS

VALID_FRAMEWORKS   = {"angular", "react", "vue", "nextjs"}
VALID_TIERS        = {"VERIFIED_API", "BACKEND_API", "LOW_CONFIDENCE"}
VALID_AUTH_METHODS = {"none", "form", "bearer", "totp", "browser_login"}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
class ValidationResult:
    def __init__(self) -> None:
        self.errors:   list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# Semantic checks
# ---------------------------------------------------------------------------
def check_unique_endpoint_ids(manifest: dict, result: ValidationResult) -> None:
    """All endpoint IDs across all apps must be globally unique."""
    seen: dict[str, str] = {}  # id → app_id
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid = ep.get("id", "")
            if eid in seen:
                result.error(
                    f"Duplicate endpoint ID '{eid}' found in app "
                    f"'{app.get('id')}' and previously in '{seen[eid]}'"
                )
            else:
                seen[eid] = app.get("id", "?")


def check_unique_app_ids(manifest: dict, result: ValidationResult) -> None:
    """App IDs must be unique."""
    seen: set[str] = set()
    for app in manifest.get("apps", []):
        aid = app.get("id", "")
        if aid in seen:
            result.error(f"Duplicate app ID '{aid}'")
        seen.add(aid)


def check_phase_technique_compatibility(
    manifest: dict, result: ValidationResult
) -> None:
    """Each endpoint's technique must be valid for its declared phase."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            phase     = ep.get("phase", "")
            technique = ep.get("technique", "")
            eid       = ep.get("id", "?")
            allowed   = PHASE_TECHNIQUE_MAP.get(phase, set())
            if technique and allowed and technique not in allowed:
                result.error(
                    f"[{eid}] technique '{technique}' is not valid for phase {phase}. "
                    f"Allowed techniques for phase {phase}: {sorted(allowed)}"
                )


def check_exclusive_redundant_consistency(
    manifest: dict, result: ValidationResult
) -> None:
    """If exclusive=true, redundant_techniques must be empty. If false, it should be non-empty."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid       = ep.get("id", "?")
            exclusive = ep.get("exclusive", None)
            redundant = ep.get("redundant_techniques", [])
            if exclusive is True and redundant:
                result.error(
                    f"[{eid}] exclusive=true but redundant_techniques is non-empty: {redundant}"
                )
            if exclusive is False and not redundant:
                result.warn(
                    f"[{eid}] exclusive=false but redundant_techniques is empty — "
                    "consider declaring which other techniques can find this endpoint"
                )


def check_auth_consistency(
    manifest: dict, result: ValidationResult
) -> None:
    """If auth_required=false, auth_method must be 'none'."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid          = ep.get("id", "?")
            auth_req     = ep.get("auth_required", None)
            auth_method  = ep.get("auth_method", "")
            if auth_req is False and auth_method not in ("none", None):
                result.error(
                    f"[{eid}] auth_required=false but auth_method='{auth_method}' "
                    "(expected 'none')"
                )
            if auth_req is True and auth_method in ("none", None):
                result.error(
                    f"[{eid}] auth_required=true but auth_method is 'none' or missing"
                )


def check_security_finding_consistency(
    manifest: dict, result: ValidationResult
) -> None:
    """If security_relevant=true, security_finding_type must not be 'none'."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid      = ep.get("id", "?")
            sec_rel  = ep.get("security_relevant", False)
            sec_type = ep.get("security_finding_type", "none")
            if sec_rel is True and sec_type in ("none", None):
                result.error(
                    f"[{eid}] security_relevant=true but security_finding_type is 'none' or missing"
                )
            if sec_rel is False and sec_type not in ("none", None):
                result.warn(
                    f"[{eid}] security_relevant=false but security_finding_type='{sec_type}' — "
                    "consider setting security_relevant=true"
                )


def check_ws_url_scheme(manifest: dict, result: ValidationResult) -> None:
    """WebSocket endpoints (method=WS) must use ws:// or wss:// URLs."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid    = ep.get("id", "?")
            method = ep.get("method", "")
            url    = ep.get("url", "")
            if method == "WS" and not url.startswith(("ws://", "wss://")):
                result.error(
                    f"[{eid}] method=WS but URL does not start with ws:// or wss://: '{url}'"
                )
            if method in HTTP_METHODS and url.startswith(("ws://", "wss://")):
                result.error(
                    f"[{eid}] method={method} but URL uses WebSocket scheme: '{url}'"
                )


def check_technique_vocabulary(manifest: dict, result: ValidationResult) -> None:
    """All technique values must come from the controlled vocabulary."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid       = ep.get("id", "?")
            technique = ep.get("technique", "")
            if technique and technique not in VALID_TECHNIQUES:
                result.error(
                    f"[{eid}] Unknown technique '{technique}'. "
                    "Add it to TECHNIQUE_REFERENCE.md and manifest.schema.json before using it."
                )


def check_id_format(manifest: dict, result: ValidationResult) -> None:
    """Endpoint IDs should follow EP-{APPCODE}-{NUMBER} or EP-{APPCODE}-{TYPE}-{NUMBER}."""
    import re
    pattern = re.compile(r"^EP-[A-Z](-[A-Z]+)?-\d{3}$")
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid = ep.get("id", "")
            if not pattern.match(eid):
                result.warn(
                    f"Endpoint ID '{eid}' does not match expected format "
                    "EP-{{APPCODE}}-{{NUMBER}} or EP-{{APPCODE}}-{{TYPE}}-{{NUMBER}} "
                    "(e.g. EP-A-001 or EP-E-GQL-001)"
                )


def check_source_map_count_consistency(
    manifest: dict, result: ValidationResult
) -> None:
    """If source_maps_exposed=false, source_map_count should be 0 (warn if non-zero)."""
    for app in manifest.get("apps", []):
        exposed = app.get("source_maps_exposed", True)
        count   = app.get("source_map_count", None)
        aid     = app.get("id", "?")
        if exposed is False and count and count > 2:
            result.warn(
                f"App '{aid}': source_maps_exposed=false but source_map_count={count}. "
                "App D intentionally limits to 2 — verify this is intentional."
            )


def check_graphql_endpoint_method(
    manifest: dict, result: ValidationResult
) -> None:
    """GraphQL resolver entries should use method=GRAPHQL."""
    graphql_techniques = {
        "graphql_query_resolver", "graphql_mutation_resolver",
        "graphql_subscription_resolver",
    }
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid       = ep.get("id", "?")
            technique = ep.get("technique", "")
            method    = ep.get("method", "")
            if technique in graphql_techniques and method != "GRAPHQL":
                result.warn(
                    f"[{eid}] uses a GraphQL resolver technique but method='{method}' "
                    "(expected GRAPHQL)"
                )


def check_soap_bridge_phase(manifest: dict, result: ValidationResult) -> None:
    """SOAP bridge endpoints must be phase 3 (dynamic interception only)."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid       = ep.get("id", "?")
            technique = ep.get("technique", "")
            phase     = ep.get("phase", "")
            if technique == "soap_bridge_dynamic" and phase != "3":
                result.error(
                    f"[{eid}] soap_bridge_dynamic endpoints must be phase 3, got phase {phase}"
                )


def check_discovery_notes_present(
    manifest: dict, result: ValidationResult
) -> None:
    """Every endpoint must have a non-empty discovery_notes string."""
    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            eid   = ep.get("id", "?")
            notes = ep.get("discovery_notes", "").strip()
            if not notes:
                result.error(f"[{eid}] discovery_notes is missing or empty")


# ---------------------------------------------------------------------------
# Summary statistics
# ---------------------------------------------------------------------------
def print_statistics(manifest: dict) -> None:
    total_apps      = len(manifest.get("apps", []))
    total_endpoints = sum(len(a.get("endpoints", [])) for a in manifest["apps"])
    phase_counts: dict[str, int] = {}
    tech_counts:  dict[str, int] = {}
    exclusive_count = 0
    auth_gated      = 0
    security_count  = 0

    for app in manifest.get("apps", []):
        for ep in app.get("endpoints", []):
            p = ep.get("phase", "?")
            t = ep.get("technique", "?")
            phase_counts[p] = phase_counts.get(p, 0) + 1
            tech_counts[t]  = tech_counts.get(t, 0)  + 1
            if ep.get("exclusive"): exclusive_count += 1
            if ep.get("auth_required"): auth_gated += 1
            if ep.get("security_relevant"): security_count += 1

    print(_bold("\n── Manifest Statistics ────────────────────────────────────────"))
    print(f"  Apps:               {total_apps}")
    print(f"  Total endpoints:    {total_endpoints}")
    print(f"  Exclusive:          {exclusive_count}  ({exclusive_count/max(total_endpoints,1)*100:.1f}%)")
    print(f"  Auth-gated:         {auth_gated}")
    print(f"  Security-relevant:  {security_count}")
    print(_bold("\n  Endpoints by phase:"))
    for phase in sorted(phase_counts):
        print(f"    Phase {phase}: {phase_counts[phase]}")
    print(_bold("\n  Top techniques:"))
    for t, c in sorted(tech_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {t:<45} {c}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the SPABench manifest against its schema and semantic rules"
    )
    parser.add_argument(
        "--manifest",
        default="manifest.json",
        help="Path to manifest JSON file (default: manifest.json)",
    )
    parser.add_argument(
        "--schema",
        default="manifest.schema.json",
        help="Path to JSON Schema file (default: manifest.schema.json)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print per-check progress and manifest statistics",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    schema_path   = Path(args.schema)

    # ── Load files ──────────────────────────────────────────────────────────
    if not manifest_path.exists():
        print(_red(f"✗ Manifest file not found: {manifest_path}"))
        return 1
    if not schema_path.exists():
        print(_red(f"✗ Schema file not found: {schema_path}"))
        return 1

    manifest = _load_json(manifest_path)
    schema   = _load_json(schema_path)

    print(_bold(f"\nSPABench Manifest Validator"))
    print(f"  Manifest : {manifest_path}")
    print(f"  Schema   : {schema_path}")
    print(f"  Version  : {manifest.get('version', '?')}")
    print(f"  Generated: {manifest.get('generated', '?')}")

    result = ValidationResult()

    # ── Step 1: JSON Schema validation ──────────────────────────────────────
    if HAS_JSONSCHEMA:
        if args.verbose:
            print(_bold("\n── Step 1: JSON Schema validation ─────────────────────────────"))
        validator = Draft7Validator(schema)
        schema_errors = list(validator.iter_errors(manifest))
        if schema_errors:
            for err in schema_errors:
                path_str = " → ".join(str(p) for p in err.absolute_path) or "(root)"
                result.error(f"Schema: [{path_str}] {err.message}")
            if args.verbose:
                print(_red(f"  ✗ {len(schema_errors)} schema error(s) found"))
        else:
            if args.verbose:
                print(_green("  ✓ JSON Schema valid"))
    else:
        result.warn(
            "jsonschema library not installed — skipping JSON Schema validation. "
            "Install with: pip install jsonschema --break-system-packages"
        )

    # ── Step 2: Semantic checks ──────────────────────────────────────────────
    semantic_checks = [
        ("Unique app IDs",                check_unique_app_ids),
        ("Unique endpoint IDs",           check_unique_endpoint_ids),
        ("Phase↔technique compatibility", check_phase_technique_compatibility),
        ("Technique vocabulary",          check_technique_vocabulary),
        ("Exclusive/redundant consistency", check_exclusive_redundant_consistency),
        ("Auth field consistency",        check_auth_consistency),
        ("Security finding consistency",  check_security_finding_consistency),
        ("WebSocket URL scheme",          check_ws_url_scheme),
        ("ID format",                     check_id_format),
        ("Source map count",              check_source_map_count_consistency),
        ("GraphQL method",                check_graphql_endpoint_method),
        ("SOAP bridge phase",             check_soap_bridge_phase),
        ("Discovery notes present",       check_discovery_notes_present),
    ]

    if args.verbose:
        print(_bold("\n── Step 2: Semantic validation ─────────────────────────────────"))

    pre_error_count = len(result.errors)
    for label, check_fn in semantic_checks:
        errors_before = len(result.errors)
        check_fn(manifest, result)
        errors_after = len(result.errors)
        if args.verbose:
            if errors_after > errors_before:
                print(_red(f"  ✗ {label}"))
            else:
                print(_green(f"  ✓ {label}"))

    # ── Step 3: Report ───────────────────────────────────────────────────────
    if args.verbose:
        print_statistics(manifest)

    print(_bold("\n── Results ─────────────────────────────────────────────────────"))
    if result.warnings:
        print(_yellow(f"  Warnings ({len(result.warnings)}):"))
        for w in result.warnings:
            print(_yellow(f"    ⚠  {w}"))

    if result.errors:
        print(_red(f"\n  Errors ({len(result.errors)}):"))
        for e in result.errors:
            print(_red(f"    ✗  {e}"))
        print(_red(f"\n✗ Validation FAILED — {len(result.errors)} error(s)\n"))
        return 1
    else:
        print(_green(f"\n✓ Validation PASSED"))
        if result.warnings:
            print(_yellow(f"  ({len(result.warnings)} warning(s) — not blocking)\n"))
        else:
            print()
        return 0


if __name__ == "__main__":
    sys.exit(main())
