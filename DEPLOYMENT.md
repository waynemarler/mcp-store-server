# Deployment Guide for MCP Store Server

## Quick Deploy to Vercel

### 1. One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/mcp-store-server)

### 2. Manual Deployment

1. **Fork this repository** or clone it to your GitHub account

2. **Connect to Vercel:**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

3. **Set up Vercel KV (Optional but Recommended):**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to your project → Storage → KV
   - Create a new KV database
   - Connect it to your project

4. **Environment Variables:**
   If you set up KV, the environment variables will be automatically configured.

   For additional security, you can add:
   ```
   API_SECRET_KEY=your-secret-key-here
   ```

## Local Development

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd mcp-store-server
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Test the server:**
   ```bash
   node examples/test-client.js
   ```

## Production Configuration

### Vercel Settings

The `vercel.json` configuration optimizes for:
- 30-second timeout for MCP endpoints (routing requests)
- 10-second timeout for registry operations
- Automatic KV environment variable injection

### Storage Options

**Option 1: Vercel KV (Recommended)**
- Persistent storage across deployments
- Redis-compatible
- Automatic scaling
- Built-in authentication

**Option 2: In-Memory (Development)**
- No external dependencies
- Data resets on deployment
- Perfect for testing

## DNS and Custom Domains

1. **Add custom domain in Vercel:**
   - Project Settings → Domains
   - Add your domain (e.g., `mcp-store.yourcompany.com`)

2. **Update DNS records:**
   - Add CNAME record pointing to Vercel

## Security Considerations

### API Authentication (Optional)

To add API key authentication, modify `app/api/*/route.ts` files:

```typescript
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('Authorization');
  if (apiKey !== `Bearer ${process.env.API_SECRET_KEY}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

### Rate Limiting

Consider adding rate limiting using Vercel Edge Middleware for production use.

## Monitoring and Logs

### Vercel Analytics
- Automatic request metrics
- Performance monitoring
- Error tracking

### Custom Logging
```typescript
console.log('[MCP-STORE]', 'Server registered:', serverId);
```

## Scaling Considerations

### Performance Optimization
- Use Vercel Edge Config for frequently accessed data
- Implement caching for discovery requests
- Consider CDN for static assets

### Multi-Region Deployment
- Vercel automatically deploys to multiple regions
- KV storage replicates globally
- Edge functions run close to users

## Troubleshooting

### Common Issues

**1. KV Connection Failed**
- Verify environment variables are set
- Check KV database is linked to project

**2. MCP Client Connection Issues**
- Ensure CORS is properly configured
- Check endpoint URLs are correct
- Verify JSON-RPC format

**3. Memory Limits**
- Monitor function memory usage
- Consider upgrading Vercel plan if needed

### Debug Mode

Enable debug logging:
```bash
export DEBUG=mcp-store:*
npm run dev
```

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mcp` | POST | Main MCP JSON-RPC endpoint |
| `/api/registry` | GET | List all servers |
| `/api/registry` | POST | Register new server |
| `/api/registry` | DELETE | Remove server |
| `/api/discovery` | GET | Discover servers by criteria |
| `/api/health/[id]` | GET | Get server health |
| `/api/health/[id]` | POST | Perform health check |

## Next Steps

1. **Register your first MCP server**
2. **Test discovery and routing**
3. **Set up monitoring and alerts**
4. **Configure custom authentication if needed**
5. **Add your MCP Store URL to your client applications**

Your MCP Store Server is now ready to route and manage multiple MCP services! 🚀