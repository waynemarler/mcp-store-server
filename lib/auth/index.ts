// Main auth module exports

export * from './types';
export * from './credentials';
export * from './server-auth';

// Re-export main functions for convenience
export {
  authenticateServer,
  enhanceServerWithAuth,
  serverRequiresAuth,
  getAuthDebugInfo
} from './server-auth';

export {
  getServerCredentials,
  getAuthProviders,
  setServerCredentials,
  getCredentialStats
} from './credentials';