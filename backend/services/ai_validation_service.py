import os
import asyncio
import logging
from typing import List, Dict, Optional
from datetime import datetime
import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv

from models import PinDB, PinStatus
from database import (
    get_collection,
    PINS_COLLECTION,
    PROMPTS_COLLECTION,
    SESSIONS_COLLECTION,
)

load_dotenv()

logger = logging.getLogger(__name__)


class AIValidationService:
    def __init__(self):
        self.api_key = os.getenv("AI_API_KEY")
        if not self.api_key:
            raise ValueError("AI_API_KEY environment variable is required")

        self.client = AsyncOpenAI(api_key=self.api_key)

    async def validate_pin(self, pin_data: Dict, prompt_text: str) -> Dict:
        """Validate a single pin against the prompt using AI."""
        try:
            # Prepare the validation prompt
            validation_prompt = f"""
            Analyze this image and determine how well it matches the visual prompt: "{prompt_text}"
            
            Consider:
            1. Visual style and aesthetic
            2. Content and subject matter
            3. Color scheme and mood
            4. Overall relevance to the prompt
            5. Quality and clarity of the image
            6. Specificity of match (generic vs. specific to prompt)
            
            Be STRICT in your evaluation. Only approve images that are:
            - Highly relevant to the specific prompt
            - Show the exact style/aesthetic mentioned
            - Have good visual quality
            - Are not generic or loosely related
            
            Provide:
            1. A match score from 0.0 to 1.0 (where 1.0 is perfect match)
            2. A brief explanation of your reasoning
            3. Classification: "approved" if score >= 0.5, "disqualified" if score < 0.5
            
            Format your response as JSON:
            {{
                "match_score": 0.85,
                "explanation": "This image shows a minimalist bedroom with clean lines, neutral colors, and simple furniture that perfectly matches the prompt.",
                "classification": "approved"
            }}
            """

            # Get the image URL
            image_url = pin_data.get("image_url")
            if not image_url:
                return {
                    "match_score": 0.0,
                    "explanation": "No image URL provided",
                    "classification": "disqualified",
                }

            # Call OpenAI API for image analysis
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": validation_prompt},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    }
                ],
                max_tokens=500,
                temperature=0.1,  # Low temperature for consistent results
            )

            # Parse the response
            ai_response = response.choices[0].message.content

            # Try to extract JSON from the response
            try:
                import json

                # Find JSON in the response (in case there's extra text)
                start_idx = ai_response.find("{")
                end_idx = ai_response.rfind("}") + 1
                if start_idx != -1 and end_idx != 0:
                    json_str = ai_response[start_idx:end_idx]
                    result = json.loads(json_str)

                    # Validate the response format
                    match_score = float(result.get("match_score", 0.0))
                    explanation = result.get("explanation", "No explanation provided")
                    classification = result.get("classification", "disqualified")

                    # Ensure classification is correct based on score
                    if match_score >= 0.5 and classification != "approved":
                        classification = "approved"
                    elif match_score < 0.5 and classification != "disqualified":
                        classification = "disqualified"

                    return {
                        "match_score": match_score,
                        "explanation": explanation,
                        "classification": classification,
                    }
                else:
                    raise ValueError("No JSON found in response")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse AI response: {e}")
                # Fallback: try to extract score from text
                return self._extract_score_from_text(ai_response, prompt_text)

        except Exception as e:
            logger.error(f"AI validation error for pin {pin_data.get('_id')}: {str(e)}")
            return {
                "match_score": 0.0,
                "explanation": f"AI validation failed: {str(e)}",
                "classification": "disqualified",
            }

    def _extract_score_from_text(self, text: str, prompt_text: str) -> Dict:
        """Fallback method to extract score from AI response text."""
        try:
            # Look for score patterns in the text
            import re

            # Look for numbers between 0 and 1
            score_match = re.search(r"(\d+\.?\d*)", text)
            if score_match:
                score = float(score_match.group(1))
                if score > 1.0:
                    score = score / 100.0  # Convert percentage to decimal
                score = max(0.0, min(1.0, score))  # Clamp between 0 and 1
            else:
                score = 0.5  # Default score

            # Determine classification
            classification = "approved" if score >= 0.5 else "disqualified"

            return {
                "match_score": score,
                "explanation": f"Extracted from AI response: {text[:200]}...",
                "classification": classification,
            }

        except Exception as e:
            logger.error(f"Score extraction error: {e}")
            return {
                "match_score": 0.0,
                "explanation": "Failed to extract score from AI response",
                "classification": "disqualified",
            }

    async def validate_pins_batch(
        self, prompt_id: str, max_concurrent: int = 5
    ) -> Dict:
        """Validate all pins for a given prompt in batches."""
        try:
            # Get the prompt text
            prompts_collection = get_collection(PROMPTS_COLLECTION)
            from bson import ObjectId

            prompt = await prompts_collection.find_one({"_id": ObjectId(prompt_id)})
            if not prompt:
                raise ValueError(f"Prompt {prompt_id} not found")

            prompt_text = prompt["text"]

            # Get all pending pins for this prompt
            pins_collection = get_collection(PINS_COLLECTION)
            pending_pins = await pins_collection.find(
                {"prompt_id": prompt_id, "status": "pending"}
            ).to_list(length=None)

            if not pending_pins:
                logger.info(f"No pending pins found for prompt {prompt_id}")
                return {
                    "total_pins": 0,
                    "validated_pins": 0,
                    "approved_pins": 0,
                    "disqualified_pins": 0,
                }

            logger.info(
                f"Starting validation of {len(pending_pins)} pins for prompt: {prompt_text}"
            )

            # Update session with validation start
            try:
                collection = get_collection(SESSIONS_COLLECTION)
                await collection.insert_one(
                    {
                        "prompt_id": prompt_id,
                        "stage": "validation",
                        "status": "pending",
                        "timestamp": datetime.utcnow(),
                        "log": [f"Starting AI validation of {len(pending_pins)} pins"],
                    }
                )
            except Exception as e:
                logger.error(f"Failed to create validation session: {str(e)}")

            # Process pins in batches to avoid rate limits
            semaphore = asyncio.Semaphore(max_concurrent)
            validated_count = 0
            approved_count = 0
            disqualified_count = 0

            async def validate_single_pin(pin_data):
                nonlocal validated_count, approved_count, disqualified_count

                async with semaphore:
                    try:
                        # Validate the pin
                        validation_result = await self.validate_pin(
                            pin_data, prompt_text
                        )

                        # Update the pin in database
                        await pins_collection.update_one(
                            {"_id": pin_data["_id"]},
                            {
                                "$set": {
                                    "match_score": validation_result["match_score"],
                                    "status": validation_result["classification"],
                                    "ai_explanation": validation_result["explanation"],
                                }
                            },
                        )

                        # Update counters
                        validated_count += 1
                        if validation_result["classification"] == "approved":
                            approved_count += 1
                        else:
                            disqualified_count += 1

                        logger.info(
                            f"Validated pin {validated_count}/{len(pending_pins)} - Score: {validation_result['match_score']:.2f} - {validation_result['classification']}"
                        )

                        # Update session log with progress
                        try:
                            session_collection = get_collection(SESSIONS_COLLECTION)
                            latest_session = await session_collection.find_one(
                                {"prompt_id": prompt_id, "stage": "validation"},
                                sort=[("timestamp", -1)],
                            )
                            if latest_session:
                                await session_collection.update_one(
                                    {"_id": latest_session["_id"]},
                                    {
                                        "$push": {
                                            "log": f"Validated pin {validated_count}/{len(pending_pins)} - {validation_result['classification']}"
                                        }
                                    },
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to update validation session log: {str(e)}"
                            )

                    except Exception as e:
                        logger.error(
                            f"Error validating pin {pin_data.get('_id')}: {str(e)}"
                        )

            # Create tasks for all pins
            tasks = [validate_single_pin(pin) for pin in pending_pins]

            # Wait for all validations to complete
            await asyncio.gather(*tasks, return_exceptions=True)

            # Update prompt status to completed
            await prompts_collection.update_one(
                {"_id": ObjectId(prompt_id)}, {"$set": {"status": "completed"}}
            )

            # Mark validation session as completed
            try:
                session_collection = get_collection(SESSIONS_COLLECTION)
                latest_session = await session_collection.find_one(
                    {"prompt_id": prompt_id, "stage": "validation"},
                    sort=[("timestamp", -1)],
                )
                if latest_session:
                    await session_collection.update_one(
                        {"_id": latest_session["_id"]},
                        {
                            "$set": {"status": "completed"},
                            "$push": {
                                "log": f"AI validation completed! Approved: {approved_count}, Disqualified: {disqualified_count}"
                            },
                        },
                    )
            except Exception as e:
                logger.error(f"Failed to update validation session status: {str(e)}")

            result = {
                "total_pins": len(pending_pins),
                "validated_pins": validated_count,
                "approved_pins": approved_count,
                "disqualified_pins": disqualified_count,
            }

            logger.info(f"Validation completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Batch validation error: {str(e)}")
            # Update prompt status to error
            prompts_collection = get_collection(PROMPTS_COLLECTION)
            await prompts_collection.update_one(
                {"_id": ObjectId(prompt_id)}, {"$set": {"status": "error"}}
            )
            raise


async def run_ai_validation(prompt_id: str) -> bool:
    """Run AI validation for all pins of a prompt."""
    try:
        service = AIValidationService()
        result = await service.validate_pins_batch(prompt_id)
        return result["validated_pins"] > 0
    except Exception as e:
        logger.error(f"AI validation workflow error: {str(e)}")
        return False
