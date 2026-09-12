export async function GET() {
  return Response.json(
    {
      openapi: '3.1.0',
      info: {
        title: 'What Dreams Below VTT Content API',
        version: '1.0.0',
        description:
          'Provider-neutral staging API for generated investigative-horror content.',
      },
      servers: [{ url: 'https://what-dream-below-vtt.friarpuck.com/api/v1' }],
      components: {
        securitySchemes: { campaignToken: { type: 'http', scheme: 'bearer' } },
        schemas: {
          ContentPackage: {
            type: 'object',
            required: ['schemaVersion', 'title'],
            properties: {
              schemaVersion: { const: '1.0' },
              title: { type: 'string' },
              source: { type: 'string' },
              summary: { type: 'string' },
              scenes: { type: 'array' },
              cast: { type: 'array' },
              handouts: { type: 'array' },
              encounters: { type: 'array' },
              metadata: { type: 'object' },
            },
          },
        },
      },
      security: [{ campaignToken: [] }],
      paths: {
        '/campaigns/{campaignId}/context': {
          get: {
            summary: 'Get a Keeper-approved creative brief',
            parameters: [
              {
                name: 'campaignId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: { '200': { description: 'Campaign context' } },
          },
        },
        '/campaigns/{campaignId}/imports': {
          get: {
            summary: 'List staged imports',
            responses: { '200': { description: 'Import summaries' } },
          },
          post: {
            summary: 'Stage a validated content package',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ContentPackage' },
                },
              },
            },
            responses: {
              '202': { description: 'Import staged' },
              '422': { description: 'Validation failed' },
            },
          },
        },
        '/campaigns/{campaignId}/assets': {
          get: {
            summary: 'List generated campaign media',
            responses: { '200': { description: 'Asset summaries' } },
          },
          post: {
            summary: 'Stage generated media from multipart upload or HTTPS URL',
            responses: {
              '202': { description: 'Asset stored for Keeper review' },
              '413': { description: 'Asset exceeds 12 MB' },
              '422': { description: 'Asset validation failed' },
            },
          },
        },
      },
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
