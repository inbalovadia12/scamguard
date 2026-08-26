/**
 * Apple Live Caller ID Lookup - Config Endpoint
 * 
 * This endpoint returns server configuration required by Apple's IdentityLookup framework.
 * 
 * Apple sends: POST request to /config
 * Server returns: Configuration object with protocol version and capabilities
 * 
 * REQUIRED CONFIGURATION:
 * - Set APPLE_TEAM_ID environment variable (from Apple Developer account)
 * - Set APPLE_BUNDLE_ID environment variable (from your Xcode extension)
 * - Private key for signing (see liveCallerKey function)
 */

Deno.serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    /**
     * APPLE REQUIRED CONFIGURATION
     * Get these from your Apple Developer account and Xcode project:
     */
    const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID'); // e.g., "XXXXXXXXXX"
    const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID'); // e.g., "com.vardin.caller-lookup"

    if (!APPLE_TEAM_ID || !APPLE_BUNDLE_ID) {
      console.error('Missing Apple configuration: APPLE_TEAM_ID and APPLE_BUNDLE_ID must be set');
      return Response.json(
        { error: 'Server configuration incomplete' },
        { status: 500 }
      );
    }

    /**
     * Config Response Format (Apple's specification)
     * 
     * version: Protocol version (currently 1 for Live Caller ID)
     * maxCallDurationSeconds: How long to wait for response (typically 5 seconds)
     * maxNetworkCallDurationSeconds: Network timeout
     */
    const config = {
      version: 1,
      maxCallDurationSeconds: 5,
      maxNetworkCallDurationSeconds: 5,
      serverInfo: {
        name: 'Vardin Live Caller ID Service',
        version: '1.0',
      },
    };

    return Response.json(config, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('liveCallerConfig error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
