"""
Facebook scraper service using facebook-scraper library.
"""
import asyncio
from typing import List, Optional
from facebook_scraper import get_posts, get_profile
from logging_config import get_logger

logger = get_logger(__name__)


async def scrape_facebook_page(
    page_name: str,
    pages: int = 5,
    cookies: Optional[str] = None,
) -> List[dict]:
    """
    Scrapes posts from a Facebook page.
    
    Args:
        page_name: The Facebook page name or ID (e.g., "zuck" or "meta")
        pages: Number of pages of posts to scrape (default: 5)
        cookies: Optional path to cookies file for authenticated requests
    
    Returns:
        List of post dictionaries with keys like:
        - post_id
        - text
        - time
        - likes
        - comments
        - shares
        - post_url
        - images
        - etc.
    """
    try:
        # Run in thread pool since facebook-scraper is synchronous
        loop = asyncio.get_event_loop()
        posts = await loop.run_in_executor(
            None,
            lambda: list(get_posts(
                page_name,
                pages=pages,
                cookies=cookies,
                options={
                    "posts_per_page": 25,
                    "comments": False,  # Disable comments to speed up
                }
            ))
        )
        
        logger.info(f"Scraped {len(posts)} posts from Facebook page: {page_name}")
        return posts
        
    except Exception as e:
        logger.error(f"Error scraping Facebook page {page_name}: {e}", exc_info=True)
        raise


async def scrape_facebook_profile(
    profile_name: str,
    cookies: Optional[str] = None,
) -> dict:
    """
    Scrapes profile information from a Facebook profile.
    
    Args:
        profile_name: The Facebook profile name or ID (e.g., "zuck")
        cookies: Optional path to cookies file for authenticated requests
    
    Returns:
        Dictionary with profile information including:
        - Name
        - About
        - Education
        - Work
        - Places lived
        - etc.
    """
    try:
        loop = asyncio.get_event_loop()
        profile = await loop.run_in_executor(
            None,
            lambda: get_profile(profile_name, cookies=cookies)
        )
        
        logger.info(f"Scraped profile information for: {profile_name}")
        return profile
        
    except Exception as e:
        logger.error(f"Error scraping Facebook profile {profile_name}: {e}", exc_info=True)
        raise


def format_facebook_posts_as_content(posts: List[dict]) -> str:
    """
    Formats Facebook posts into a readable text format for AI processing.
    
    Args:
        posts: List of post dictionaries from facebook-scraper
    
    Returns:
        Formatted text string containing all posts
    """
    content_parts = []
    
    for post in posts:
        post_text = post.get("text", "").strip()
        if not post_text:
            continue
            
        post_id = post.get("post_id", "unknown")
        post_time = post.get("time", "")
        post_url = post.get("post_url", "")
        likes = post.get("likes", 0)
        comments = post.get("comments", 0)
        shares = post.get("shares", 0)
        
        # Format the post
        post_section = f"=== Post {post_id} ===\n"
        if post_time:
            post_section += f"Date: {post_time}\n"
        if post_url:
            post_section += f"URL: {post_url}\n"
        post_section += f"Content:\n{post_text}\n"
        
        # Add engagement metrics
        metrics = []
        if likes:
            metrics.append(f"Likes: {likes}")
        if comments:
            metrics.append(f"Comments: {comments}")
        if shares:
            metrics.append(f"Shares: {shares}")
        if metrics:
            post_section += f"Engagement: {', '.join(metrics)}\n"
        
        # Add images if available
        images = post.get("images", [])
        if images:
            post_section += f"Images: {len(images)} image(s)\n"
        
        post_section += "\n"
        content_parts.append(post_section)
    
    return "\n".join(content_parts)


def format_facebook_profile_as_content(profile: dict) -> str:
    """
    Formats Facebook profile information into a readable text format.
    
    Args:
        profile: Profile dictionary from facebook-scraper
    
    Returns:
        Formatted text string containing profile information
    """
    content_parts = []
    
    if name := profile.get("Name"):
        content_parts.append(f"Name: {name}\n")
    
    if about := profile.get("About"):
        content_parts.append(f"About: {about}\n")
    
    if work := profile.get("Work"):
        content_parts.append(f"Work:\n{work}\n")
    
    if education := profile.get("Education"):
        content_parts.append(f"Education:\n{education}\n")
    
    if places := profile.get("Places lived"):
        if isinstance(places, list):
            places_str = "\n".join([f"- {p.get('text', '')} ({p.get('type', '')})" for p in places])
            content_parts.append(f"Places Lived:\n{places_str}\n")
        else:
            content_parts.append(f"Places Lived: {places}\n")
    
    if quotes := profile.get("Favourite Quotes"):
        content_parts.append(f"Favourite Quotes:\n{quotes}\n")
    
    # Add any other fields
    for key, value in profile.items():
        if key not in ["Name", "About", "Work", "Education", "Places lived", "Favourite Quotes"]:
            if value:
                content_parts.append(f"{key}: {value}\n")
    
    return "\n".join(content_parts)

