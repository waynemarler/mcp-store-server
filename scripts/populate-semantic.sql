-- Populate semantic data for intent categorization
-- This script adds semantic meaning to capabilities for database-driven categorization

-- First ensure columns exist
ALTER TABLE capabilities
ADD COLUMN IF NOT EXISTS intent_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS semantic_tags TEXT[],
ADD COLUMN IF NOT EXISTS context_type VARCHAR(50);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_capabilities_intent_category ON capabilities(intent_category);
CREATE INDEX IF NOT EXISTS idx_capabilities_semantic_tags ON capabilities USING GIN(semantic_tags);
CREATE INDEX IF NOT EXISTS idx_capabilities_context_type ON capabilities(context_type);

-- Categorize genuine time capabilities
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
WHERE (capability_name LIKE '%time_series%' OR capability_name LIKE '%TimeSeries%')
AND intent_category IS NULL;

-- Mark project management time tracking as NOT time_query
UPDATE capabilities
SET
    intent_category = 'project_management',
    semantic_tags = ARRAY['tracking', 'productivity', 'tasks', 'management'],
    context_type = 'time_tracking'
WHERE (capability_name LIKE '%time_tracking%' OR capability_name LIKE '%time_entry%' OR capability_name LIKE '%timeEntry%')
AND intent_category IS NULL;

-- Mark realtime data streams as NOT time_query
UPDATE capabilities
SET
    intent_category = 'data_streaming',
    semantic_tags = ARRAY['streaming', 'live', 'data', 'realtime'],
    context_type = 'realtime_data'
WHERE (capability_name LIKE '%realtime%' OR capability_name LIKE '%real_time%')
AND intent_category IS NULL;

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
)
AND intent_category IS NULL;

-- Add weather capabilities
UPDATE capabilities
SET
    intent_category = 'weather_query',
    semantic_tags = ARRAY['weather', 'forecast', 'climate', 'meteorology'],
    context_type = 'weather_data'
WHERE (capability_name LIKE '%weather%' OR capability_name LIKE '%forecast%')
AND intent_category IS NULL;

-- Verification: Show categorization summary
SELECT
    intent_category,
    context_type,
    COUNT(*) as capability_count,
    array_agg(capability_name ORDER BY capability_name) as sample_capabilities
FROM capabilities
WHERE intent_category IS NOT NULL
GROUP BY intent_category, context_type
ORDER BY intent_category, context_type;