"""
Twitter/X scraper service using Apify API.
https://apify.com/apidojo/tweet-scraper

Apify provides reliable Twitter scraping with:
- Automatic proxy rotation
- Rate limit handling
- Structured data output
"""

import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field

from logging_config import get_logger

logger = get_logger(__name__)

# Apify Actor ID for Twitter scraper (quacker/twitter-scraper works with free plan)
APIFY_TWITTER_ACTOR = "quacker/twitter-scraper"


class TwitterScraperConfig(BaseModel):
    """Configuration for Twitter scraping via Apify"""

    results_limit: int = Field(default=20, ge=1, le=100)
    timeout_secs: int = Field(default=180, ge=30, le=600)


class TwitterTweet(BaseModel):
    """Represents a single tweet from Apify"""

    tweet_id: Optional[str] = None
    text: Optional[str] = None
    full_text: Optional[str] = None
    created_at: Optional[str] = None
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    quotes: int = 0
    views: int = 0
    images: List[str] = []
    video: Optional[str] = None
    tweet_url: Optional[str] = None
    author_name: Optional[str] = None
    author_username: Optional[str] = None
    author_profile_pic: Optional[str] = None
    is_retweet: bool = False
    is_reply: bool = False


class TwitterUserInfo(BaseModel):
    """Represents Twitter user profile info"""
    
    user_id: Optional[str] = None
    name: Optional[str] = None
    username: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    profile_image_url: Optional[str] = None
    profile_banner_url: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    tweet_count: int = 0
    created_at: Optional[str] = None
    verified: bool = False


class TwitterScrapedContent(BaseModel):
    """Result of Twitter scraping via Apify"""

    user_info: Optional[TwitterUserInfo] = None
    tweets: List[TwitterTweet] = []
    raw_data: List[Dict[str, Any]] = []
    scraped_at: datetime = Field(default_factory=datetime.now)
    username: Optional[str] = None
    error: Optional[str] = None


class TwitterScraperService:
    """
    Service for scraping Twitter/X content using Apify.
    
    Requires APIFY_API_TOKEN environment variable or passed via constructor.
    
    Get your token at: https://console.apify.com/account/integrations
    """

    def __init__(self, api_token: Optional[str] = None):
        """
        Initialize Twitter scraper with Apify.

        Args:
            api_token: Apify API token. If not provided, reads from APIFY_API_TOKEN env var.
        """
        self.api_token = api_token or os.getenv("APIFY_API_TOKEN")
        if not self.api_token:
            logger.warning(
                "APIFY_API_TOKEN not set. Twitter scraping will not work. "
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
                    "apify-client is required for Twitter scraping. "
                    "Install with: pip install apify-client"
                )
            
            if not self.api_token:
                raise ValueError(
                    "APIFY_API_TOKEN is required. "
                    "Get your token at: https://console.apify.com/account/integrations"
                )
            
            self._client = ApifyClient(self.api_token)
        return self._client

    def _extract_username(self, url: str) -> str:
        """
        Extract username from Twitter/X URL.

        Examples:
            https://twitter.com/elonmusk -> elonmusk
            https://x.com/elonmusk -> elonmusk
            https://twitter.com/elonmusk/status/123456 -> elonmusk
        """
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        
        # Remove status/tweet paths
        parts = path.split("/")
        if parts:
            username = parts[0]
            # Filter out non-username paths
            if username not in ["search", "explore", "home", "notifications", "messages", "i", "settings"]:
                return username
        return ""

    def _get_larger_profile_pic(self, pic_url: str) -> str:
        """
        Get a larger version of the Twitter profile picture.
        
        Twitter URLs often have size suffixes like _normal, _bigger, _mini
        Removing or replacing these gets the original size.
        
        Args:
            pic_url: Original profile picture URL
            
        Returns:
            URL for larger image
        """
        import re
        
        if not pic_url:
            return pic_url
        
        # Replace size suffixes with _400x400 for larger version
        larger_url = re.sub(r'_normal\.(jpg|jpeg|png|gif|webp)', r'_400x400.\1', pic_url, flags=re.IGNORECASE)
        larger_url = re.sub(r'_bigger\.(jpg|jpeg|png|gif|webp)', r'_400x400.\1', larger_url, flags=re.IGNORECASE)
        larger_url = re.sub(r'_mini\.(jpg|jpeg|png|gif|webp)', r'_400x400.\1', larger_url, flags=re.IGNORECASE)
        
        return larger_url

    async def scrape_tweets(
        self,
        url: str,
        config: Optional[TwitterScraperConfig] = None,
    ) -> TwitterScrapedContent:
        """
        Scrape tweets from a Twitter/X profile.

        Args:
            url: Twitter/X profile URL
            config: Scraping configuration

        Returns:
            TwitterScrapedContent with scraped tweets
        """
        if config is None:
            config = TwitterScraperConfig()

        username = self._extract_username(url)
        result = TwitterScrapedContent(username=username)

        try:
            client = self._get_client()

            logger.info(f"Starting Apify Twitter scraper: {APIFY_TWITTER_ACTOR} for @{username}")

            # Build input for quacker/twitter-scraper
            run_input = {
                "handles": [username],
                "tweetsDesired": config.results_limit,
            }

            # Run the actor synchronously in a thread pool
            loop = asyncio.get_event_loop()
            run_result = await loop.run_in_executor(
                None,
                lambda: client.actor(APIFY_TWITTER_ACTOR).call(
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
                
                # Filter out items that indicate no results
                valid_items = [item for item in items if not item.get("noResults")]
                
                result.raw_data = valid_items
                result.tweets = [self._parse_tweet(item) for item in valid_items]
                
                # Extract user info from first tweet if available
                if valid_items:
                    result.user_info = self._extract_user_info(valid_items[0])

            result.scraped_at = datetime.now()
            logger.info(f"Scraped {len(result.tweets)} tweets from @{username}")
            return result

        except Exception as e:
            logger.error(f"Failed to scrape Twitter content: {e}", exc_info=True)
            result.error = str(e)
            return result

    def _parse_tweet(self, item: Dict[str, Any]) -> TwitterTweet:
        """Parse Apify response item into TwitterTweet"""
        
        # Handle different response formats from Apify actors
        # The apidojo/tweet-scraper returns data in a specific format
        
        # Extract images from media
        images = []
        media = item.get("media") or item.get("entities", {}).get("media", [])
        if isinstance(media, list):
            for m in media:
                if isinstance(m, dict):
                    media_url = m.get("media_url_https") or m.get("media_url")
                    if media_url:
                        images.append(media_url)
        
        # Also check extended_entities for more media
        extended_media = item.get("extended_entities", {}).get("media", [])
        if isinstance(extended_media, list):
            for m in extended_media:
                if isinstance(m, dict):
                    media_url = m.get("media_url_https") or m.get("media_url")
                    if media_url and media_url not in images:
                        images.append(media_url)

        # Get video URL if available
        video_url = None
        if extended_media:
            for m in extended_media:
                if m.get("type") == "video":
                    video_info = m.get("video_info", {})
                    variants = video_info.get("variants", [])
                    # Get highest quality video
                    best_video = max(
                        [v for v in variants if v.get("content_type") == "video/mp4"],
                        key=lambda x: x.get("bitrate", 0),
                        default=None
                    )
                    if best_video:
                        video_url = best_video.get("url")
                    break

        # Get user info
        user = item.get("user") or item.get("author") or {}
        
        # Build tweet URL
        tweet_id = item.get("id_str") or item.get("id") or item.get("tweetId")
        screen_name = user.get("screen_name") or user.get("username") or item.get("author_username")
        tweet_url = f"https://twitter.com/{screen_name}/status/{tweet_id}" if tweet_id and screen_name else item.get("url")

        return TwitterTweet(
            tweet_id=str(tweet_id) if tweet_id else None,
            text=item.get("text") or item.get("full_text"),
            full_text=item.get("full_text") or item.get("text"),
            created_at=item.get("created_at") or item.get("createdAt"),
            likes=item.get("favorite_count") or item.get("likes") or item.get("likeCount") or 0,
            retweets=item.get("retweet_count") or item.get("retweets") or item.get("retweetCount") or 0,
            replies=item.get("reply_count") or item.get("replies") or item.get("replyCount") or 0,
            quotes=item.get("quote_count") or item.get("quotes") or item.get("quoteCount") or 0,
            views=item.get("views") or item.get("viewCount") or 0,
            images=images,
            video=video_url,
            tweet_url=tweet_url,
            author_name=user.get("name") or item.get("author_name"),
            author_username=screen_name,
            author_profile_pic=self._get_larger_profile_pic(
                user.get("profile_image_url_https") or 
                user.get("profile_image_url") or 
                item.get("author_profile_pic")
            ),
            is_retweet=item.get("retweeted") or item.get("isRetweet") or False,
            is_reply=bool(item.get("in_reply_to_status_id") or item.get("isReply")),
        )

    def _extract_user_info(self, item: Dict[str, Any]) -> Optional[TwitterUserInfo]:
        """Extract user info from a tweet item"""
        user = item.get("user") or item.get("author") or {}
        
        if not user:
            return None
        
        return TwitterUserInfo(
            user_id=str(user.get("id_str") or user.get("id") or ""),
            name=user.get("name"),
            username=user.get("screen_name") or user.get("username"),
            description=user.get("description"),
            location=user.get("location"),
            url=user.get("url"),
            profile_image_url=self._get_larger_profile_pic(
                user.get("profile_image_url_https") or user.get("profile_image_url")
            ),
            profile_banner_url=user.get("profile_banner_url"),
            followers_count=user.get("followers_count") or user.get("followersCount") or 0,
            following_count=user.get("friends_count") or user.get("followingCount") or 0,
            tweet_count=user.get("statuses_count") or user.get("tweetCount") or 0,
            created_at=user.get("created_at"),
            verified=user.get("verified") or user.get("isVerified") or False,
        )

    async def scrape_content(
        self,
        url: str,
        config: Optional[TwitterScraperConfig] = None,
    ) -> TwitterScrapedContent:
        """
        Main entry point for scraping Twitter content.
        Alias for scrape_tweets for compatibility.
        """
        return await self.scrape_tweets(url, config)


def format_twitter_content_for_llm(content: TwitterScrapedContent) -> str:
    """
    Format Twitter scraped content into LLM-readable Markdown text.

    Args:
        content: Scraped Twitter content

    Returns:
        Formatted Markdown string
    """
    sections = []

    # Header
    if content.username:
        sections.append(f"# Twitter/X Content: @{content.username}\n")

    # Error handling
    if content.error:
        sections.append("## ⚠️ Scraping Error\n")
        sections.append(f"{content.error}\n")
        
        if "APIFY_API_TOKEN" in content.error:
            sections.append("\nTo use the Twitter scraper:\n")
            sections.append("1. Sign up at https://console.apify.com/sign-up")
            sections.append("2. Get your API token from https://console.apify.com/account/integrations")
            sections.append("3. Set APIFY_API_TOKEN environment variable or add Apify credential\n")
        
        return "\n".join(sections)

    # User info section
    if content.user_info:
        sections.append("## Profile Information\n")
        user = content.user_info

        if user.name:
            sections.append(f"**Name:** {user.name}")
        if user.username:
            sections.append(f"**Username:** @{user.username}")
        if user.description:
            sections.append(f"**Bio:** {user.description}")
        if user.location:
            sections.append(f"**Location:** {user.location}")
        if user.followers_count:
            sections.append(f"**Followers:** {user.followers_count:,}")
        if user.following_count:
            sections.append(f"**Following:** {user.following_count:,}")
        if user.tweet_count:
            sections.append(f"**Tweets:** {user.tweet_count:,}")
        if user.verified:
            sections.append("**Verified:** ✓")
        sections.append("")

    # Tweets section
    if content.tweets:
        # Filter out retweets for analysis
        original_tweets = [t for t in content.tweets if not t.is_retweet]
        
        # Content Analysis Section (helps AI understand patterns)
        sections.append("## Content Analysis\n")
        
        # Engagement analysis
        if original_tweets:
            total_likes = sum(t.likes or 0 for t in original_tweets)
            total_retweets = sum(t.retweets or 0 for t in original_tweets)
            total_replies = sum(t.replies or 0 for t in original_tweets)
            avg_likes = total_likes // len(original_tweets) if original_tweets else 0
            
            sections.append(f"**Total Original Tweets:** {len(original_tweets)}")
            sections.append(f"**Average Likes per Tweet:** {avg_likes:,}")
            sections.append(f"**Total Engagement:** {total_likes + total_retweets + total_replies:,}\n")
            
            # Find top tweet
            top_tweet = max(original_tweets, key=lambda t: (t.likes or 0) + (t.retweets or 0))
            if top_tweet.likes and top_tweet.likes > avg_likes * 2:
                top_text = (top_tweet.full_text or top_tweet.text or "")[:200]
                sections.append(f"**Most Popular Tweet:**")
                sections.append(f"> {top_text}...")
                sections.append(f"*({top_tweet.likes:,} likes)*\n")
        
        # Tweet content patterns
        all_texts = [t.full_text or t.text or "" for t in original_tweets]
        all_text_combined = " ".join(all_texts).lower()
        
        # Detect common patterns
        patterns = []
        if all_text_combined.count("http") > len(original_tweets) * 0.3:
            patterns.append("Frequently shares links")
        if all_text_combined.count("@") > len(original_tweets) * 0.5:
            patterns.append("Highly interactive (mentions others often)")
        if any(len(t) > 200 for t in all_texts):
            patterns.append("Uses long-form tweets/threads")
        if sum(1 for t in original_tweets if t.images) > len(original_tweets) * 0.3:
            patterns.append("Frequently posts images")
        
        # Emoji usage
        import re
        emoji_pattern = re.compile("["
            u"\U0001F600-\U0001F64F"  # emoticons
            u"\U0001F300-\U0001F5FF"  # symbols & pictographs
            u"\U0001F680-\U0001F6FF"  # transport & map symbols
            u"\U0001F1E0-\U0001F1FF"  # flags
            u"\U00002702-\U000027B0"
            u"\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE)
        emoji_count = len(emoji_pattern.findall(all_text_combined))
        if emoji_count > len(original_tweets) * 2:
            patterns.append("Heavy emoji user")
        elif emoji_count < len(original_tweets) * 0.2:
            patterns.append("Minimal emoji usage")
        
        if patterns:
            sections.append("**Posting Patterns:**")
            for p in patterns:
                sections.append(f"- {p}")
            sections.append("")
        
        sections.append(f"## Tweets ({len(original_tweets)} original)\n")

        for i, tweet in enumerate(original_tweets, 1):
            sections.append(f"### Tweet {i}")
            
            if tweet.created_at:
                sections.append(f"*{tweet.created_at}*")

            text = tweet.full_text or tweet.text
            if text:
                # Truncate very long tweets
                if len(text) > 500:
                    text = text[:500] + "..."
                sections.append(f"\n{text}\n")

            # Interaction stats
            interactions = []
            if tweet.likes:
                interactions.append(f"❤️ {tweet.likes:,}")
            if tweet.retweets:
                interactions.append(f"🔄 {tweet.retweets:,}")
            if tweet.replies:
                interactions.append(f"💬 {tweet.replies:,}")
            if tweet.views:
                interactions.append(f"👁️ {tweet.views:,}")
            if interactions:
                sections.append(f"*{' | '.join(interactions)}*\n")

            # Images
            if tweet.images:
                sections.append(f"*📷 {len(tweet.images)} image(s)*\n")

            # Tweet URL
            if tweet.tweet_url:
                sections.append(f"[View tweet]({tweet.tweet_url})\n")

    else:
        sections.append("## No Tweets Found\n")
        sections.append("The scraper did not return any tweets. This could be because:\n")
        sections.append("- The profile has no public tweets")
        sections.append("- The URL is incorrect")
        sections.append("- The account is private or suspended")
        sections.append("- Rate limiting or access restrictions\n")

    # Add scrape timestamp
    if content.scraped_at:
        sections.append(f"\n---\n*Scraped at: {content.scraped_at.isoformat()}*")

    return "\n".join(sections)


def is_twitter_url(url: str) -> bool:
    """
    Check if a URL is a Twitter/X URL.
    
    Args:
        url: URL to check
        
    Returns:
        True if the URL is a Twitter/X URL
    """
    parsed = urlparse(url)
    twitter_domains = [
        "twitter.com",
        "www.twitter.com",
        "mobile.twitter.com",
        "x.com",
        "www.x.com",
    ]
    return parsed.netloc.lower() in twitter_domains


def extract_images_from_twitter_content(content: TwitterScrapedContent, include_profile_pic: bool = True) -> tuple[List[str], Optional[str]]:
    """
    Extract all image URLs from Twitter scraped content.
    
    Profile picture is returned first (if available) as it's ideal for avatar use.
    
    Args:
        content: Scraped Twitter content
        include_profile_pic: Whether to include profile picture as first image
        
    Returns:
        Tuple of (list of image URLs, profile picture URL)
    """
    images = []
    profile_pic = None
    
    # Add profile picture first (best for avatar)
    if include_profile_pic and content.user_info:
        profile_pic = content.user_info.profile_image_url
        if profile_pic:
            images.append(profile_pic)
    
    # Then add tweet images
    for tweet in content.tweets:
        if tweet.images:
            images.extend(tweet.images)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_images = []
    for img in images:
        if img not in seen:
            seen.add(img)
            unique_images.append(img)
    
    return unique_images, profile_pic


def get_twitter_avatar(content: TwitterScrapedContent) -> Optional[str]:
    """
    Get the profile picture URL from Twitter scraped content.
    
    Args:
        content: Scraped Twitter content
        
    Returns:
        Profile picture URL or None
    """
    if content.user_info:
        return content.user_info.profile_image_url
    return None


async def scrape_twitter_for_source(
    url: str,
    results_limit: int = 20,
    api_token: Optional[str] = None,
    user_id: Optional[str] = None,
) -> tuple[str, List[str]]:
    """
    Scrape Twitter profile and return content formatted for character card generation.
    
    This function is designed to integrate with the existing source fetching workflow.
    It automatically retrieves the Apify API token from credentials if not provided.
    
    Args:
        url: Twitter/X profile URL
        results_limit: Number of tweets to fetch
        api_token: Optional Apify API token (if not provided, fetched from credentials/env)
        user_id: Optional user ID to filter credentials by user
        
    Returns:
        Tuple of (formatted_content, image_urls)
    """
    # Get Apify token from credentials if not provided
    if not api_token:
        from db.credentials import get_apify_api_token
        api_token = await get_apify_api_token(user_id=user_id)
    
    if not api_token:
        raise ValueError(
            "Apify API token not configured. Please add an Apify credential in Settings > Credentials, "
            "or set the APIFY_API_TOKEN environment variable."
        )
    
    service = TwitterScraperService(api_token=api_token)
    config = TwitterScraperConfig(results_limit=results_limit)
    content = await service.scrape_content(url, config)
    
    if content.error:
        raise ValueError(f"Failed to scrape Twitter: {content.error}")
    
    formatted = format_twitter_content_for_llm(content)
    cdn_images, profile_pic = extract_images_from_twitter_content(content)
    
    # Download images locally for persistence
    final_image_urls = []
    
    from services.image_downloader import download_images, get_image_url
    
    # Download profile picture first
    if profile_pic:
        try:
            logger.info(f"Attempting to download Twitter profile pic...")
            download_results = await download_images([profile_pic], max_concurrent=1)
            local_file = download_results.get(profile_pic)
            if local_file:
                final_image_urls.append(get_image_url(local_file))
                logger.info(f"✅ Downloaded Twitter profile pic: {local_file}")
        except Exception as e:
            logger.warning(f"Failed to download Twitter profile pic: {e}")
            # Use original URL as fallback
            final_image_urls.append(profile_pic)
    
    # Download other images (tweet images)
    other_images = [img for img in cdn_images if img != profile_pic]
    
    if other_images:
        try:
            logger.info(f"Attempting to download {len(other_images)} tweet images...")
            download_results = await download_images(other_images, max_concurrent=3)
            
            for original_url in other_images:
                local_file = download_results.get(original_url)
                if local_file:
                    final_image_urls.append(get_image_url(local_file))
                else:
                    # Use original URL as fallback
                    final_image_urls.append(original_url)
        except Exception as e:
            logger.warning(f"Image download failed: {e}")
            # Use original URLs as fallback
            final_image_urls.extend(other_images)
    
    return formatted, final_image_urls

