# MongoDB Schema & Filtering Logic

## 📊 Database Overview

- **Database Name**: `pinterest_ai`
- **Collections**: 3 main collections
- **Current Data**: 17 prompts, 85 sessions, 379 pins

## 🗄️ Collection Schemas

### 1. Prompts Collection

**Collection**: `prompts`

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated ID
  text: String,                     // User's visual prompt (e.g., "boho minimalist bedroom")
  created_at: ISODate,              // Timestamp when prompt was created
  status: String                    // "pending" | "processing" | "completed" | "error"
}
```

**Example Document**:
```json
{
  "_id": "6887130234fcce3a69be6d99",
  "text": "thailand parties",
  "created_at": "2025-07-28T06:04:50.651Z",
  "status": "completed"
}
```

### 2. Sessions Collection

**Collection**: `sessions`

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated ID
  prompt_id: String,                // Reference to prompt ObjectId
  stage: String,                    // "warmup" | "scraping" | "validation"
  status: String,                   // "pending" | "completed" | "failed"
  timestamp: ISODate,               // When this session stage started
  log: [String]                     // Array of log messages for this stage
}
```

**Example Document**:
```json
{
  "_id": "6887130434fcce3a69be6d9a",
  "prompt_id": "6887130234fcce3a69be6d99",
  "stage": "warmup",
  "status": "pending",
  "timestamp": "2025-07-28T06:04:52.019Z",
  "log": [
    "Starting Pinterest warm-up phase...",
    "Searching for related terms...",
    "..."
  ]
}
```

### 3. Pins Collection

**Collection**: `pins`

```javascript
{
  _id: ObjectId,                    // MongoDB auto-generated ID
  prompt_id: String,                // Reference to prompt ObjectId
  image_url: String,                // Pinterest image URL
  pin_url: String,                  // Pinterest pin page URL
  title: String,                    // Pin title (can be empty)
  description: String,              // Pin description (can be empty)
  match_score: Number,              // AI validation score (0.0-1.0)
  status: String,                   // "approved" | "disqualified"
  ai_explanation: String,           // AI reasoning for the score
  metadata: {                       // Additional metadata
    collected_at: ISODate,          // When pin was scraped
    board_name: String,             // Pinterest board name (optional)
    pin_id: String                  // Pinterest pin ID (optional)
  }
}
```

**Example Document**:
```json
{
  "_id": "6887132934fcce3a69be6d9d",
  "prompt_id": "6887130234fcce3a69be6d99",
  "image_url": "https://i.pinimg.com/236x/77/3b/ac/773bacba699bc9a...",
  "pin_url": "https://www.pinterest.com/pin/20829217021334495/",
  "title": "",
  "description": "",
  "match_score": 0.9,
  "status": "approved",
  "ai_explanation": "The image depicts a lively beach party scene with ...",
  "metadata": {
    "collected_at": "2025-07-28T06:05:13.456Z"
  }
}
```

## 🔍 Filtering Logic Implementation

### 1. Basic CRUD Operations

#### Create Prompt
```python
# routes/prompts.py:26-30
prompt_doc = {
    "text": prompt.text,
    "created_at": datetime.utcnow(),
    "status": "pending",
}
result = await collection.insert_one(prompt_doc)
```

#### Get Single Prompt
```python
# routes/prompts.py:62
prompt = await collection.find_one({"_id": ObjectId(prompt_id)})
```

#### List Prompts with Pagination
```python
# routes/prompts.py:90
cursor = collection.find().sort("created_at", -1).skip(skip).limit(limit)
```

### 2. Status-Based Filtering

#### Filter Pins by Status
```python
# routes/prompts.py:288-290
query = {"prompt_id": prompt_id}
if status and status in ["approved", "disqualified", "pending"]:
    query["status"] = status
```

**API Usage**: `GET /api/prompts/{prompt_id}/pins?status=approved`

### 3. Complex Queries

#### Delete Cascade (Prompt + Related Data)
```python
# routes/prompts.py:124-136
await prompts_collection.delete_one({"_id": ObjectId(prompt_id)})
await sessions_collection.delete_many({"prompt_id": prompt_id})
await pins_collection.delete_many({"prompt_id": prompt_id})
```

#### Count Pending Pins for Validation
```python
# routes/prompts.py:210-212
pending_pins = await pins_collection.count_documents(
    {"prompt_id": prompt_id, "status": "pending"}
)
```

### 4. Sorting Logic

#### Pins by Match Score (Highest First)
```python
# routes/prompts.py:294
cursor = collection.find(query).sort("match_score", -1)
```

#### Sessions by Timestamp (Chronological)
```python
# routes/prompts.py:251
cursor = collection.find({"prompt_id": prompt_id}).sort("timestamp", 1)
```

## 📈 Current Data Statistics

Based on actual database content:

### Pin Status Distribution
- **Approved pins**: 335 (88.4%)
- **Disqualified pins**: 44 (11.6%)
- **Total pins**: 379

### Match Score Analysis
- **High scores (≥0.8)**: Most pins have high confidence scores
- **Validation threshold**: 0.5 (configurable)
- **Top scoring pins**: Multiple pins with perfect 1.0 scores

### Sample Prompt Analysis
- **Prompt ID**: `6887130234fcce3a69be6d99` ("thailand parties")
- **Total pins**: 25
- **Approved**: 24 (96% approval rate)
- **High success rate**: Indicates good warm-up and AI validation

## 🔧 Available Filter Operations

### 1. Pin Filtering Options

```python
# Status filtering
{"status": "approved"}          # Only approved pins
{"status": "disqualified"}      # Only rejected pins
{"status": "pending"}           # Pins waiting for validation

# Score range filtering (custom implementation needed)
{"match_score": {"$gte": 0.8}}              # High confidence
{"match_score": {"$gte": 0.5, "$lt": 0.8}}  # Medium confidence
{"match_score": {"$lt": 0.5}}                # Low confidence

# Combined filters
{
  "prompt_id": "6887130234fcce3a69be6d99",
  "status": "approved",
  "match_score": {"$gte": 0.7}
}
```

### 2. Session Filtering

```python
# By prompt
{"prompt_id": prompt_id}

# By stage
{"stage": "warmup"}    # Warm-up sessions only
{"stage": "scraping"}  # Scraping sessions only
{"stage": "validation"} # Validation sessions only

# By status
{"status": "completed"}  # Successful sessions
{"status": "failed"}     # Failed sessions
{"status": "pending"}    # In-progress sessions
```

### 3. Advanced Queries

```python
# Aggregation pipeline example (for analytics)
pipeline = [
    {"$match": {"prompt_id": prompt_id}},
    {"$group": {
        "_id": "$status",
        "avg_score": {"$avg": "$match_score"},
        "count": {"$sum": 1}
    }},
    {"$sort": {"avg_score": -1}}
]
```

## 📝 API Endpoints Summary

| Endpoint | Method | Filtering Capabilities |
|----------|--------|----------------------|
| `/api/prompts/` | GET | Pagination (skip, limit) |
| `/api/prompts/{id}` | GET | Single document by ID |
| `/api/prompts/{id}/pins` | GET | Status filter, sorted by match_score |
| `/api/prompts/{id}/sessions` | GET | All sessions for prompt, chronological |
| `/api/prompts/{id}/start-workflow` | POST | Triggers background processing |
| `/api/prompts/{id}/validate` | POST | Validates pending pins only |