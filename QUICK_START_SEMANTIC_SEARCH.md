# Quick Start Guide - Semantic Search

## For Users

### How to Use
The search works exactly the same as before - just type your query in the search bar!

**Examples:**
- "fresh milk" → finds all milk products
- "pasta sauce" → finds marinara, tomato sauce, spaghetti sauce
- "organic vegetables" → finds organic veggie products

### Search with Filters
You can combine search with filters:
- Search + Category: "coffee" in "Beverages"
- Search + Store: "bread" at "IGA"
- Search + Brand: "yogurt" from "Chobani"

### What's New?
- Better results for general queries
- Understands synonyms and related terms
- More relevant results ranked at the top
- Still works the same way!

---

## For Developers

### Quick Setup

1. **Ensure Pinecone API Key is Set**
   ```bash
   export PINECONE_API_KEY="your_key_here"
   # or add to .env file
   ```

2. **Migrate Products to Pinecone**
   ```bash
   cd backend
   python3 migrate_vector.py
   ```

3. **Start Backend**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

4. **Test Vector Search**
   ```bash
   cd backend
   python3 test_vector_search.py
   ```

### API Usage

**Basic Search**
```bash
curl "http://localhost:8000/api/products?search=milk&limit=10"
```

**Search with Filters**
```bash
curl "http://localhost:8000/api/products?search=bread&store=IGA&category=Bakery"
```

**Response Format** (unchanged)
```json
{
  "products": [...],
  "total": 50,
  "page": 1,
  "pages": 5,
  "limit": 10
}
```

### Frontend Integration

**No changes required!** The frontend continues to use the same API:

```typescript
// In your React/Next.js component
const response = await apiClient.getProducts({
  search: "milk",
  category: "Dairy",
  store: "IGA",
  page: 1,
  limit: 30
});
```

### Configuration

**Environment Variables**
```bash
PINECONE_API_KEY=your_key_here          # Required
PINECONE_INDEX_NAME=grocery-products     # Optional
VECTOR_SEARCH_TOP_K=50                   # Optional
VECTOR_SEARCH_SCORE_THRESHOLD=0.6        # Optional
```

**Adjust Settings** (in `backend/app/config.py`)
```python
PINECONE_INDEX_NAME = "grocery-products"  # Index name
VECTOR_SEARCH_TOP_K = 50                  # Max results from Pinecone
VECTOR_SEARCH_SCORE_THRESHOLD = 0.6       # Min similarity score (0-1)
```

### How It Works

```
Search Query: "fresh milk"
      ↓
Convert to Embedding (384 dimensions)
      ↓
Search Pinecone (cosine similarity)
      ↓
Filter by score ≥ 0.6
      ↓
Apply category/store/brand filters
      ↓
Fetch full details from database
      ↓
Sort & paginate
      ↓
Return results
```

### Fallback Behavior

If Pinecone is unavailable, the system automatically falls back to SQL LIKE search:
- No user-visible errors
- Search still works
- Check logs for "Vector search unavailable" message

### Troubleshooting

**No results?**
1. Check if Pinecone API key is set
2. Verify products are migrated: `python3 migrate_vector.py`
3. Check Pinecone dashboard for index status

**Slow search?**
1. Reduce `VECTOR_SEARCH_TOP_K` value
2. Check Pinecone plan limits
3. Monitor network latency

**Irrelevant results?**
1. Increase `VECTOR_SEARCH_SCORE_THRESHOLD` (e.g., 0.7 or 0.75)
2. Re-run migration to update embeddings
3. Check product names are descriptive

### Monitoring

**Check Vector Search Status**
```bash
curl http://localhost:8000/health
```

**View Logs**
```bash
# Look for these startup messages:
✅ Vector search service initialized
⚠️  Vector search unavailable, will use fallback SQL search
```

**Pinecone Dashboard**
- Monitor vector count
- Check API usage
- View query performance

### Testing

**Unit Tests**
```bash
cd backend
python3 test_vector_search.py
```

**API Tests** (requires running server)
```bash
cd backend
python3 test_api_search.py
```

### Maintenance

**Update Products**
When adding/modifying products, refresh Pinecone:
```bash
cd backend
python3 migrate_vector.py
```

**Monitor Performance**
- Track search response times
- Monitor Pinecone usage
- Review fallback frequency

---

## Key Points

✅ **Backward Compatible**: Existing code works without changes
✅ **Automatic Fallback**: Works even if Pinecone fails
✅ **Zero Frontend Changes**: API contract unchanged
✅ **Better Results**: Semantic understanding improves relevance
✅ **Production Ready**: Error handling and logging included

## Need Help?

- 📖 Full docs: `backend/VECTOR_SEARCH.md`
- 🔧 Implementation details: `SEMANTIC_SEARCH_IMPLEMENTATION.md`
- 🧪 Test scripts: `backend/test_vector_search.py`, `backend/test_api_search.py`
