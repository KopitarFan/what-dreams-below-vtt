import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { contentImports } from '@/db/schema';
import { contentPackageSchema } from '@/lib/content-schema';
import { apiError, integrationAuth } from '@/lib/integration-api';

const newId = () => `import_${crypto.randomUUID()}`;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!(await integrationAuth(request, campaignId, 'imports:write')))
    return apiError('Valid imports:write bearer token required.', 401);
  const raw = await request.json().catch(() => null),
    parsed = contentPackageSchema.safeParse(raw);
  if (!parsed.success)
    return apiError(
      'Content package validation failed: ' +
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      422,
    );
  const item = parsed.data,
    id = newId();
  await getDb()
    .insert(contentImports)
    .values({
      id,
      campaignId,
      status: 'pending',
      source: item.source,
      title: item.title,
      packageJson: JSON.stringify(item),
      validationJson: JSON.stringify({
        valid: true,
        schemaVersion: item.schemaVersion,
      }),
      createdAt: Date.now(),
    });
  return Response.json(
    {
      id,
      status: 'pending',
      title: item.title,
      reviewUrl: `/?campaign=${encodeURIComponent(campaignId)}&screen=keeper&section=imports`,
    },
    { status: 202, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  if (!(await integrationAuth(request, campaignId, 'imports:write')))
    return apiError('Valid imports:write bearer token required.', 401);
  const rows = await getDb()
    .select()
    .from(contentImports)
    .where(eq(contentImports.campaignId, campaignId))
    .orderBy(desc(contentImports.createdAt))
    .all();
  return Response.json(
    {
      imports: rows.map((r) => ({
        id: r.id,
        title: r.title,
        source: r.source,
        status: r.status,
        createdAt: r.createdAt,
      })),
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
  });
}
