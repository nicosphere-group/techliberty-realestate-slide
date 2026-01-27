import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, organization, twoFactor, username } from "better-auth/plugins";
import { prisma } from "./prisma";

export const auth = betterAuth({
	appName: "RealEstate Slide Generator",
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	advanced: {
		database: {
			generateId: false,
		},
	},
	experimental: {
		joins: true,
	},
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		twoFactor(),
		username(),
		admin(),
		organization({
			teams: {
				enabled: true,
			},
		}),
	],
});
