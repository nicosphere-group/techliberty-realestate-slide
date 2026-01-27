import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function main() {
	const user = await auth.api.createUser({
		body: {
			email: "info@example.com",
			password: "password123",
			name: "田中太郎",
			role: "admin",
		},
	});
	console.log("Created user:", user);

	const organization = await auth.api.createOrganization({
		body: {
			name: "株式会社nicosphere",
			slug: "nicosphere-org",
			userId: user.user.id,
		},
	});
	if (!organization) {
		throw new Error("Organization creation failed");
	}
	console.log("Created organization:", organization);

	console.log("Seeding completed successfully");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
