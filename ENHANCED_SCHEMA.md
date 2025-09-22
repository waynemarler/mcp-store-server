# Enhanced MCP Store Server Schema

This document describes the enhanced database schema implementation for the MCP Store Server, providing normalized tables and additional features for better scalability and flexibility.

## Schema Overview

The enhanced schema includes the following normalized tables:

### Core Tables
- **authors** - Author/publisher information for trust and branding
- **mcp_servers** - Core server metadata with enhanced fields
- **categories** - Hierarchical category structure (main + sub-category)
- **capabilities** - Machine-readable capability definitions
- **tags** - Free-form labels for discovery

### Junction Tables
- **server_categories** - Many-to-many server-category relationships
- **server_capabilities** - Many-to-many server-capability relationships
- **server_tags** - Many-to-many server-tag relationships

### Metrics Table
- **server_metrics** - Usage tracking and performance monitoring

## Key Enhancements

### 1. Normalized Structure
- Separate tables for reusable entities (authors, categories, capabilities, tags)
- Many-to-many relationships for flexible categorization
- Reduced data duplication and improved consistency

### 2. Enhanced Server Metadata
- **Author information** - Publisher details for trust and branding
- **Server type** - Categorization as 'informational', 'transactional', or 'task'
- **Version tracking** - Semantic versioning support
- **Status management** - 'active', 'inactive', or 'deprecated' status
- **Logo URLs** - Visual branding support
- **Trust scoring** - 0-100 trust score for quality assessment

### 3. Hierarchical Categories
- **Main categories** - High-level groupings (Information, Tools, Data, Communication)
- **Sub-categories** - Specific use cases (Weather, Analytics, Database, etc.)
- **Flexible mapping** - Servers can belong to multiple categories

### 4. Metrics and Monitoring
- **Request tracking** - Count and analyze API usage
- **Error monitoring** - Track failures and reliability
- **Latency measurement** - Performance monitoring
- **Health checks** - Automated service health tracking

## Usage

### Environment Variables

To enable the enhanced schema, set:
```bash
USE_ENHANCED_SCHEMA=true
```

### API Compatibility

The enhanced schema is backward compatible with existing API calls. However, registration requests can now include additional fields:

```javascript
{
  "id": "weather-service",
  "name": "Weather Service",
  "description": "Advanced weather data service",
  "logoUrl": "https://example.com/logo.png",
  "endpoint": "https://api.weather.com/mcp",
  "type": "informational",
  "version": "2.1.0",
  "author": {
    "name": "Weather Corp",
    "website": "https://weathercorp.com",
    "contactEmail": "support@weathercorp.com"
  },
  "categories": [
    { "mainCategory": "Information", "subCategory": "Weather" },
    { "mainCategory": "Tools", "subCategory": "Analytics" }
  ],
  "capabilities": ["weather.current", "weather.forecast"],
  "tags": ["meteorology", "real-time", "api"],
  "verified": true,
  "trustScore": 95,
  "status": "active"
}
```

### Testing

Run the enhanced test suite:
```bash
node examples/test-enhanced.js
```

This test demonstrates:
- Registration of servers with full enhanced metadata
- Category-based discovery
- Capability-based discovery
- Trust score filtering
- Author information retrieval

## Migration

### From Simple Schema

The enhanced schema can coexist with the simple schema. The system automatically detects which schema to use based on the `USE_ENHANCED_SCHEMA` environment variable.

### Database Migration

The enhanced schema creates new normalized tables. Existing data in the simple `mcp_servers` table is preserved but not automatically migrated.

To migrate existing data:
1. Export existing server data
2. Transform to enhanced format
3. Re-register servers with enhanced metadata

## Benefits

### 1. Scalability
- Normalized structure reduces data duplication
- Indexed relationships improve query performance
- Support for large-scale server registries

### 2. Flexibility
- Multiple categories per server
- Extensible tag system
- Rich metadata support

### 3. Trust and Quality
- Author verification system
- Trust scoring mechanism
- Status management for lifecycle tracking

### 4. Analytics
- Comprehensive metrics collection
- Performance monitoring
- Usage pattern analysis

### 5. Discovery
- Enhanced search capabilities
- Category-based browsing
- Tag-based filtering
- Trust-based ranking

## Default Data

The enhanced schema includes pre-populated categories and capabilities:

### Categories
- Information: Weather, News, Financial
- Tools: Development, Productivity, Analytics
- Communication: Email, Chat, Social
- Data: Database, Storage, Processing

### Capabilities
- weather.current, weather.forecast, weather.alerts
- data.query, data.insert, data.update, data.delete
- file.read, file.write
- api.call, compute.execute
- translate.text, search.web, search.documents

## Future Enhancements

Planned additions to the enhanced schema:
- **Rate limiting** - Per-server usage quotas
- **Security policies** - Access control and authentication
- **Service dependencies** - Inter-service relationship mapping
- **Monitoring dashboards** - Real-time analytics UI
- **Auto-discovery** - Automatic server registration