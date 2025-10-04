-- Migration: Add semantic categorization to capabilities table
-- This enables database-driven intent matching instead of string pattern matching

-- Add semantic columns to capabilities table
ALTER TABLE capabilities
ADD COLUMN IF NOT EXISTS intent_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS semantic_tags TEXT[],
ADD COLUMN IF NOT EXISTS context_type VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN capabilities.intent_category IS 'Primary intent category (e.g., time_query, academic_research, weather_query)';
COMMENT ON COLUMN capabilities.semantic_tags IS 'Array of semantic keywords for flexible matching';
COMMENT ON COLUMN capabilities.context_type IS 'Additional context to distinguish similar capabilities (e.g., current_time vs historical_time)';

-- Create indexes for fast semantic lookups
CREATE INDEX IF NOT EXISTS idx_capabilities_intent_category ON capabilities(intent_category);
CREATE INDEX IF NOT EXISTS idx_capabilities_semantic_tags ON capabilities USING GIN(semantic_tags);
CREATE INDEX IF NOT EXISTS idx_capabilities_context_type ON capabilities(context_type);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_capabilities_intent_context ON capabilities(intent_category, context_type);

-- Populate initial semantic data for time-related capabilities
-- First, let's categorize genuine time capabilities

-- Current time capabilities
UPDATE capabilities
SET
    intent_category = 'time_query',
    semantic_tags = ARRAY['time', 'current', 'now'],
    context_type = 'current_time'
WHERE capability_name IN (
    'current_time',
    'get_current_time',
    'get_current_datetime',
    'get_time',
    'time'
);

-- Time conversion capabilities
UPDATE capabilities
SET
    intent_category = 'time_query',
    semantic_tags = ARRAY['time', 'conversion', 'timezone'],
    context_type = 'time_conversion'
WHERE capability_name IN (
    'convert_time',
    'timezone_lookup',
    'get_timestamp'
);

-- Relative time capabilities
UPDATE capabilities
SET
    intent_category = 'time_query',
    semantic_tags = ARRAY['time', 'relative', 'calculation'],
    context_type = 'relative_time'
WHERE capability_name IN (
    'relative_time',
    'days_in_month',
    'get_week_year'
);

-- Mark financial time series as NOT time_query
UPDATE capabilities
SET
    intent_category = 'financial_data',
    semantic_tags = ARRAY['finance', 'historical', 'data', 'series'],
    context_type = 'time_series'
WHERE capability_name LIKE '%time_series%'
   OR capability_name LIKE '%TimeSeries%';

-- Mark project management time tracking as NOT time_query
UPDATE capabilities
SET
    intent_category = 'project_management',
    semantic_tags = ARRAY['tracking', 'productivity', 'tasks', 'management'],
    context_type = 'time_tracking'
WHERE capability_name LIKE '%time_tracking%'
   OR capability_name LIKE '%time_entry%'
   OR capability_name LIKE '%timeEntry%';

-- Mark realtime data streams as NOT time_query
UPDATE capabilities
SET
    intent_category = 'data_streaming',
    semantic_tags = ARRAY['streaming', 'live', 'data', 'realtime'],
    context_type = 'realtime_data'
WHERE capability_name LIKE '%realtime%'
   OR capability_name LIKE '%real_time%';

-- Add book/literature capabilities
UPDATE capabilities
SET
    intent_category = 'book_query',
    semantic_tags = ARRAY['books', 'literature', 'reading', 'authors'],
    context_type = 'book_search'
WHERE capability_name IN (
    'book_search',
    'author_search',
    'search_books_tool',
    'list_books',
    'get_book_summary',
    'get_book_details',
    'get_book_by_title',
    'get_authors_by_name'
);

-- Add weather capabilities
UPDATE capabilities
SET
    intent_category = 'weather_query',
    semantic_tags = ARRAY['weather', 'forecast', 'climate', 'meteorology'],
    context_type = 'weather_data'
WHERE capability_name LIKE '%weather%'
   OR capability_name LIKE '%forecast%'
   OR capability_name = 'get_current_datetime' -- Weather servers often provide datetime
   AND intent_category IS NULL; -- Don't override existing categorizations

-- Add academic research capabilities
UPDATE capabilities
SET
    intent_category = 'academic_research',
    semantic_tags = ARRAY['papers', 'research', 'academic', 'scientific'],
    context_type = 'research_papers'
WHERE capability_name LIKE '%paper%'
   OR capability_name LIKE '%research%'
   OR capability_name LIKE '%academic%'
   OR capability_name LIKE '%scientific%'
   AND NOT (capability_name LIKE '%paper_trading%'); -- Exclude financial "paper" trading

-- Mark financial timestamps as financial_data, not time_query
UPDATE capabilities
SET
    intent_category = 'financial_data',
    semantic_tags = ARRAY['finance', 'timestamp', 'market'],
    context_type = 'financial_timestamp'
WHERE capability_name IN ('current_timestamp')
  AND EXISTS (
    SELECT 1 FROM server_capabilities sc
    JOIN smithery_mcp_servers s ON sc.server_id = s.id
    WHERE sc.capability_id = capabilities.id
    AND (s.name ILIKE '%finance%' OR s.description ILIKE '%financial%')
  );

-- Verify the changes
SELECT
    intent_category,
    context_type,
    COUNT(*) as capability_count,
    ARRAY_AGG(capability_name ORDER BY capability_name) as sample_capabilities
FROM capabilities
WHERE intent_category IS NOT NULL
GROUP BY intent_category, context_type
ORDER BY intent_category, context_type;