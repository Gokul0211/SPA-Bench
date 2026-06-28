#!/usr/bin/env python3
"""
SPABench manifest builder.

Assembles the master manifest.json from the individual app manifest-partial.json
fragments in apps/*/manifest-partial.json, combined with the app metadata defined
in this script.

Usage:
    python build_manifest.py
    python build_manifest.py --dry-run   # print output without writing
    python build_manifest.py --validate  # run validate_manifest.py after building
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

APPS_DIR     = Path(__file__).parent / "apps"
MANIFEST_OUT = Path(__file__).parent / "manifest.json"

# ---------------------------------------------------------------------------
# App metadata (stable, manually maintained)
# ---------------------------------------------------------------------------
APP_METADATA = [
    {
        "id": "angular-permit",
        "name": "App A — Angular Permit-to-Work SPA",
        "framework": "angular",
        "framework_version": "8.0.0",
        "build_tool": "angular-cli-webpack",
        "port": 3001,
        "base_url": "http://localhost:3001",
        "source_maps_exposed": True,
        "source_map_count": 26,
        "auth_required": True,
        "auth_method": "form",
        "description": (
            "Tests inter-procedural variable resolution, source map decompilation, "
            "and sub-application federation in Angular 8 with aggressive variable renaming."
        ),
        "primary_challenges": [
            "constructor_injection_depth",
            "sub_app_discovery",
            "source_map_decompilation",
            "obfuscated_variable_renaming",
        ],
        "target_endpoint_count": 421,
        "sub_applications": [
            "permit-core",
            "permit-admin",
            "permit-reports",
            "permit-mobile",
        ],
    },
    {
        "id": "angular-erp",
        "name": "App B — Angular ERP (Module Federation)",
        "framework": "angular",
        "framework_version": "17.0.0",
        "build_tool": "webpack5-module-federation",
        "port": 3002,
        "base_url": "http://localhost:3002",
        "source_maps_exposed": True,
        "source_map_count": 4,
        "auth_required": True,
        "auth_method": "bearer",
        "description": (
            "Tests Module Federation micro-frontend discovery, OData patterns, "
            "Webpack module registry harvest, and unnavigated module enumeration at enterprise scale."
        ),
        "primary_challenges": [
            "module_federation_discovery",
            "unnavigated_module_harvest",
            "odata_patterns",
            "inter_procedural_resolution",
        ],
        "target_endpoint_count": 538,
        "sub_applications": [
            "mfe-inventory", "mfe-orders", "mfe-users", "mfe-reports",
            "mfe-finance", "mfe-hr", "mfe-crm", "mfe-analytics",
            "mfe-purchasing", "mfe-warehouse", "mfe-logistics", "mfe-quality",
            "mfe-maintenance", "mfe-assets", "mfe-compliance", "mfe-projects",
            "mfe-budgeting", "mfe-contracts", "mfe-vendors", "mfe-customers",
            "mfe-support", "mfe-notifications", "mfe-settings", "mfe-admin",
        ],
    },
    {
        "id": "react-ecommerce",
        "name": "App C — React E-Commerce (Vite)",
        "framework": "react",
        "framework_version": "18.0.0",
        "build_tool": "vite",
        "port": 3003,
        "base_url": "http://localhost:3003",
        "source_maps_exposed": True,
        "source_map_count": 31,
        "auth_required": True,
        "auth_method": "bearer",
        "description": (
            "Tests JSX source map decompilation, native Fetch API and Axios patterns, "
            "React component route naming as a false positive source, and checkout micro-app isolation."
        ),
        "primary_challenges": [
            "jsx_source_maps",
            "axios_wrapper_patterns",
            "checkout_microapp_isolation",
            "react_component_fp_suppression",
        ],
        "target_endpoint_count": 538,
        "sub_applications": [
            "checkout-flow",
            "product-catalog",
            "user-account",
        ],
    },
    {
        "id": "vue-portal",
        "name": "App D — Vue Government Portal (No Source Maps)",
        "framework": "vue",
        "framework_version": "3.0.0",
        "build_tool": "nuxt",
        "port": 3004,
        "base_url": "http://localhost:3004",
        "source_maps_exposed": False,
        "source_map_count": 2,
        "auth_required": True,
        "auth_method": "form",
        "description": (
            "Tests tool performance when source maps are intentionally restricted. "
            "Validates AST variable resolution and dynamic interception operate independently. "
            "Includes SOAP-bridged legacy endpoints."
        ),
        "primary_challenges": [
            "source_map_absence",
            "soap_bridge_discovery",
            "vue_composition_api_patterns",
            "graceful_degradation",
        ],
        "target_endpoint_count": 284,
        "sub_applications": [],
    },
    {
        "id": "nextjs-saas",
        "name": "App E — Next.js SaaS Dashboard (GraphQL + WebSocket)",
        "framework": "nextjs",
        "framework_version": "14.0.0",
        "build_tool": "nextjs-compiler",
        "port": 3005,
        "base_url": "http://localhost:3005",
        "source_maps_exposed": True,
        "source_map_count": 41,
        "auth_required": True,
        "auth_method": "totp",
        "description": (
            "Tests GraphQL schema introspection, Next.js API route definitions, "
            "dynamic route segments, and WebSocket endpoint discovery. "
            "Vercel-style deployment exposes source maps by default."
        ),
        "primary_challenges": [
            "graphql_introspection",
            "dynamic_route_segments",
            "websocket_discovery",
            "nextjs_api_routes",
        ],
        "target_endpoint_count": 612,
        "sub_applications": [],
    },
]


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
def load_partial(app_id: str) -> list[dict]:
    """Load endpoints from apps/<app_id>/manifest-partial.json."""
    partial_path = APPS_DIR / app_id / "manifest-partial.json"
    if not partial_path.exists():
        print(f"  ⚠  No manifest-partial.json found for '{app_id}' — using empty endpoint list")
        return []
    with partial_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("endpoints", [])


def build_manifest() -> dict:
    """Assemble the master manifest from app metadata + partial fragments."""
    apps = []
    total_endpoints = 0

    for meta in APP_METADATA:
        app_id    = meta["id"]
        endpoints = load_partial(app_id)
        total_endpoints += len(endpoints)

        app_entry = {**meta, "endpoints": endpoints}
        apps.append(app_entry)
        print(f"  ✓ {app_id}: {len(endpoints)} endpoint(s)")

    manifest = {
        "version": "1.0.0",
        "generated": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "apps": apps,
    }

    print(f"\n  Total: {len(apps)} apps, {total_endpoints} endpoints")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Assemble master manifest.json from app partial fragments"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print assembled manifest without writing to disk",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run validate_manifest.py after building",
    )
    parser.add_argument(
        "--output",
        default=str(MANIFEST_OUT),
        help=f"Output path (default: {MANIFEST_OUT})",
    )
    args = parser.parse_args()

    print("SPABench manifest builder")
    print(f"  Apps directory : {APPS_DIR}")
    print(f"  Output         : {args.output}\n")

    manifest = build_manifest()

    if args.dry_run:
        print("\n── Dry run output ──────────────────────────────────────────────")
        print(json.dumps(manifest, indent=2))
        return 0

    out_path = Path(args.output)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print(f"\n✓ Written to {out_path}")

    if args.validate:
        print("\nRunning validation…\n")
        result = subprocess.run(
            [sys.executable, "validate_manifest.py", "--manifest", str(out_path), "--verbose"],
            cwd=Path(__file__).parent,
        )
        return result.returncode

    return 0


if __name__ == "__main__":
    sys.exit(main())
