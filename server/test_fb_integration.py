"""
Test Facebook integration with the character card generation workflow.
"""
import asyncio
import os
import sys
sys.path.insert(0, 'src')

from services.facebook_scraper import (
    is_facebook_url,
    scrape_facebook_for_source,
    format_facebook_content_for_llm,
    FacebookScraperService,
    FacebookScraperConfig,
)


def test_is_facebook_url():
    """Test Facebook URL detection"""
    print("\n🔗 Testing is_facebook_url():")
    print("=" * 50)
    
    test_cases = [
        ("https://www.facebook.com/nintendo", True),
        ("https://facebook.com/zuck", True),
        ("https://m.facebook.com/nintendo", True),
        ("https://fb.com/nintendo", True),
        ("https://www.facebook.com/groups/123456", True),
        ("https://example.com/facebook", False),
        ("https://twitter.com/nintendo", False),
        ("https://fandom.com/wiki/Mario", False),
    ]
    
    all_passed = True
    for url, expected in test_cases:
        result = is_facebook_url(url)
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_passed = False
        print(f"  {status} {url[:40]:<40} → {result} (expected {expected})")
    
    return all_passed


async def test_scrape_facebook_for_source():
    """Test scraping Facebook for character card source"""
    
    api_token = os.getenv("APIFY_API_TOKEN")
    if not api_token:
        print("\n⚠️ APIFY_API_TOKEN not set, skipping live test")
        return True
    
    print("\n📱 Testing scrape_facebook_for_source():")
    print("=" * 50)
    
    url = "https://www.facebook.com/nintendo"
    
    try:
        content, images = await scrape_facebook_for_source(url, results_limit=5)
        
        print(f"  ✅ Content length: {len(content)} chars")
        print(f"  ✅ Images found: {len(images)}")
        
        # Show preview
        print(f"\n  📝 Content preview (first 500 chars):")
        print("  " + "-" * 40)
        preview = content[:500].replace("\n", "\n  ")
        print(f"  {preview}...")
        
        if images:
            print(f"\n  🖼️ Sample images:")
            for img in images[:3]:
                print(f"    - {img[:60]}...")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


async def test_workflow_simulation():
    """Simulate the character card workflow with Facebook source"""
    
    api_token = os.getenv("APIFY_API_TOKEN")
    if not api_token:
        print("\n⚠️ APIFY_API_TOKEN not set, skipping workflow test")
        return True
    
    print("\n🎮 Simulating Character Card Workflow:")
    print("=" * 50)
    
    url = "https://www.facebook.com/nintendo"
    
    # Step 1: Check if URL is Facebook
    print("\n  Step 1: URL Detection")
    is_fb = is_facebook_url(url)
    print(f"    Is Facebook URL: {is_fb}")
    
    if not is_fb:
        print("    ❌ URL detection failed")
        return False
    
    # Step 2: Scrape content
    print("\n  Step 2: Scraping Facebook Content")
    try:
        content, images = await scrape_facebook_for_source(url, results_limit=10)
        print(f"    ✅ Scraped {len(content)} chars of content")
        print(f"    ✅ Found {len(images)} images")
    except Exception as e:
        print(f"    ❌ Scraping failed: {e}")
        return False
    
    # Step 3: Show what would be saved to ProjectSource
    print("\n  Step 3: Data Ready for ProjectSource")
    print(f"    raw_content: {len(content)} chars")
    print(f"    content_type: markdown")
    print(f"    all_image_url: {len(images)} images")
    
    # Step 4: Show sample content for LLM
    print("\n  Step 4: Content Format for LLM")
    print("  " + "-" * 40)
    lines = content.split("\n")[:15]
    for line in lines:
        print(f"    {line}")
    print("    ...")
    
    print("\n  ✅ Workflow simulation complete!")
    return True


async def main():
    """Run all tests"""
    print("🧪 Facebook Integration Tests")
    print("=" * 60)
    
    # Test 1: URL detection (no API needed)
    url_test_passed = test_is_facebook_url()
    
    # Test 2: Scraping (needs API)
    scrape_test_passed = await test_scrape_facebook_for_source()
    
    # Test 3: Workflow simulation (needs API)
    workflow_test_passed = await test_workflow_simulation()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary:")
    print(f"  URL Detection: {'✅ PASS' if url_test_passed else '❌ FAIL'}")
    print(f"  Facebook Scraping: {'✅ PASS' if scrape_test_passed else '❌ FAIL'}")
    print(f"  Workflow Simulation: {'✅ PASS' if workflow_test_passed else '❌ FAIL'}")


if __name__ == "__main__":
    asyncio.run(main())

