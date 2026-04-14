import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vsos = await prisma.visitServiceOrder.findMany({
    where: { performedBy: null },
    include: {
      service: {
        include: {
          doctorServices: {
            include: { doctorProfile: true }
          }
        }
      }
    }
  });

  console.log(`Found ${vsos.length} VSOs with null performedBy`);

  for (const vso of vsos) {
    const doctorId = vso.service.doctorServices?.[0]?.doctorProfile?.userId;
    if (doctorId) {
      await prisma.visitServiceOrder.update({
        where: { id: vso.id },
        data: { performedBy: doctorId }
      });
      console.log(`Updated VSO ${vso.id} with doctor ${doctorId}`);
    } else {
      console.log(`No doctor found for service ${vso.serviceId}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
