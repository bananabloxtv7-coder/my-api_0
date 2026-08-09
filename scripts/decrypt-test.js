const { PrismaClient } = require('@prisma/client');
const { decrypt } = require('./../src/lib/crypto') || {};
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  const provider = await prisma.provider.findFirst({
    where: { name: { contains: 'api.v0' } },
    include: { apiKeys: true }
  });
  
  if (!provider) return console.log('No v0 provider');
  
  const cryptoSource = fs.readFileSync('./src/lib/crypto.ts', 'utf8');
  console.log(cryptoSource);
}
main();
