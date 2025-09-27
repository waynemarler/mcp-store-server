# Scheduled Smithery Sync - Cron Job Setup

This setup allows automatic syncing of MCP servers from Smithery API every few hours.

## 🎯 Overview

- **Target**: Pull 50 servers every 3-6 hours
- **Benefits**: Steady growth, API-friendly, no rate limiting
- **Endpoint**: `/api/scheduled-sync`
- **Script**: `sync-cron.js`

## 📊 Sync Strategy

Instead of aggressive bulk syncing (which can fail), we:
- Fetch exactly **50 servers per run**
- Smart **duplicate detection** (skips existing servers)
- **Gradual progress** toward 7,000 server target
- **API-friendly** with delays and error handling

## 🔧 Setup Instructions

### 1. Test the Endpoint

```bash
# Test scheduled sync manually
curl -X POST http://localhost:3005/api/scheduled-sync

# Or visit in browser
http://localhost:3005/api/scheduled-sync
```

### 2. Setup Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line for every 3 hours:
0 */3 * * * cd /path/to/mcp-store-server && node sync-cron.js >> sync.log 2>&1

# Or every 6 hours:
0 */6 * * * cd /path/to/mcp-store-server && node sync-cron.js >> sync.log 2>&1

# Or daily at 2 AM:
0 2 * * * cd /path/to/mcp-store-server && node sync-cron.js >> sync.log 2>&1
```

### 3. Setup Windows Task Scheduler

1. Open **Task Scheduler**
2. Create **Basic Task**
3. Name: "MCP Server Sync"
4. Trigger: **Daily** or **Custom** (every 3-6 hours)
5. Action: **Start Program**
   - Program: `node`
   - Arguments: `sync-cron.js`
   - Start in: `C:\Users\wayne\Projects\mcp-store-server`

### 4. Environment Variables

Ensure these are set:
```bash
SMITHERY_API_KEY=your_api_key_here
SYNC_URL=http://localhost:3005  # Optional, defaults to localhost:3005
```

## 📈 Expected Growth Rate

With **50 servers every 3 hours**:
- **Daily**: 400 servers
- **Weekly**: 2,800 servers
- **To reach 7,000**: ~18 days from current 576

With **50 servers every 6 hours**:
- **Daily**: 200 servers
- **Weekly**: 1,400 servers
- **To reach 7,000**: ~32 days from current 576

## 📊 Monitoring

### Check Sync Status
```bash
curl http://localhost:3005/api/background-sync
```

### View Logs
```bash
# If using cron with log file
tail -f sync.log

# Check last sync in database
SELECT * FROM sync_status WHERE source = 'smithery_scheduled' ORDER BY updated_at DESC LIMIT 1;
```

### Manual Sync
```bash
# Run sync manually anytime
node sync-cron.js

# Or test endpoint directly
curl -X POST http://localhost:3005/api/scheduled-sync
```

## 🎛️ Configuration Options

The scheduled sync is designed to be:
- **Conservative**: 100ms delays between servers
- **Smart**: Skips duplicates automatically
- **Resilient**: Continues on individual server errors
- **Informative**: Detailed logging and progress reports

## 🚨 Troubleshooting

### Common Issues:
1. **API Key Missing**: Set `SMITHERY_API_KEY` environment variable
2. **Server Down**: Ensure Next.js server is running on port 3005
3. **Permissions**: Make sure `sync-cron.js` is executable (`chmod +x sync-cron.js`)
4. **Rate Limiting**: Increase delays if API returns 429 errors

### Success Indicators:
- ✅ `serversAdded > 0` in response
- ✅ No errors in sync status
- ✅ Total server count increasing over time
- ✅ V3 routing finding new servers in queries

## 🎉 Benefits of This Approach

1. **API-Friendly**: No overwhelming the Smithery API
2. **Reliable**: Small batches less likely to fail
3. **Resumable**: Automatically picks up where it left off
4. **Monitorable**: Clear progress tracking and logging
5. **Flexible**: Easy to adjust timing based on needs

Start with **every 6 hours** and adjust based on your needs!