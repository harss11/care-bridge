/**
 * Demo listings: real hospitals near RKGIT / Raj Nagar Extension, Ghaziabad, with SAMPLE doctors
 * and slots so the booking flow can be shown end to end. Safe to run repeatedly (upserts by slug).
 *
 *   node --env-file=.env.local --import tsx src/scripts/seed-ghaziabad.ts
 *
 * Names and addresses come from public directory listings (Practo, Justdial, hospital websites).
 * Phone numbers and map positions are deliberately left empty: they could not be verified, and
 * the emergency finder shows them to people in an emergency. Every hospital page and doctor is
 * labelled as a demo/sample.
 */
import { prisma } from "../lib/prisma.js";
import { syncDoctorSlots } from "../modules/slots/slots.service.js";
import { randomToken } from "../utils/crypto.js";

const MON_SAT = [1, 2, 3, 4, 5, 6];

interface SampleDoctor {
  name: string;
  department: string;
  qualification: string;
  specialization: string;
  experienceYears: number;
  gender: "MALE" | "FEMALE";
  fee: number; // paise
  /** Minutes from local midnight. */
  start: number;
  end: number;
  slot: number;
  days?: number[];
}

interface DemoHospital {
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode?: string;
  doctors: SampleDoctor[];
}

const doc = (
  name: string,
  department: string,
  qualification: string,
  specialization: string,
  experienceYears: number,
  gender: "MALE" | "FEMALE",
  feeRupees: number,
  start: number,
  end: number,
  days?: number[],
): SampleDoctor => ({
  name: `${name} (sample)`,
  department,
  qualification,
  specialization,
  experienceYears,
  gender,
  fee: feeRupees * 100,
  start: start * 60,
  end: end * 60,
  slot: 15,
  days,
});

const HOSPITALS: DemoHospital[] = [
  {
    slug: "navjeevan-hospital-ghaziabad",
    name: "Navjeevan Hospital",
    addressLine1: "Meerut Bypass Road, near RKGIT",
    addressLine2: "Raj Nagar Extension",
    doctors: [
      doc(
        "Dr. Amit Tyagi",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        12,
        "MALE",
        400,
        9,
        13,
      ),
      doc(
        "Dr. Neha Chaudhary",
        "Gynaecology",
        "MBBS, MS (Obs & Gynae)",
        "Gynaecologist",
        9,
        "FEMALE",
        500,
        10,
        14,
      ),
      doc(
        "Dr. Rohit Saini",
        "Orthopaedics",
        "MBBS, MS (Ortho)",
        "Orthopaedic Surgeon",
        11,
        "MALE",
        600,
        16,
        19,
      ),
    ],
  },
  {
    slug: "apex-hospital-raj-nagar-extension",
    name: "Apex Hospital",
    addressLine1: "Plot 158, SCC Safayer, KDP Gol Chakkar Road",
    addressLine2: "Raj Nagar Extension",
    postalCode: "201017",
    doctors: [
      doc(
        "Dr. Vikas Sharma",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        15,
        "MALE",
        400,
        9,
        13,
      ),
      doc(
        "Dr. Pooja Agarwal",
        "Paediatrics",
        "MBBS, MD (Paediatrics)",
        "Paediatrician",
        8,
        "FEMALE",
        500,
        10,
        13,
      ),
      doc(
        "Dr. Sanjay Rana",
        "Cardiology",
        "MBBS, MD, DM (Cardiology)",
        "Cardiologist",
        17,
        "MALE",
        900,
        17,
        20,
        [1, 3, 5],
      ),
    ],
  },
  {
    slug: "gargi-hospital-raj-nagar",
    name: "Gargi Hospital",
    addressLine1: "R-9/182, near ALT Centre, Sector 9/10",
    addressLine2: "Raj Nagar",
    postalCode: "201002",
    doctors: [
      doc(
        "Dr. Kavita Goel",
        "Gynaecology",
        "MBBS, DGO",
        "Gynaecologist",
        16,
        "FEMALE",
        600,
        10,
        14,
      ),
      doc(
        "Dr. Manish Bansal",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        10,
        "MALE",
        400,
        9,
        12,
      ),
      doc("Dr. Ritu Mittal", "Paediatrics", "MBBS, DCH", "Paediatrician", 7, "FEMALE", 500, 16, 19),
    ],
  },
  {
    slug: "shyam-hospital-raj-nagar",
    name: "Shyam Hospital",
    addressLine1: "R-5/49-B, near Mother Dairy",
    addressLine2: "Raj Nagar",
    postalCode: "201002",
    doctors: [
      doc(
        "Dr. Anuj Garg",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        13,
        "MALE",
        400,
        9,
        13,
      ),
      doc(
        "Dr. Shalini Verma",
        "Dermatology",
        "MBBS, MD (Dermatology)",
        "Dermatologist",
        8,
        "FEMALE",
        600,
        11,
        14,
        [2, 4, 6],
      ),
      doc("Dr. Rajeev Kumar", "ENT", "MBBS, MS (ENT)", "ENT Specialist", 14, "MALE", 500, 16, 19),
    ],
  },
  {
    slug: "vardan-multi-speciality-hospital",
    name: "Vardan Multi Speciality Hospital",
    addressLine1: "Garhi Sikroad, NH-58, Meerut Road",
    addressLine2: "Opposite Guldhar Gate",
    postalCode: "201003",
    doctors: [
      doc(
        "Dr. Deepak Malik",
        "Orthopaedics",
        "MBBS, MS (Ortho)",
        "Joint Replacement",
        12,
        "MALE",
        700,
        10,
        14,
      ),
      doc(
        "Dr. Sunita Yadav",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        11,
        "FEMALE",
        400,
        9,
        13,
      ),
      doc(
        "Dr. Arjun Mehra",
        "Cardiology",
        "MBBS, MD, DM (Cardiology)",
        "Cardiologist",
        19,
        "MALE",
        1000,
        17,
        20,
        [2, 4, 6],
      ),
    ],
  },
  {
    slug: "kansal-multispeciality-hospital",
    name: "Kansal Multispeciality Hospital",
    addressLine1: "Plot 459, Meerut Road",
    addressLine2: "Opposite Sewa Nagar",
    postalCode: "201003",
    doctors: [
      doc(
        "Dr. Nitin Arora",
        "Orthopaedics",
        "MBBS, D.Ortho",
        "Orthopaedician",
        10,
        "MALE",
        600,
        10,
        14,
      ),
      doc(
        "Dr. Priyanka Jain",
        "Gynaecology",
        "MBBS, MS (Obs & Gynae)",
        "Gynaecologist",
        9,
        "FEMALE",
        500,
        16,
        19,
      ),
      doc(
        "Dr. Harish Chandra",
        "General Medicine",
        "MBBS, MD (Medicine)",
        "General Physician",
        20,
        "MALE",
        400,
        9,
        12,
      ),
    ],
  },
];

const disclaimer = (name: string) =>
  `Demo listing created for the Care Bridge project. It is not run by or affiliated with ${name}. ` +
  `The doctors and time slots shown are samples, not real appointments: please contact the ` +
  `hospital directly to book a visit.`;

async function main() {
  let slots = 0;
  for (const h of HOSPITALS) {
    const data = {
      name: h.name,
      status: "ACTIVE" as const,
      description: disclaimer(h.name),
      addressLine1: h.addressLine1,
      addressLine2: h.addressLine2 ?? null,
      city: "Ghaziabad",
      state: "Uttar Pradesh",
      postalCode: h.postalCode ?? null,
      country: "IN",
      approvedAt: new Date(),
    };
    const hospital = await prisma.hospital.upsert({
      where: { slug: h.slug },
      update: data,
      create: { slug: h.slug, ...data },
    });

    const departments = [...new Set(h.doctors.map((d) => d.department))];
    const departmentIds: Record<string, string> = {};
    for (const [i, name] of departments.entries()) {
      const d = await prisma.department.upsert({
        where: { hospitalId_name: { hospitalId: hospital.id, name } },
        update: { sortOrder: i, isActive: true },
        create: { hospitalId: hospital.id, name, sortOrder: i },
      });
      departmentIds[name] = d.id;
    }

    for (const d of h.doctors) {
      const doctorData = {
        hospitalId: hospital.id,
        departmentId: departmentIds[d.department]!,
        name: d.name,
        qualification: d.qualification,
        specialization: d.specialization,
        experienceYears: d.experienceYears,
        gender: d.gender,
        languages: ["Hindi", "English"],
        consultationFee: d.fee,
        avgConsultMinutes: 10,
        isActive: true,
      };
      const existing = await prisma.doctor.findFirst({
        where: { hospitalId: hospital.id, name: d.name },
        select: { id: true },
      });
      const doctor = existing
        ? await prisma.doctor.update({ where: { id: existing.id }, data: doctorData })
        : await prisma.doctor.create({ data: { ...doctorData, qrToken: randomToken(16) } });

      await prisma.doctorSchedule.deleteMany({ where: { doctorId: doctor.id } });
      await prisma.doctorSchedule.createMany({
        data: (d.days ?? MON_SAT).map((dayOfWeek) => ({
          doctorId: doctor.id,
          dayOfWeek,
          startMinute: d.start,
          endMinute: d.end,
          slotMinutes: d.slot,
          capacityPerSlot: 1,
        })),
      });
      slots += (await syncDoctorSlots(doctor.id)).created;
    }
    console.warn(`✓ ${h.name} (${h.doctors.length} sample doctors)`);
  }
  console.warn(`\nDone: ${HOSPITALS.length} hospitals, ${slots} new bookable slots.`);
}

try {
  await main();
} catch (err) {
  console.error("Seeding failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
