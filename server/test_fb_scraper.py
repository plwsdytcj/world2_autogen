"""
Test script for Facebook scraper using Apify
"""
import asyncio
import os
import sys
sys.path.insert(0, 'src')

from services.facebook_scraper import (
    FacebookScraperService,
    FacebookScraperConfig,
    format_facebook_content_for_llm,
    scrape_facebook_page
)


async def test_scrape():
    """Test scraping a Facebook page"""
    
    # Check for API token
    api_token = os.getenv("APIFY_API_TOKEN")
    
    if not api_token:
        print("=" * 60)
        print("⚠️  APIFY_API_TOKEN not set!")
        print("=" * 60)
        print("\nTo test the Facebook scraper, you need to:")
        print("1. Sign up for free at: https://console.apify.com/sign-up")
        print("2. Get your API token at: https://console.apify.com/account/integrations")
        print("3. Set the environment variable:")
        print("   export APIFY_API_TOKEN='your_token_here'")
        print("\n💡 Apify offers $5 free credits per month!")
        print("=" * 60)
        
        # Still test the service initialization
        print("\n📝 Testing service initialization (without API call)...\n")
        
        service = FacebookScraperService()
        
        # Test URL parsing
        test_urls = [
            "https://www.facebook.com/nintendo",
            "https://facebook.com/zuck",
            "https://www.facebook.com/groups/123456789",
        ]
        
        print("🔗 URL Parsing Test:")
        for url in test_urls:
            account = service._extract_account_name(url)
            print(f"  {url} → {account}")
        
        print("\n✅ Service initialized correctly (API token needed for actual scraping)")
        return

    # If token is set, run actual test
    url = "https://www.facebook.com/nintendo"
    
    print(f"🔍 Testing Facebook scraper with: {url}")
    print("=" * 60)
    
    try:
        content = await scrape_facebook_page(url, results_limit=5)
        print(content)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def test_with_service():
    """Test using the service class directly"""
    
    api_token = os.getenv("APIFY_API_TOKEN")
    if not api_token:
        print("Skipping service test (no API token)")
        return
    
    print("\n📊 Testing with FacebookScraperService...")
    print("=" * 60)
    
    service = FacebookScraperService()
    config = FacebookScraperConfig(
        scraper_type="posts",
        results_limit=3,
        timeout_secs=120,
    )
    
    url = "https://www.facebook.com/nintendo"
    result = await service.scrape_content(url, config)
    
    print(f"\n📋 Results:")
    print(f"  Account: {result.account_name}")
    print(f"  Posts found: {len(result.posts)}")
    print(f"  Page info: {result.page_info}")
    
    if result.error:
        print(f"  ⚠️ Error: {result.error}")
    
    for i, post in enumerate(result.posts[:3], 1):
        print(f"\n  Post {i}:")
        print(f"    Text: {post.text[:100] if post.text else 'N/A'}...")
        print(f"    Likes: {post.likes}, Comments: {post.comments_count}")


if __name__ == "__main__":
    asyncio.run(test_scrape())
    asyncio.run(test_with_service())
