import os
import asyncio
import logging
from typing import List, Dict, Optional
from datetime import datetime
from playwright.async_api import async_playwright, Browser, Page
from dotenv import load_dotenv

from models import PinDB, SessionDB, SessionStage, SessionStatus
from database import get_collection, SESSIONS_COLLECTION, PINS_COLLECTION

load_dotenv()

logger = logging.getLogger(__name__)


class PinterestService:
    def __init__(self):
        self.email = os.getenv("PINTEREST_EMAIL")
        self.password = os.getenv("PINTEREST_PASSWORD")
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def __aenter__(self):
        await self.start_browser()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close_browser()

    async def start_browser(self):
        """Start the browser session."""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,  # Set to True for production
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        self.page = await self.browser.new_page()

        # Set user agent to avoid detection
        await self.page.set_extra_http_headers(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )

    async def close_browser(self):
        """Close the browser session."""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if hasattr(self, "playwright"):
            await self.playwright.stop()

    async def login_to_pinterest(self) -> bool:
        """Login to Pinterest account."""
        try:
            await self.log_session("Logging into Pinterest...")

            await self.page.goto("https://www.pinterest.com/login/")
            await self.page.wait_for_load_state("networkidle")

            # Fill email
            await self.page.fill('input[name="id"]', self.email)
            await self.page.click('button[type="submit"]')
            await self.page.wait_for_timeout(2000)

            # Fill password
            await self.page.fill('input[name="password"]', self.password)
            await self.page.click('button[type="submit"]')
            await self.page.wait_for_timeout(3000)

            # Check if login was successful
            if "login" not in self.page.url:
                await self.log_session("Successfully logged into Pinterest")
                return True
            else:
                await self.log_session("Failed to login to Pinterest")
                return False

        except Exception as e:
            await self.log_session(f"Login error: {str(e)}")
            return False

    async def warm_up_account(self, prompt_text: str, prompt_id: str) -> bool:
        """Warm up Pinterest account with relevant interactions."""
        try:
            await self.log_session("Starting Pinterest warm-up phase...", prompt_id)

            # Try cookie login first, then fallback to regular login
            if not await self.login_with_cookies():
                if not await self.login_to_pinterest():
                    return False

            # Search for the prompt
            await self.log_session(f"Searching for: {prompt_text}", prompt_id)
            await self.page.goto(
                f"https://www.pinterest.com/search/pins/?q={prompt_text.replace(' ', '%20')}"
            )
            await self.page.wait_for_load_state("networkidle")
            await self.page.wait_for_timeout(3000)

            # Scroll and interact with pins
            await self.log_session("Scrolling and interacting with pins...", prompt_id)
            for i in range(3):  # Scroll 3 times
                await self.log_session(f"Scrolling page {i+1}/3...", prompt_id)
                await self.page.evaluate("window.scrollBy(0, 1000)")
                await self.page.wait_for_timeout(2000)

                # Like a few pins randomly
                pins = await self.page.query_selector_all('[data-test-id="pin"]')
                if pins:
                    for j in range(min(2, len(pins))):  # Like 2 pins per scroll
                        try:
                            like_button = await pins[j].query_selector(
                                '[data-test-id="pin-save-button"]'
                            )
                            if like_button:
                                await like_button.click()
                                await self.page.wait_for_timeout(1000)
                        except:
                            continue

            # Save some pins to boards
            await self.log_session("Saving pins to boards...", prompt_id)
            save_buttons = await self.page.query_selector_all(
                '[data-test-id="pin-save-button"]'
            )
            for i in range(min(3, len(save_buttons))):
                try:
                    await save_buttons[i].click()
                    await self.page.wait_for_timeout(1000)

                    # Select first board (or create new one)
                    board_option = await self.page.query_selector(
                        '[data-test-id="board-dropdown-select-board"]'
                    )
                    if board_option:
                        await board_option.click()
                        await self.page.wait_for_timeout(500)
                except:
                    continue

            await self.log_session("Warm-up phase completed successfully", prompt_id)
            return True

        except Exception as e:
            await self.log_session(f"Warm-up error: {str(e)}", prompt_id)
            return False

    async def scrape_pins(
        self, prompt_text: str, prompt_id: str, max_pins: int = 25
    ) -> List[Dict]:
        """Scrape pins based on the prompt."""
        try:
            await self.log_session(
                f"Starting to scrape pins for: {prompt_text}", prompt_id
            )

            # Search for the prompt
            search_url = f"https://www.pinterest.com/search/pins/?q={prompt_text.replace(' ', '%20')}"
            await self.page.goto(search_url)
            await self.page.wait_for_load_state("networkidle")
            await self.page.wait_for_timeout(3000)

            pins_data = []
            pins_scraped = 0

            while pins_scraped < max_pins:
                # Get all pin elements
                pin_elements = await self.page.query_selector_all(
                    '[data-test-id="pin"]'
                )

                for pin_element in pin_elements:
                    if pins_scraped >= max_pins:
                        break

                    try:
                        # Extract pin data
                        pin_data = await self.extract_pin_data(pin_element)
                        if pin_data:
                            pin_data["prompt_id"] = prompt_id
                            pins_data.append(pin_data)
                            pins_scraped += 1
                            await self.log_session(
                                f"Scraped pin {pins_scraped}/{max_pins}", prompt_id
                            )

                    except Exception as e:
                        await self.log_session(
                            f"Error extracting pin data: {str(e)}", prompt_id
                        )
                        continue

                # Scroll down to load more pins
                if pins_scraped < max_pins:
                    await self.page.evaluate("window.scrollBy(0, 1000)")
                    await self.page.wait_for_timeout(2000)

                    # Check if we've reached the end
                    new_pin_count = len(
                        await self.page.query_selector_all('[data-test-id="pin"]')
                    )
                    if new_pin_count <= len(pin_elements):
                        break

            await self.log_session(
                f"Scraping completed. Found {len(pins_data)} pins", prompt_id
            )
            return pins_data

        except Exception as e:
            await self.log_session(f"Scraping error: {str(e)}", prompt_id)
            return []

    async def extract_pin_data(self, pin_element) -> Optional[Dict]:
        """Extract data from a single pin element."""
        try:
            # Get pin URL
            pin_link = await pin_element.query_selector('a[href*="/pin/"]')
            pin_url = await pin_link.get_attribute("href") if pin_link else ""
            if pin_url and not pin_url.startswith("http"):
                pin_url = f"https://www.pinterest.com{pin_url}"

            # Get image URL
            img_element = await pin_element.query_selector("img")
            image_url = await img_element.get_attribute("src") if img_element else ""

            # Get title/description
            title_element = await pin_element.query_selector(
                '[data-test-id="pin-title"]'
            )
            title = await title_element.text_content() if title_element else ""

            # Get description
            desc_element = await pin_element.query_selector(
                '[data-test-id="pin-description"]'
            )
            description = await desc_element.text_content() if desc_element else ""

            if image_url and pin_url:
                return {
                    "image_url": image_url,
                    "pin_url": pin_url,
                    "title": title.strip() if title else "",
                    "description": description.strip() if description else "",
                    "metadata": {"collected_at": datetime.utcnow()},
                }

            return None

        except Exception as e:
            logger.error(f"Error extracting pin data: {str(e)}")
            return None

    async def login_with_cookies(self) -> bool:
        """Login using session cookies to bypass login limits."""
        try:
            await self.log_session("Attempting login with session cookies...")

            # Get cookies from environment
            cookies_str = os.getenv("PINTEREST_COOKIES")
            if not cookies_str:
                await self.log_session("No session cookies found")
                return False

            # Parse cookies
            cookies = []
            for cookie in cookies_str.split(";"):
                if "=" in cookie:
                    name, value = cookie.strip().split("=", 1)
                    cookies.append(
                        {
                            "name": name,
                            "value": value,
                            "domain": ".pinterest.com",
                            "path": "/",
                        }
                    )

            # Set cookies
            await self.page.context.add_cookies(cookies)

            # Navigate to Pinterest
            await self.page.goto("https://www.pinterest.com/")
            await self.page.wait_for_load_state("networkidle")

            # Check if we're logged in
            if "login" not in self.page.url:
                await self.log_session("Successfully logged in with session cookies")
                return True
            else:
                await self.log_session("Session cookies expired or invalid")
                return False

        except Exception as e:
            await self.log_session(f"Cookie login error: {str(e)}")
            return False

    async def log_session(self, message: str, prompt_id: str = None):
        """Log a message to the session."""
        logger.info(message)
        print(f"[Pinterest Service] {message}")

        # Update session log in database if prompt_id is provided
        if prompt_id:
            try:
                collection = get_collection(SESSIONS_COLLECTION)
                # Find the latest session for this prompt and stage
                latest_session = await collection.find_one(
                    {"prompt_id": prompt_id}, sort=[("timestamp", -1)]
                )
                if latest_session:
                    await collection.update_one(
                        {"_id": latest_session["_id"]}, {"$push": {"log": message}}
                    )
            except Exception as e:
                logger.error(f"Failed to update session log: {str(e)}")


async def run_pinterest_workflow(prompt_id: str, prompt_text: str) -> bool:
    """Run the complete Pinterest workflow (warm-up + scraping + auto-trigger AI validation)."""
    async with PinterestService() as pinterest:
        try:
            # Warm-up phase
            await update_session_status(
                prompt_id, SessionStage.WARMUP, SessionStatus.PENDING
            )
            warmup_success = await pinterest.warm_up_account(prompt_text, prompt_id)

            if warmup_success:
                await update_session_status(
                    prompt_id, SessionStage.WARMUP, SessionStatus.COMPLETED
                )
            else:
                await update_session_status(
                    prompt_id, SessionStage.WARMUP, SessionStatus.FAILED
                )
                return False

            # Scraping phase
            await update_session_status(
                prompt_id, SessionStage.SCRAPING, SessionStatus.PENDING
            )
            pins_data = await pinterest.scrape_pins(prompt_text, prompt_id)

            if pins_data:
                # Save pins to database
                await save_pins_to_db(pins_data)
                await update_session_status(
                    prompt_id, SessionStage.SCRAPING, SessionStatus.COMPLETED
                )

                # Auto-trigger AI validation
                logger.info(
                    f"Pinterest workflow completed. Auto-triggering AI validation for prompt {prompt_id}"
                )
                from .ai_validation_service import run_ai_validation

                await run_ai_validation(prompt_id)
                return True
            else:
                await update_session_status(
                    prompt_id, SessionStage.SCRAPING, SessionStatus.FAILED
                )
                return False

        except Exception as e:
            logger.error(f"Pinterest workflow error: {str(e)}")
            return False


async def update_session_status(
    prompt_id: str, stage: SessionStage, status: SessionStatus
):
    """Update session status in the database."""
    try:
        collection = get_collection(SESSIONS_COLLECTION)
        session_doc = {
            "prompt_id": prompt_id,
            "stage": stage,
            "status": status,
            "timestamp": datetime.utcnow(),
            "log": [],
        }
        await collection.insert_one(session_doc)
    except Exception as e:
        logger.error(f"Error updating session status: {str(e)}")


async def save_pins_to_db(pins_data: List[Dict]):
    """Save scraped pins to the database."""
    try:
        collection = get_collection(PINS_COLLECTION)

        # Convert to PinDB format (without match_score and status yet)
        pin_docs = []
        for pin_data in pins_data:
            pin_doc = {
                **pin_data,
                "match_score": 0.0,  # Will be updated by AI validation
                "status": "pending",  # Will be updated by AI validation
                "ai_explanation": "",  # Will be updated by AI validation
            }
            pin_docs.append(pin_doc)

        if pin_docs:
            await collection.insert_many(pin_docs)
            logger.info(f"Saved {len(pin_docs)} pins to database")

    except Exception as e:
        logger.error(f"Error saving pins to database: {str(e)}")
