const prisma = require('../prismaClient');
const { buildProductionDataPayload, PRODUCTION_DATA_INCLUDE } = require('./productionDataBuilder');

const ERP_API_URL = process.env.ERP_API_URL;
const ERP_SERVICE_USERNAME = process.env.ERP_SERVICE_USERNAME;
const ERP_SERVICE_PASSWORD = process.env.ERP_SERVICE_PASSWORD;

// Confirmed against their live server: login requires a "username" field
// (not "identifier") — response shape for the token still unverified.
// Called fresh on every push rather than caching a token: the alternative
// saves one HTTP round trip per completed job but adds a whole class of
// "token expired mid-cache" bugs for very little benefit, since pushes
// only happen once per job completion, not on any hot path.
async function loginToErp() {
  const res = await fetch(`${ERP_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ERP_SERVICE_USERNAME, password: ERP_SERVICE_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`ERP login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

async function pushProductionData(jobId) {
  if (!ERP_API_URL || !ERP_SERVICE_USERNAME || !ERP_SERVICE_PASSWORD) {
    console.error('ERP push skipped: ERP_API_URL/ERP_SERVICE_USERNAME/ERP_SERVICE_PASSWORD not configured');
    return;
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, include: PRODUCTION_DATA_INCLUDE });
  // Silently no-ops for manually-created jobs — there's no ERP work order
  // to report data back against, so this isn't an error condition, just
  // nothing to do.
  if (!job || job.source !== 'ERP' || !job.externalWorkOrderId) {
    return;
  }

  const payload = buildProductionDataPayload(job);
  const token = await loginToErp();

  const res = await fetch(`${ERP_API_URL}/mes/production-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`ERP production-data push failed: ${res.status} ${await res.text()}`);
  }
}

module.exports = { pushProductionData };
