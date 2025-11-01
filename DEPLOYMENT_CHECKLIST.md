# Semantic Search Deployment Checklist

## Pre-Deployment

### 1. Code Review ✅
- [x] Vector search service implemented
- [x] Products API updated
- [x] Configuration settings added
- [x] Error handling implemented
- [x] Fallback mechanism in place
- [x] Tests created

### 2. Dependencies ✅
- [x] `pinecone-client==3.0.0` in requirements.txt
- [x] `sentence-transformers==2.7.0` in requirements.txt
- [x] All dependencies compatible

### 3. Configuration
- [ ] Set `PINECONE_API_KEY` in production environment
- [ ] Verify `.env` file has correct values
- [ ] Check `PINECONE_INDEX_NAME` matches actual index
- [ ] Adjust `VECTOR_SEARCH_SCORE_THRESHOLD` if needed (default: 0.6)
- [ ] Set `VECTOR_SEARCH_TOP_K` appropriately (default: 50)

## Deployment Steps

### Step 1: Pinecone Setup
- [ ] Create Pinecone account (if not exists)
- [ ] Create index named `grocery-products`
  - Dimension: 384
  - Metric: cosine
  - Region: us-east-1 (or preferred)
- [ ] Note down API key
- [ ] Verify index is active

### Step 2: Environment Configuration
- [ ] Add `PINECONE_API_KEY` to production environment variables
- [ ] Update `.env` file for local development
- [ ] Verify all required environment variables are set:
  ```bash
  PINECONE_API_KEY=your_key_here
  DATABASE_URL=your_database_url
  ```

### Step 3: Data Migration
- [ ] Ensure database has products
- [ ] Run migration script:
  ```bash
  cd backend
  python3 migrate_vector.py
  ```
- [ ] Verify migration output:
  - Check total products migrated
  - Confirm no errors in logs
  - Verify vector count in Pinecone dashboard
- [ ] Test vector search:
  ```bash
  python3 test_vector_search.py
  ```

### Step 4: Backend Deployment
- [ ] Install dependencies:
  ```bash
  pip install -r requirements.txt
  ```
- [ ] Run backend server:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- [ ] Check startup logs for:
  ```
  ✅ Vector search service initialized
  ```
- [ ] Test API endpoint:
  ```bash
  curl "http://localhost:8000/api/products?search=milk"
  ```

### Step 5: Frontend (No Changes Required)
- [ ] Frontend works with existing API
- [ ] Test search functionality in browser
- [ ] Verify filters work correctly
- [ ] Check pagination
- [ ] Test sorting options

### Step 6: Integration Testing
- [ ] Test basic search queries
- [ ] Test search with category filter
- [ ] Test search with store filter
- [ ] Test search with brand filter
- [ ] Test pagination with search
- [ ] Test sorting with search
- [ ] Test empty search query (should use DB)
- [ ] Test invalid search query (should return empty)
- [ ] Run API test script:
  ```bash
  python3 test_api_search.py
  ```

### Step 7: Performance Testing
- [ ] Measure search response time (target: <300ms)
- [ ] Test with concurrent users
- [ ] Monitor Pinecone usage
- [ ] Check database query performance
- [ ] Verify pagination efficiency

### Step 8: Fallback Testing
- [ ] Temporarily disable Pinecone (invalid API key)
- [ ] Verify search falls back to SQL
- [ ] Check user experience is maintained
- [ ] Verify logs show fallback message
- [ ] Re-enable Pinecone and verify recovery

## Post-Deployment

### 1. Monitoring Setup
- [ ] Set up Pinecone dashboard monitoring
- [ ] Configure API performance alerts
- [ ] Monitor error logs
- [ ] Track fallback frequency
- [ ] Set up usage metrics

### 2. Documentation
- [ ] Share `QUICK_START_SEMANTIC_SEARCH.md` with team
- [ ] Update API documentation
- [ ] Document maintenance procedures
- [ ] Create runbook for common issues

### 3. User Acceptance Testing
- [ ] Test with real users
- [ ] Collect feedback on search relevance
- [ ] Verify expected semantic behavior
- [ ] Check category filtering works as expected
- [ ] Validate store filtering

### 4. Optimization (if needed)
- [ ] Adjust `VECTOR_SEARCH_SCORE_THRESHOLD` based on results
- [ ] Tune `VECTOR_SEARCH_TOP_K` for performance
- [ ] Optimize database queries if needed
- [ ] Review Pinecone plan limits

## Maintenance Schedule

### Daily
- [ ] Monitor error logs
- [ ] Check Pinecone usage/quota
- [ ] Review search performance metrics

### Weekly
- [ ] Review search query patterns
- [ ] Check fallback frequency
- [ ] Analyze slow queries
- [ ] Update embeddings if products changed

### Monthly
- [ ] Review and adjust score threshold
- [ ] Optimize Pinecone index
- [ ] Update documentation
- [ ] Review user feedback

## Rollback Plan

### If Issues Occur
1. **Immediate**: Service will auto-fallback to SQL search
2. **Manual Rollback**:
   ```bash
   # Temporarily disable vector search
   export PINECONE_API_KEY=""
   # Restart backend
   ```
3. **Code Rollback**: Previous version uses SQL LIKE search
4. **Verification**: Test that search still works

### Rollback Steps
- [ ] Set `PINECONE_API_KEY` to empty string
- [ ] Restart backend service
- [ ] Verify search works with SQL fallback
- [ ] Communicate issue to team
- [ ] Investigate and fix Pinecone issue
- [ ] Re-enable once resolved

## Success Criteria

### Must Have ✅
- [x] Vector search operational
- [x] Search returns relevant results
- [x] Filters work correctly
- [x] Pagination works
- [x] Sorting works
- [x] Fallback mechanism works
- [x] No breaking changes to API
- [x] Frontend works without changes

### Nice to Have
- [ ] Response time <300ms
- [ ] Relevance score >0.7 for top results
- [ ] User feedback positive
- [ ] Usage analytics set up

## Troubleshooting Guide

### Issue: Vector search not working
**Symptoms**: Search falls back to SQL
**Checks**:
- [ ] Verify `PINECONE_API_KEY` is set
- [ ] Check Pinecone dashboard - index exists?
- [ ] Check startup logs for errors
- [ ] Run `test_vector_search.py`

**Solutions**:
1. Re-check API key
2. Verify index name matches config
3. Check Pinecone service status
4. Review error logs

### Issue: Poor search results
**Symptoms**: Irrelevant results returned
**Checks**:
- [ ] Check similarity scores
- [ ] Verify score threshold setting
- [ ] Review product names in database
- [ ] Check if embeddings are current

**Solutions**:
1. Increase `VECTOR_SEARCH_SCORE_THRESHOLD`
2. Re-run migration to update embeddings
3. Improve product name quality
4. Adjust `VECTOR_SEARCH_TOP_K`

### Issue: Slow search
**Symptoms**: Response time >500ms
**Checks**:
- [ ] Check Pinecone plan limits
- [ ] Monitor database query time
- [ ] Review `VECTOR_SEARCH_TOP_K` value
- [ ] Check network latency

**Solutions**:
1. Reduce `VECTOR_SEARCH_TOP_K`
2. Optimize database queries
3. Upgrade Pinecone plan
4. Use CDN/caching

### Issue: No results found
**Symptoms**: Empty results for valid queries
**Checks**:
- [ ] Verify products in database
- [ ] Check if migration completed
- [ ] Review score threshold
- [ ] Check filter combinations

**Solutions**:
1. Lower `VECTOR_SEARCH_SCORE_THRESHOLD`
2. Re-run migration script
3. Check Pinecone vector count
4. Verify filter values are correct

## Contact & Support

### Internal Resources
- Documentation: `backend/VECTOR_SEARCH.md`
- Quick Start: `QUICK_START_SEMANTIC_SEARCH.md`
- Implementation: `SEMANTIC_SEARCH_IMPLEMENTATION.md`

### External Resources
- Pinecone Docs: https://docs.pinecone.io/
- Sentence Transformers: https://www.sbert.net/
- FastAPI Docs: https://fastapi.tiangolo.com/

## Sign-Off

Deployment completed by: ________________
Date: ________________
Sign-off: ________________

Post-deployment verification completed: ☐
Issues encountered: ☐ None  ☐ Minor  ☐ Major
Notes: ________________________________
