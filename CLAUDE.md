## Project Memories

- Do not modify or touch the MOD09GA pipeline

## Bug Memory: Earth Engine "image.clip is not a function"

**Problem**: Error "image.clip is not a function" when using Terra/Aqua daily compositing in Earth Engine workflows.

**Root Cause**: The `distinct()` operation in Earth Engine returns invalid objects that aren't proper `ee.Image` instances, even though they pass through the collection pipeline.

**Specific Issue**: 
- `collection.distinct(['date_str'])` creates objects that look like images but lack ee.Image methods
- These invalid objects cause failures when `.clip()` or other image methods are called downstream
- Error appears to originate from the entry point file (comparison.js) but actual failure occurs later in processing pipeline

**Failed Attempts**:
1. Adding `ee.Image()` casting after distinct - doesn't fix fundamentally broken objects
2. Complex join logic with `ee.Algorithms.If()` - creates more invalid objects when handling null values
3. Server-side null checking - still problematic with distinct operation

**Working Solution**: 
Avoid `distinct()` entirely. Use simple `terra.merge(aqua).sort('system:time_start')` instead of complex daily compositing with distinct operations.

**Key Lesson**: 
`distinct()` in Earth Engine is unreliable for ImageCollections - it can corrupt objects. Always use alternative approaches like filtering, merging, and sorting instead.

**Property Note**: 
Use `system:id` not `system:index` for filtering MODIS collections. The `system:id` contains the full collection path (e.g., 'MODIS/061/MOD09GA/2017_06_01') while `system:index` only contains the date portion.