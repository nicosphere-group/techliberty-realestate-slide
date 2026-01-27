import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, twoFactor, username } from "better-auth/plugins";
import { prisma } from "./prisma";

export const auth = betterAuth({
	appName: "RealEstate Slide Generator",
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	experimental: {
		joins: true,
	},
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		twoFactor(),
		username(),
		organization({
			teams: {
				enabled: true,
			},
		}),
	],
});
