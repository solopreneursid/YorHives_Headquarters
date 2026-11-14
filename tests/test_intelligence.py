#!/usr/bin/env python3
"""Offline contract tests for automatic tool detection and safe monitoring.

Run from the repository root:
     python3 tests/test_intelligence.py
No network, website changes, or external dependencies.
"""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence"))

from discover import canonical, connect_db, scan, private_storage, is_product
from research import similar, source_score, feed_entries


ORIGIN = "https://yorphives.example"
SITEMAP = lambda paths: ('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        "".join("<url><loc>" + ORIGIN + path + "</loc></url>" for path in paths) + "</urlset>").encode()


def page(title, control):
    return ('<!doctype html><html><head><title>' + title + '</title></head><body>' +
            '<h1>' + title + '</h1><button>' + control + '</button></body></html>').encode()


class FakeFetcher:
    origin = ORIGIN
    def __init__(self):
        self.routes = {}
        self.requests = []

    def get(self, url, preserve_query=False):
        self.requests.append(url)
        if url not in self.routes:
            return 404, b"", "text/html"
        result = self.routes[url]
        if isinstance(result, Exception):
            raise result
        status, body, kind = result
        return status, body, kind

    def serve(self, products, controls=None, unlisted=None):
        """A successful hub and sitemap, with specified product response bodies."""
        controls = controls or {}
        self.routes = {
            ORIGIN + "/sitemap.xml": (200, SITEMAP(products), "application/xml"),
            ORIGIN + "/": (200, b"<html><title>YorpHives</title></html>", "text/html"),
            ORIGIN + "/free-tools": (200, (
                "<html>" + "".join('<a href="' + p + '">Tool</a>' for p in products) + "</html>"
            ).encode(), "text/html")
        }
        for path in products:
            self.routes[ORIGIN + path] = (200, page(path.rsplit("/", 1)[-1], controls.get(path, "Compress")), "text/html")
        for path in (unlisted or []):
            self.routes.pop(ORIGIN + path, None)


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="yorphives-intelligence-")
        self.addCleanup(self.temp.cleanup)
        self.storage = Path(self.temp.name)
        self.fetcher = FakeFetcher()

    def run_scan(self):
        return scan(ORIGIN, self.storage, fetcher=self.fetcher)

    def test_first_successful_scan_establishes_baseline_without_false_launch(self):
        self.fetcher.serve(["/tools/a"])
        report = self.run_scan()
        self.assertEqual(report["verification"]["newlyEnrolled"], 1)
        self.assertEqual(report["verification"]["newEvents"], 0)
        self.assertEqual(len(report["products"]), 1)
        self.assertIn(ORIGIN + "/tools/a", self.fetcher.requests)

    def test_new_product_detected_and_immediately_checked(self):
        self.fetcher.serve(["/tools/a"])
        self.run_scan()
        self.fetcher.serve(["/tools/a", "/tools/b"])
        report = self.run_scan()
        self.assertEqual(report["verification"]["newlyEnrolled"], 1)
        self.assertTrue(any(x["kind"] == "new-product" for x in report["changes"]))
        new_product = [p for p in report["products"] if p["url"].endswith("/b")][0]
        self.assertEqual(new_product["status"], "healthy")
        self.assertEqual(new_product["lastChecked"], report["generatedAt"])
        self.assertEqual(new_product["healthFailStreak"], 0)

    def test_feature_change_does_not_write_website(self):
        self.fetcher.serve(["/tools/a"], controls={"/tools/a": "Compress"})
        self.run_scan()
        self.fetcher.serve(["/tools/a"], controls={"/tools/a": "Compress batch images"})
        report = self.run_scan()
        self.assertTrue(any(x["kind"] == "feature-surface-change" for x in report["changes"]))

    def test_one_missing_cycle_does_not_remove_asset(self):
        self.fetcher.serve(["/tools/a", "/tools/b"])
        self.run_scan()
        self.fetcher.serve(["/tools/a"])
        report = self.run_scan()
        old = [p for p in report["products"] if p["url"].endswith("/b")][0]
        self.assertTrue(old["active"])
        self.assertEqual(old["missingStreak"], 1)
        self.assertFalse(any(x["kind"] == "product-no-longer-discoverable" for x in report["changes"]))

    def test_two_successful_missing_cycles_flag_unlisted_product(self):
        self.fetcher.serve(["/tools/a", "/tools/b"])
        self.run_scan()
        self.fetcher.serve(["/tools/a"])
        self.run_scan()
        report = self.run_scan()
        old = [p for p in report["products"] if p["url"].endswith("/b")][0]
        self.assertFalse(old["active"])
        self.assertTrue(any(x["kind"] == "product-no-longer-discoverable" for x in report["changes"]))

    def test_incomplete_scan_breaks_consecutive_absence(self):
        self.fetcher.serve(["/tools/a", "/tools/b"])
        self.run_scan()
        self.fetcher.serve(["/tools/a"])
        self.run_scan()  # first complete absence of b
        self.fetcher.routes = {}
        self.run_scan()  # incomplete discovery must reset absence sequence
        self.fetcher.serve(["/tools/a"])
        report = self.run_scan()  # first NEW complete absence of b
        old = [p for p in report["products"] if p["url"].endswith("/b")][0]
        self.assertTrue(old["active"])
        self.assertEqual(old["missingStreak"], 1)

    def test_failed_discovery_never_flags_mass_removal(self):
        self.fetcher.serve(["/tools/a", "/tools/b"])
        self.run_scan()
        self.fetcher.routes = {}
        report = self.run_scan()
        self.assertFalse(report["verification"]["complete"])
        self.assertEqual(report["verification"]["newEvents"], 0)
        self.assertTrue(all(p["active"] for p in report["products"]))

    def test_repeated_health_failure_and_recovery(self):
        self.fetcher.serve(["/tools/a"])
        self.run_scan()
        self.fetcher.routes[ORIGIN + "/tools/a"] = (503, b"", "text/html")
        self.run_scan()
        report = self.run_scan()
        self.assertTrue(any(x["kind"] == "repeated-health-failure" for x in report["changes"]))
        self.fetcher.routes[ORIGIN + "/tools/a"] = (200, page("Tool", "Compress"), "text/html")
        report = self.run_scan()
        self.assertTrue(any(x["kind"] == "health-recovered" for x in report["changes"]))

    def test_manifest_discovers_js_only_vanity_route(self):
        self.fetcher.serve(["/tools/a"])
        self.fetcher.routes[ORIGIN + "/.well-known/yorphives-products.json"] = (
            200, json.dumps({"products": [{"url": "/image-resizer", "name": "Image resizer", "features": ["Resize image"]}]}).encode(), "application/json"
        )
        self.fetcher.routes[ORIGIN + "/image-resizer"] = (200, page("Image resizer", "Resize image"), "text/html")
        report = self.run_scan()
        self.assertEqual(len(report["products"]), 2)
        self.assertTrue(any(p["url"].endswith("/image-resizer") for p in report["products"]))

    def test_browser_inventory_enrolls_js_only_tool(self):
        from discover import utcnow
        self.fetcher.serve(["/tools/a"])
        (self.storage / "browser-discovery.json").write_text(json.dumps({
            "origin": ORIGIN, "generatedAt": utcnow(), "successfulHubs": 2,
            "products": [{"url": ORIGIN + "/resize-images", "name": "Resize Images", "source": "playwright-browser"}]
        }))
        self.fetcher.routes[ORIGIN + "/resize-images"] = (200, page("Resize images", "Resize"), "text/html")
        report = self.run_scan()
        self.assertEqual(len(report["products"]), 2)
        self.assertTrue(report["verification"]["browserDiscoveryAvailable"])
        self.assertTrue(any(p["url"].endswith("/resize-images") and p["status"] == "healthy" for p in report["products"]))

    def test_missing_browser_cache_does_not_remove_browser_only_product(self):
        from discover import utcnow
        self.fetcher.serve(["/tools/a"])
        cache = self.storage / "browser-discovery.json"
        cache.write_text(json.dumps({
            "origin": ORIGIN, "generatedAt": utcnow(), "successfulHubs": 2,
            "products": [{"url": ORIGIN + "/resize-images", "name": "Resize Images"}]
        }))
        self.fetcher.routes[ORIGIN + "/resize-images"] = (200, page("Resize images", "Resize"), "text/html")
        self.run_scan()
        cache.unlink()
        self.run_scan()
        report = self.run_scan()
        old = [p for p in report["products"] if p["url"].endswith("/resize-images")][0]
        self.assertTrue(old["active"])
        self.assertEqual(old["missingStreak"], 0)

    def test_rejects_cross_origin_and_query_variants(self):
        self.assertIsNone(canonical("https://not-yorphives.example/tools/trap", ORIGIN))
        self.assertEqual(canonical("/tools/a?ref=promo#main", ORIGIN), ORIGIN + "/tools/a")
        self.assertFalse(is_product(ORIGIN + "/free-tools"))
        self.assertTrue(is_product(ORIGIN + "/free-tools/image-tool"))

    def test_state_cannot_be_inside_source_checkout(self):
        with self.assertRaises(ValueError):
            private_storage(str(ROOT / "intelligence" / "evidence"))


class ResearchTests(unittest.TestCase):
    def test_similarity_only_finds_confident_matches(self):
        name, score = similar("Image Compressor", ["Image Compressor", "Word Counter"])
        self.assertEqual(name, "Image Compressor")
        name, score = similar("Email signature builder", ["Image Compressor", "Word Counter"])
        self.assertEqual(name, "")

    def test_research_score_does_not_claim_verified_traffic(self):
        score, signals = source_score("Open source image tool", "Browser resize utility", "", 1)
        self.assertLessEqual(score, 45)
        self.assertTrue(any("No verified search volume" in x for x in signals))

    def test_rss_and_atom_items(self):
        rss = b'<rss><channel><item><title>New image tool</title><link>https://example.org/t</link><description>Image compression</description></item></channel></rss>'
        self.assertEqual(feed_entries(rss)[0]["title"], "New image tool")
        atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Tool</title><link href="https://example.org/t"/></entry></feed>'
        self.assertEqual(feed_entries(atom)[0]["url"], "https://example.org/t")


if __name__ == "__main__":
    unittest.main(verbosity=2)
