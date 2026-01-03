"""
Facebook scraper service using Apify API.
https://apify.com/apify/facebook-posts-scraper

Apify provides reliable Facebook scraping with:
- Automatic proxy rotation
- CAPTCHA handling
- Structured data output
"""

import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import parse_qs, urlparse

from pydantic import BaseModel, Field

from logging_config import get_logger

logger = get_logger(__name__)

# Apify Actor IDs for different Facebook scrapers
APIFY_ACTORS = {
    "posts": "apify/facebook-posts-scraper",
    "comments": "apify/facebook-comments-scraper",
    "pages": "apify/facebook-pages-scraper",
    "groups": "apify/facebook-groups-scraper",
    "events": "apify/facebook-events-scraper",
    "marketplace": "apify/facebook-marketplace-scraper",
}

FacebookScraperType = Literal["posts", "comments", "pages", "groups", "events", "marketplace"]


class FacebookScraperConfig(BaseModel):
    """Configuration for Facebook scraping via Apify"""

    scraper_type: FacebookScraperType = "posts"
    results_limit: int = Field(default=10, ge=1, le=100)
    include_comments: bool = False
    timeout_secs: int = Field(default=120, ge=30, le=600)


class FacebookPost(BaseModel):
    """Represents a single Facebook post from Apify"""

    post_id: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[str] = None
    time: Optional[str] = None
    likes: int = 0
    comments_count: int = 0
    shares: int = 0
    images: List[str] = []
    video: Optional[str] = None
    post_url: Optional[str] = None
    page_name: Optional[str] = None
    page_url: Optional[str] = None


class FacebookScrapedContent(BaseModel):
    """Result of Facebook scraping via Apify"""

    page_info: Optional[Dict[str, Any]] = None
    posts: List[FacebookPost] = []
    raw_data: List[Dict[str, Any]] = []
    scraped_at: datetime = Field(default_factory=datetime.now)
    account_name: Optional[str] = None
    scraper_type: str = "posts"
    error: Optional[str] = None


class FacebookScraperService:
    """
    Service for scraping Facebook content using Apify.
    
    Requires APIFY_API_TOKEN environment variable or passed via constructor.
    
    Get your token at: https://console.apify.com/account/integrations
    """

    def __init__(self, api_token: Optional[str] = None):
        """
        Initialize Facebook scraper with Apify.

        Args:
            api_token: Apify API token. If not provided, reads from APIFY_API_TOKEN env var.
        """
        self.api_token = api_token or os.getenv("APIFY_API_TOKEN")
        if not self.api_token:
            logger.warning(
                "APIFY_API_TOKEN not set. Facebook scraping will not work. "
                "Get your token at: https://console.apify.com/account/integrations"
            )
        self._client = None

    def _get_client(self):
        """Get or create Apify client"""
        if self._client is None:
            try:
                from apify_client import ApifyClient
            except ImportError:
                raise ImportError(
                    "apify-client is required for Facebook scraping. "
                    "Install with: pip install apify-client"
                )
            
            if not self.api_token:
                raise ValueError(
                    "APIFY_API_TOKEN is required. "
                    "Get your token at: https://console.apify.com/account/integrations"
                )
            
            self._client = ApifyClient(self.api_token)
        return self._client

    def _extract_account_name(self, url: str) -> str:
        """
        Extract account name from Facebook URL.

        Examples:
            https://www.facebook.com/nintendo -> nintendo
            https://www.facebook.com/groups/123456 -> 123456
            https://facebook.com/profile.php?id=100000123456 -> 100000123456
        """
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        if "profile.php" in path:
            qs = parse_qs(parsed.query)
            return qs.get("id", [""])[0]
        elif path.startswith("groups/"):
            parts = path.split("/")
            return parts[1] if len(parts) > 1 else ""
        else:
            parts = path.split("/")
            return parts[0] if parts else ""

    def _get_larger_profile_pic(self, pic_url: str) -> str:
        """
        Try to get a larger version of the Facebook profile picture.
        
        Facebook CDN URLs often have size parameters like 's50x50' that can be modified.
        
        Args:
            pic_url: Original profile picture URL
            
        Returns:
            URL for larger image (or original if can't be modified)
        """
        import re
        
        # Try to replace size parameters in the URL
        # Common patterns: s50x50, s100x100, p50x50, etc.
        larger_url = pic_url
        
        # Replace small sizes with larger ones
        size_patterns = [
            (r'_s\d+x\d+', '_s200x200'),  # _s50x50 -> _s200x200
            (r's\d+x\d+', 's200x200'),     # s50x50 -> s200x200  
            (r'p\d+x\d+', 'p200x200'),     # p50x50 -> p200x200
        ]
        
        for pattern, replacement in size_patterns:
            if re.search(pattern, larger_url):
                larger_url = re.sub(pattern, replacement, larger_url)
                break
        
        return larger_url

    async def scrape_posts(
        self,
        url: str,
        config: Optional[FacebookScraperConfig] = None,
    ) -> FacebookScrapedContent:
        """
        Scrape posts from a Facebook page or profile.

        Args:
            url: Facebook page/profile URL
            config: Scraping configuration

        Returns:
            FacebookScrapedContent with scraped posts
        """
        if config is None:
            config = FacebookScraperConfig()

        account = self._extract_account_name(url)
        result = FacebookScrapedContent(
            account_name=account,
            scraper_type=config.scraper_type,
        )

        try:
            client = self._get_client()
            actor_id = APIFY_ACTORS.get(config.scraper_type, APIFY_ACTORS["posts"])

            logger.info(f"Starting Apify scraper: {actor_id} for {url}")

            # Build input based on scraper type
            run_input = self._build_input(url, config)

            # Run the actor synchronously in a thread pool
            loop = asyncio.get_event_loop()
            run_result = await loop.run_in_executor(
                None,
                lambda: client.actor(actor_id).call(
                    run_input=run_input,
                    timeout_secs=config.timeout_secs,
                ),
            )

            # Fetch results from the dataset
            dataset_id = run_result.get("defaultDatasetId")
            if dataset_id:
                items = await loop.run_in_executor(
                    None,
                    lambda: list(client.dataset(dataset_id).iterate_items()),
                )
                
                result.raw_data = items
                result.posts = [self._parse_post(item) for item in items]
                
                # Extract page info from first post if available
                if items:
                    user_info = items[0].get("user", {})
                    page_id = items[0].get("pageId") or items[0].get("facebookId")
                    page_name = items[0].get("pageName") or (user_info.get("name") if user_info else None)
                    
                    # Use Graph API URL for profile picture - this is a permanent redirect URL
                    # that doesn't expire (unlike CDN URLs with signatures)
                    profile_pic = None
                    if page_id:
                        # Graph API provides a permanent redirect to the current profile picture
                        profile_pic = f"https://graph.facebook.com/{page_id}/picture?type=large"
                    elif page_name:
                        # Fallback to page name if no ID
                        profile_pic = f"https://graph.facebook.com/{page_name}/picture?type=large"
                    
                    result.page_info = {
                        "name": page_name,
                        "url": items[0].get("facebookUrl") or items[0].get("pageUrl"),
                        "id": page_id,
                        "profile_picture": profile_pic,
                    }

            result.scraped_at = datetime.now()
            logger.info(f"Scraped {len(result.posts)} posts from {account}")
            return result

        except Exception as e:
            logger.error(f"Failed to scrape Facebook content: {e}", exc_info=True)
            result.error = str(e)
            return result

    def _build_input(self, url: str, config: FacebookScraperConfig) -> Dict[str, Any]:
        """Build Apify actor input based on scraper type"""
        
        base_input = {
            "startUrls": [{"url": url}],
            "resultsLimit": config.results_limit,
        }

        if config.scraper_type == "posts":
            return {
                **base_input,
                "maxRequestRetries": 5,
            }
        elif config.scraper_type == "comments":
            return {
                "startUrls": [{"url": url}],
                "resultsLimit": config.results_limit,
            }
        elif config.scraper_type == "pages":
            return base_input
        elif config.scraper_type == "groups":
            return base_input
        else:
            return base_input

    def _parse_post(self, item: Dict[str, Any]) -> FacebookPost:
        """Parse Apify response item into FacebookPost"""
        
        # Handle different response formats from different actors
        timestamp = item.get("timestamp") or item.get("time")
        if isinstance(timestamp, int):
            # Convert milliseconds to ISO string
            timestamp = datetime.fromtimestamp(timestamp / 1000).isoformat()
        elif isinstance(timestamp, str):
            timestamp = timestamp

        # Extract images
        images = []
        if item.get("thumb"):
            images.append(item["thumb"])
        if item.get("images"):
            images.extend(item["images"] if isinstance(item["images"], list) else [item["images"]])

        return FacebookPost(
            post_id=item.get("postId") or item.get("post_id"),
            text=item.get("text") or item.get("content") or item.get("post_text"),
            timestamp=timestamp,
            time=item.get("time"),
            likes=item.get("likes") or item.get("reactions") or 0,
            comments_count=item.get("comments") or item.get("commentsCount") or 0,
            shares=item.get("shares") or 0,
            images=images,
            video=item.get("video") or item.get("videoUrl"),
            post_url=item.get("url") or item.get("postUrl") or item.get("topLevelUrl"),
            page_name=item.get("pageName") or item.get("userName"),
            page_url=item.get("facebookUrl") or item.get("pageUrl") or item.get("user_url"),
        )

    async def scrape_content(
        self,
        url: str,
        config: Optional[FacebookScraperConfig] = None,
    ) -> FacebookScrapedContent:
        """
        Main entry point for scraping Facebook content.
        Alias for scrape_posts for compatibility.
        """
        return await self.scrape_posts(url, config)


def format_facebook_content_for_llm(content: FacebookScrapedContent) -> str:
    """
    Format Facebook scraped content into LLM-readable Markdown text.

    Args:
        content: Scraped Facebook content

    Returns:
        Formatted Markdown string
    """
    sections = []

    # Header
    if content.account_name:
        sections.append(f"# Facebook Content: {content.account_name}\n")

    # Error handling
    if content.error:
        sections.append("## ⚠️ Scraping Error\n")
        sections.append(f"{content.error}\n")
        
        if "APIFY_API_TOKEN" in content.error:
            sections.append("\nTo use the Facebook scraper:\n")
            sections.append("1. Sign up at https://console.apify.com/sign-up")
            sections.append("2. Get your API token from https://console.apify.com/account/integrations")
            sections.append("3. Set APIFY_API_TOKEN environment variable\n")
        
        return "\n".join(sections)

    # Page info section
    if content.page_info:
        sections.append("## Page Information\n")
        page = content.page_info

        if page.get("name"):
            sections.append(f"**Name:** {page['name']}\n")
        if page.get("url"):
            sections.append(f"**URL:** {page['url']}\n")
        if page.get("id"):
            sections.append(f"**ID:** {page['id']}\n")

    # Posts section
    if content.posts:
        sections.append(f"## Posts ({len(content.posts)} total)\n")

        for i, post in enumerate(content.posts, 1):
            sections.append(f"### Post {i}")
            
            if post.time:
                sections.append(f"*{post.time}*")
            elif post.timestamp:
                sections.append(f"*{post.timestamp}*")

            if post.text:
                # Truncate very long posts
                text = post.text
                if len(text) > 500:
                    text = text[:500] + "..."
                sections.append(f"\n{text}\n")

            # Interaction stats
            interactions = []
            if post.likes:
                interactions.append(f"👍 {post.likes}")
            if post.comments_count:
                interactions.append(f"💬 {post.comments_count}")
            if post.shares:
                interactions.append(f"🔄 {post.shares}")
            if interactions:
                sections.append(f"*{' | '.join(interactions)}*\n")

            # Images
            if post.images:
                sections.append(f"*📷 {len(post.images)} image(s)*\n")

            # Post URL
            if post.post_url:
                sections.append(f"[View post]({post.post_url})\n")

    else:
        sections.append("## No Posts Found\n")
        sections.append("The scraper did not return any posts. This could be because:\n")
        sections.append("- The page has no public posts")
        sections.append("- The URL is incorrect")
        sections.append("- Rate limiting or access restrictions\n")

    # Add scrape timestamp
    if content.scraped_at:
        sections.append(f"\n---\n*Scraped at: {content.scraped_at.isoformat()}*")

    return "\n".join(sections)


# Convenience function for simple usage
async def scrape_facebook_page(
    url: str,
    results_limit: int = 10,
    api_token: Optional[str] = None,
) -> str:
    """
    Simple function to scrape a Facebook page and return formatted content.
    
    Args:
        url: Facebook page URL
        results_limit: Number of posts to fetch
        api_token: Optional Apify API token (reads from env if not provided)
        
    Returns:
        Formatted markdown string of the scraped content
    """
    service = FacebookScraperService(api_token=api_token)
    config = FacebookScraperConfig(results_limit=results_limit)
    content = await service.scrape_content(url, config)
    return format_facebook_content_for_llm(content)


# Synchronous wrapper for non-async contexts
def scrape_facebook_page_sync(
    url: str,
    results_limit: int = 10,
    api_token: Optional[str] = None,
) -> str:
    """
    Synchronous version of scrape_facebook_page.
    """
    return asyncio.run(scrape_facebook_page(url, results_limit, api_token))


def is_facebook_url(url: str) -> bool:
    """
    Check if a URL is a Facebook URL.
    
    Args:
        url: URL to check
        
    Returns:
        True if the URL is a Facebook URL
    """
    parsed = urlparse(url)
    facebook_domains = [
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "mbasic.facebook.com",
        "fb.com",
        "www.fb.com",
    ]
    return parsed.netloc.lower() in facebook_domains


def get_facebook_url_type(url: str) -> Optional[FacebookScraperType]:
    """
    Determine the type of Facebook content from a URL.
    
    Args:
        url: Facebook URL
        
    Returns:
        FacebookScraperType or None if not a Facebook URL
    """
    if not is_facebook_url(url):
        return None
    
    parsed = urlparse(url)
    path = parsed.path.lower().strip("/")
    
    # Check for specific patterns
    if "/groups/" in path or path.startswith("groups"):
        return "groups"
    elif "/events/" in path:
        return "events"
    elif "/posts/" in path or "/videos/" in path or "/photos/" in path:
        return "posts"
    elif "/marketplace" in path:
        return "marketplace"
    else:
        # Default to posts for pages (most common use case)
        return "posts"


def extract_images_from_facebook_content(content: FacebookScrapedContent, include_profile_pic: bool = True) -> List[str]:
    """
    Extract all image URLs from Facebook scraped content.
    
    Profile picture is returned first (if available) as it's ideal for avatar use.
    
    Args:
        content: Scraped Facebook content
        include_profile_pic: Whether to include profile picture as first image
        
    Returns:
        List of image URLs (profile picture first, then post images)
    """
    images = []
    
    # Add profile picture first (best for avatar)
    if include_profile_pic and content.page_info:
        profile_pic = content.page_info.get("profile_picture")
        if profile_pic:
            images.append(profile_pic)
    
    # Then add post images
    for post in content.posts:
        if post.images:
            images.extend(post.images)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_images = []
    for img in images:
        if img not in seen:
            seen.add(img)
            unique_images.append(img)
    
    return unique_images


def get_facebook_avatar(content: FacebookScrapedContent) -> Optional[str]:
    """
    Get the profile picture URL from Facebook scraped content.
    
    This is specifically for getting the avatar/profile picture to use
    as a character card avatar.
    
    Args:
        content: Scraped Facebook content
        
    Returns:
        Profile picture URL or None
    """
    if content.page_info:
        return content.page_info.get("profile_picture")
    return None


async def scrape_facebook_for_source(
    url: str,
    results_limit: int = 20,
    api_token: Optional[str] = None,
) -> tuple[str, List[str]]:
    """
    Scrape Facebook page and return content formatted for character card generation.
    
    This function is designed to integrate with the existing source fetching workflow.
    It automatically retrieves the Apify API token from credentials if not provided.
    
    Args:
        url: Facebook page URL
        results_limit: Number of posts to fetch
        api_token: Optional Apify API token (if not provided, fetched from credentials/env)
        
    Returns:
        Tuple of (formatted_content, image_urls)
    """
    # Get Apify token from credentials if not provided
    if not api_token:
        from db.credentials import get_apify_api_token
        api_token = await get_apify_api_token()
    
    if not api_token:
        raise ValueError(
            "Apify API token not configured. Please add an Apify credential in Settings > Credentials, "
            "or set the APIFY_API_TOKEN environment variable."
        )
    
    service = FacebookScraperService(api_token=api_token)
    config = FacebookScraperConfig(results_limit=results_limit)
    content = await service.scrape_content(url, config)
    
    if content.error:
        raise ValueError(f"Failed to scrape Facebook: {content.error}")
    
    formatted = format_facebook_content_for_llm(content)
    images = extract_images_from_facebook_content(content)
    
    # Process images:
    # - Graph API URLs (profile pictures) are permanent redirect URLs - keep them as-is
    # - CDN URLs (post images) have expiring signatures - try to download them
    final_image_urls = []
    cdn_images_to_download = []
    
    for img_url in images:
        if "graph.facebook.com" in img_url:
            # Graph API URLs are permanent redirects - no need to download
            final_image_urls.append(img_url)
            logger.debug(f"✅ Using Graph API URL (permanent): {img_url}")
        else:
            # CDN URLs need to be downloaded before signatures expire
            cdn_images_to_download.append(img_url)
    
    # Download CDN images
    if cdn_images_to_download:
        try:
            from services.image_downloader import download_images, get_image_url
            logger.info(f"Downloading {len(cdn_images_to_download)} Facebook CDN images (signatures may expire)...")
            download_results = await download_images(cdn_images_to_download, max_concurrent=3)
            
            success_count = 0
            for original_url, local_file in download_results.items():
                if local_file:
                    final_image_urls.append(get_image_url(local_file))
                    success_count += 1
                    logger.debug(f"✅ Downloaded: {original_url[:60]}... -> {local_file}")
                else:
                    # Keep original URL as fallback (may not work if signature expired)
                    final_image_urls.append(original_url)
                    logger.warning(f"⚠️ Download failed (signature may have expired): {original_url[:60]}...")
            
            logger.info(f"Downloaded {success_count}/{len(cdn_images_to_download)} CDN images successfully.")
        except Exception as download_error:
            logger.error(f"Image download process failed: {download_error}", exc_info=True)
            final_image_urls.extend(cdn_images_to_download)
    
    return formatted, final_image_urls
